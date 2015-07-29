module.exports = Inliner;

var debug = require('debug')('inliner');
var events = require('events');
var path = require('path');
var util = require('util');
var fs = require('then-fs');
var mime = require('mime');
var assign = require('lodash.assign');
var forEach = require('lodash.foreach');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var request = require('./get');
var findAssets = require('./find-assets');

function Inliner(url, options, callback) {
  var inliner = this;
  events.EventEmitter.call(this);

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!options) {
    options = {};
  }

  this.url = url;
  this.callback = function wrapper(error, res) {
    // noop the callback once it's fired
    inliner.callback = function noop() {
      inliner.emit('error', 'callback fired again');
    };

    callback(error, res);
  };
  this.options = assign({}, options, Inliner.defaults());
  this.jobs = {
    total: 0,
    todo: 0,
    breakdown: {
      html: 0,
      js: 0,
      links: 0,
      styles: 0,
      images: 0,
    },
    add: this.addJob.bind(this),
    done: {
      html: this.completeJob.bind(this, 'html'),
      js: this.completeJob.bind(this, 'js'),
      images: this.completeJob.bind(this, 'images'),
      links: this.completeJob.bind(this, 'links'),
      styles: this.completeJob.bind(this, 'styles'),
    },
  };
  this.isFile = false;

  this.on('error', function localErrorHandler(event) {
    inliner.callback(event);
  });

  // this allows the user code to get the object back before
  // it starts firing events
  if (this.url) {
    if (typeof setImmediate === 'undefined') {
      global.setImmediate = function setImmediatePolyfill(fn) {
        // :-/
        setTimeout(fn, 0);
      };
    }
    global.setImmediate(this.main.bind(this));
  }

  return this;
}

util.inherits(Inliner, events.EventEmitter);
Inliner.prototype.updateTodo = updateTodo;
Inliner.prototype.addJob = addJob;
Inliner.prototype.completeJob = completeJob;
Inliner.prototype.cssImages = require('./css').getImages;
Inliner.prototype.cssImports = require('./css').getImports;
Inliner.prototype.image = require('./image');
Inliner.prototype.uglify = require('./javascript');
Inliner.prototype.resolve = resolve;
Inliner.prototype.removeComments = removeComments;
Inliner.prototype.get = get;
Inliner.prototype.main = main;

// static properties and methods
Inliner.errors = require('./errors');
Inliner.defaults = function () {
  return {
    images: true,
    compressCSS: true,
    collapseWhitespace: true,
  };
};

