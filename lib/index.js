module.exports = Inliner;

var debug = require('debug')('inliner');
var events = require('events');
var path = require('path');
var util = require('util');
var fs = require('then-fs');
var assign = require('lodash.assign');
var forEach = require('lodash.foreach');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var get = require('./get');
var findAssets = require('./find-assets');
var getImage = require('./image');
var version = require(path.resolve(__dirname, '..', 'package.json')).version;

function Inliner(url, options, callback) {
  this.url = url;
  this.callback = callback;
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

  events.EventEmitter.call(this);

  // bit hacky, but binds the `this.css.*` to this
  forEach(this.css, function each(value, key) {
    if (typeof value === 'function') {
      this.css[key] = this.css[key].bind(this);
    }
  }, this);

  // this allows the user code to get the object back before
  // it starts firing events
  setImmediate(this.main.bind(this));

  return this;
}

util.inherits(Inliner, events.EventEmitter);
Inliner.prototype.updateTodo = updateTodo;
Inliner.prototype.addJob = addJob;
Inliner.prototype.completeJob = completeJob;
Inliner.prototype.version = version;
Inliner.prototype.css = require('./css');
Inliner.prototype.resolve = resolve;
Inliner.prototype.removeComments = removeComments;
Inliner.prototype.main = main;

// static properties and methods
Inliner.version = version;
Inliner.errors = require('./errors');
Inliner.defaults = function() {
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
  var callback = this.callback;

  var promise = fs.exists(url).then(function exists(isFile) {
    if (!isFile) {
      throw new Error();
    }

    inliner.isFile = true;

    debug('loading file: %s', url);

    return fs.readFile(url, 'utf8').then(function (body) {
      return {
        body: body,
      };
    });
  }).catch(function isUrl() {
    // check for protocol on URL
    if (url.indexOf('http') !== 0) {
      url = 'http://' + url;
    }

    debug('loading url: %s', url);

    return get(url);
  }).then(inliner.jobs.add('html'));

  promise.then(function processHTML(res) {
    inliner.jobs.done.html();
    debug('then');

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

      debug('assets %s: %s', key, todo.length);
      inliner.jobs.add(key, todo.length);
    });

    var promises = [];

    if (todo.images) {
      var imagePromises = todo.images.map(function images(i, image) {
        var url = inliner.resolve(inliner.url, $(image).attr('src'));
        return getImage(url).then(function then(dataURL) {
          $(image).attr('src', dataURL);
        }).then(inliner.jobs.done.images);
      }).get();

      [].push.apply(promises, imagePromises);
    }

    if (todo.links) {
      debug('start %s links', todo.links.length);
      var linkPromises = todo.links.map(function links(i, link) {
        var url = inliner.resolve(inliner.url, $(link).attr('href'));
        return inliner.css.load(url).then(function then(css) {
          inliner.jobs.done.links();
          return inliner.css.getImports(url, css).then(inliner.css.getImages);
        }).then(function then(css) {
          $(link).replaceWith('<style>' + css + '</style>');
        });
      });

      [].push.apply(promises, linkPromises);
    }

    if (todo.styles) {
      debug('start %s links', todo.links.length);
      var stylePromises = todo.styles.map(function links(i, style) {
        var css = $(style).html();
        return inliner.css.getImports(url, css)
          .then(inliner.css.getImages)
          .then(function then(css) {
            $(style).html(css);
          });
      });

      [].push.apply(promises, stylePromises);
    }

    return Promise.all(promises).then(function then() {
      var html = '';
      var els = inliner.removeComments($(':root')[0], $);
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
    callback(null, html);
  })
  .catch(function errHandler(error) {
    debug('fail', error);
    callback(error);
    inliner.emit('error', error);
  });
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

  var fn = null;

  if (!this.isFile) {
    fn = require('url').resolve;
  } else {
    fn = require('path').resolve;
  }

  return fn(from, to);
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

  // this allows me to include addJob as part of a promise chain
  return arguments[1];
}

function completeJob(type) {
  this.jobs.breakdown[type]--;
  this.updateTodo();

  // this allows me to include addJob as part of a promise chain
  return arguments[1];
}