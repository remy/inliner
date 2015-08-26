module.exports = Inliner;

var debug = require('debug')('inliner');
var events = require('events');
var path = require('path');
var util = require('util');
var fs = require('then-fs');
var assign = require('lodash.assign');
var forEach = require('lodash.foreach');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var findAssets = require('./find-assets');
var iconv = require('iconv-lite');
var charset = require('charset');
var jschardet = require('jschardet');

// note: these tasks (excluding HTML), match up to files in lib/tasks/*.js
var tasks = {
  html: 'html', // this is abritrary since it's manually processed
  js: 'script',
  svg: 'svg',
  links: 'link[rel=stylesheet]',
  styles: 'style',
  images: 'img',
};
var taskRunner = Object.keys(tasks).reduce(function (acc, curr) {
  if (curr !== 'html') {
    acc[curr] = require('./tasks/' + curr);
  }
  return acc;
}, {});

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
  this.options = assign({}, Inliner.defaults(), options);
  this.jobs = {
    total: 0,
    todo: 0,
    tasks: tasks,
    add: this.addJob.bind(this),
    breakdown: {},
    done: {},
  };

  Object.keys(this.jobs.tasks).forEach(function (key) {
    this.jobs.breakdown[key] = 0;
    this.jobs.done[key] = this.completeJob.bind(this, key);
  }.bind(this));

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
Inliner.prototype.get = require('./get');
Inliner.prototype.main = main;
Inliner.prototype.findAssets = findAssets;

// static properties and methods
Inliner.errors = require('./errors');
Inliner.defaults = require('./defaults');

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
  .then(function (url) {
    return inliner.get(url, { encoding: 'binary' });
  })
  .then(inliner.jobs.add('html'))
  .then(function processHTML(res) {
    inliner.jobs.done.html();
    debug('processing HTML');

    debug(inliner.options);

    var body;
    var cheerioLoadOptions = {};
    var enc = inliner.options.encoding;

    // try to determine the encoding from the headers and the body
    if (!enc) {
      enc = charset(res.headers, res.body);
      enc = enc || jschardet.detect(res.body).encoding.toLowerCase();
    }

    // normalise to avoid any mistakes
    if (enc === 'utf-8' || enc === 'utf8') {
      enc = 'utf-8';
    }

    if (enc !== 'utf-8') {
      debug('decoding from: %s', enc);
      cheerioLoadOptions.decodeEntities = false;
      body = iconv.encode(iconv.decode(res.body, enc), 'utf-8');
    } else {
      body = res.body;
    }

    body = body.toString();

    // if we spot some SVG elements in the source,
    // then we'll parse as XML to correctly get the SVG
    if (body.indexOf('<svg') !== -1 || body.indexOf('<SVG') !== -1) {
      cheerioLoadOptions.xmlMode = true;
    }

    var todo = inliner.findAssets(body, cheerioLoadOptions);
    var $ = todo.$;
    delete todo.$;

    if (enc !== 'utf-8') {
      // when transcoding remove any meta tags setting the charset
      $('meta').each(function charMeta() {
        var content = $(this).attr('content') || '';
        if (content.toLowerCase().indexOf('charset=')) {
          $(this).remove();
        }
      });
    }

    var promises = [];

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

      var tasks = taskRunner[key](inliner, todo.get(), $);
      // console.log(key, typeof tasks);
      // console.log('----------------');
      promises = promises.concat(tasks);
    });


    return Promise.all(promises).then(function then() {
      var html = '';
      inliner.removeComments($(':root')[0], $);
      // collapse the white space
      if (inliner.options.collapseWhitespace) {
        $('pre, textarea').each(function () {
          $(this).html($(this).html()
              .replace(/\n/g, '~~nl~~')
              .replace(/\s/g, '~~s~~'));
        });

        html = $.html()
          .replace(/\s+/g, ' ')
          .replace(/~~nl~~/g, '\n')
          .replace(/~~s~~/g, ' ');
      } else {
        html = $.html();
      }

      debug('completed: %s bytes', html.length);

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

  // don't resolve data urls
  if (to.indexOf('data:') === 0) {
    return to;
  }

  if (!this.isFile || from.indexOf('http') === 0) {
    return require('url').resolve(from, to);
  } else {
    var base = path.dirname(from);
    return path.resolve(base, to);
  }

}

function updateTodo() {
  var jobs = this.jobs;
  jobs.todo = Object.keys(jobs.breakdown).reduce(function (acc, key) {
    return acc + jobs.breakdown[key];
  }, 0);

  this.emit('jobs', (jobs.total - jobs.todo) + '/' + jobs.total);
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