// main thread of functionality that does all the inlining
function main() {
  var inliner = this;
  var url = this.url;

  fs.exists(url)
  .then(function exists(isFile) {
    if (!isFile) {
      throw new Error();
    }

    debug('inlining file');

    inliner.isFile = true;
    return url;
  })
  .catch(function isUrl() {
    // check for protocol on URL
    if (url.indexOf('http') !== 0) {
      url = 'http://' + url;
    }

    inliner.url = url;

    debug('inlining url');
    return url;
  })
  .then(inliner.get.bind(this))
  .then(inliner.jobs.add('html'))
  .then(function processHTML(res) {
    inliner.jobs.done.html();
    debug('processing HTML');

    var todo = findAssets(res.body);
    var $ = todo.$;
    delete todo.$;

    forEach(todo, function forEach(todo, key) {
      if (key === 'images' && !inliner.options.images) {
        // skip images if the user doesn't want them
        delete todo.images;
        debug('skipping images');
        return;
      }

      if (!todo.length) {
        return;
      }

      inliner.jobs.add(key, todo.length);
    });

    var promises = [];

    if (todo.images.length) {
      var imagePromises = todo.images.map(function images(i, image) {
        var url = inliner.resolve(inliner.url, $(image).attr('src'));
        return inliner.image(url).then(function then(dataURL) {
          $(image).attr('src', dataURL);
        }).then(inliner.jobs.done.images);
      }).get();

      [].push.apply(promises, imagePromises);
    }

    if (todo.links.length) {
      debug('start %s links', todo.links.length);
      var linkPromises = todo.links.map(function links(i, link) {
        var url = $(link).attr('href');
        if (url.indexOf('http') !== 0) {
          url = inliner.resolve(inliner.url, url);
        }
        inliner.emit('progress', 'processing external css ' + url);
        return inliner.get(url).then(function then(res) {
          var css = res.body;
          inliner.jobs.done.links();
          return inliner.cssImports(url, css)
            .then(inliner.cssImages.bind(inliner, url));
        }).then(function then(css) {
          $(link).replaceWith('<style>' + css + '</style>');
        });
      });

      [].push.apply(promises, linkPromises);
    }

    if (todo.styles.length) {
      debug('start %s styles', todo.styles.length);
      var stylePromises = todo.styles.map(function links(i, style) {
        var css = $(style).text();
        inliner.emit('progress', 'processing inline css');
        return inliner.cssImports(url, css)
          .then(inliner.cssImages.bind(inliner, url))
          .then(function then(css) {
            $(style).text(css);
          });
      });

      [].push.apply(promises, stylePromises);
    }

    if (todo.scripts.length) {
      debug('start %s scripts', todo.scripts.length);
      var scriptPromises = todo.scripts.map(function links(i, script) {
        var $script = $(script);
        var src = $script.attr('src');
        var source = $(script).text();

        var promise;

        // ext script
        if (src) {
          if (src.indexOf('.min.') !== -1) {
            debug('skipping pre-minified script');
            inliner.emit('progress', 'skipping minified script ' + src);
            // ignore scripts with .min. in them - i.e. avoid minify
            // scripts that are already minifed
            return;
          } else if (src.indexOf('google-analytics') !== -1) {
            inliner.emit('progress', 'skipping analytics script');
            // ignore analytics
            return;
          }

          $script.removeAttr('src');
          var url = src;
          if (url.indexOf('http') !== 0) {
            url = inliner.resolve(inliner.url, url);
          }

          promise = inliner.get(url);
        } else {
          inliner.emit('progress', 'processing inline script');
          promise = Promise.resolve({
            body: source,
          });
        }

        return promise.then(inliner.uglify.bind(inliner))
          .then(function then(res) {
          debug('uglify: %s', res);

          // remove ETAGO (https://mathiasbynens.be/notes/etago)
          res = res.replace(/<\/script/gi, '<\\/script');

          $script.text(res);
        });
      });

      [].push.apply(promises, scriptPromises);
    }

    return Promise.all(promises).then(function then() {
      var html = '';
      inliner.removeComments($(':root')[0], $);
      // collapse the white space
      if (inliner.options.collapseWhitespace) {
        // TODO put white space helper back in
        $('pre').html(function tidyPre(i, html) {
          return html.replace(/\n/g, '~~nl~~');
        });
        $('textarea').val(function tidyTextarea(i, v) {
          return v.replace(/\n/g, '~~nl~~').replace(/\s/g, '~~s~~');
        });

        html = $.html()
          .replace(/\s+/g, ' ')
          .replace(/~~nl~~/g, '\n')
          .replace(/~~s~~/g, ' ');
      } else {
        html = $.html();
      }

      return html;
    });

  })
  .then(function then(html) {
    inliner.callback(null, html);
  })
  .catch(function errHandler(error) {
    debug('fail', error.stack);
    inliner.callback(error);
    inliner.emit('error', error);
  });
}

function get(url, options) {
  this.emit('progress', 'loading ' + url);
  if (this.isFile && url.indexOf('http') !== 0) {
    debug('inliner.get file: %s', url);
    return fs.readFile(url).then(function read(body) {
      return {
        body: body,
        headers: {
          'content-type': mime.lookup(url),
        },
      };
    });
  } else {
    debug('inliner.get url: %s', url);
    return request(url, options);
  }
}

function removeComments(element, $) {
  if (!element || !element.childNodes) {
    return;
  }

  var nodes = element.childNodes;
  var i = nodes.length;

  while (i--) {
    if (nodes[i].type === 'comment' && nodes[i].nodeValue.indexOf('[') !== 0) {
      $(nodes[i]).remove();
    }
    removeComments(nodes[i], $);
  }
}

function resolve(from, to) {
  if (!to) {
    to = from;
    from = this.url;
  }

  if (!this.isFile || from.indexOf('http') === 0) {
    return require('url').resolve(from, to);
  } else {
    var path = require('path');
    var base = path.dirname(from);
    return path.resolve(base, to);
  }

}

function updateTodo() {
  this.jobs.todo = this.jobs.breakdown.html +
    this.jobs.breakdown.js +
    this.jobs.breakdown.links +
    this.jobs.breakdown.styles +
    this.jobs.breakdown.images +
    0;

  this.emit('jobs', (this.jobs.total - this.jobs.todo) + '/' + this.jobs.total);
}

function addJob(type) {
  var n = typeof arguments[1] === 'number' ? arguments[1] : 1;
  this.jobs.breakdown[type] += n;
  this.jobs.total += n;
  this.updateTodo();

  debug('%s: %s', type, n);

  // this allows me to include addJob as part of a promise chain
  return arguments[1];
}

function completeJob(type) {
  this.jobs.breakdown[type]--;
  this.updateTodo();

  // this allows me to include addJob as part of a promise chain
  return arguments[1];
}