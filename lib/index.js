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
var resolveURL = require('url').resolve;
var resolveFile = require('path').resolve;

function Inliner(url, options, callback) {
  var inliner = this;
  this.url = url;
  this.options = assign({}, options, Inliner.defaults());
  this.total = 0;
  this.todo = 0;
  this.breakdown = {
    html: 0,
    js: 0,
    links: 0,
    styles: 0,
    images: 0,
  };
  // allows us to use in a promise chain without calling
  this.jobs = {
    add: this.addJob.bind(this),
    done: {
      html: this.completeJob.bind(this, 'html'),
      js: this.completeJob.bind(this, 'js'),
      images: this.completeJob.bind(this, 'images'),
      links: this.completeJob.bind(this, 'links'),
      styles: this.completeJob.bind(this, 'styles'),
    },
  };

  var resolve = resolveURL;

  events.EventEmitter.call(this);

  // this allows the user code to get the object back before
  // it starts firing events
  setImmediate(function immediate() {
    var promise = fs.exists(url).then(function exists(isFile) {
      if (!isFile) {
        throw new Error();
      }

      resolve = resolveFile;

      debug('loading file:s %s', url);

      return fs.readFile(url, 'utf8');
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
          var url = resolve(inliner.url, $(image).attr('src'));
          return getImage(url).then(function then(dataURL) {
            $(image).attr('src', dataURL);
          }).then(inliner.jobs.done.images);
        }).get();

        promises = promises.concat(imagePromises);
      }

      return Promise.all(promises).then(function then() {
        return $.html();
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
  });
}

util.inherits(Inliner, events.EventEmitter);

Inliner.prototype.updateTodo = function updateTodo() {
  this.todo = this.breakdown.html +
    this.breakdown.js +
    this.breakdown.links +
    this.breakdown.styles +
    this.breakdown.images +
    0;

  this.emit('jobs', (this.total - this.todo) + '/' + this.total);
};

Inliner.prototype.addJob = function addJob(type) {
  var n = typeof arguments[1] === 'number' ? arguments[1] : 1;
  this.breakdown[type] += n;
  this.total += n;
  this.updateTodo();

  // this allows me to include addJob as part of a promise chain
  return arguments[1];
};

Inliner.prototype.completeJob = function completeJob(type) {
  this.breakdown[type]--;
  this.updateTodo();

  // this allows me to include addJob as part of a promise chain
  return arguments[1];
};

// start of static methods

// make the version available
Inliner.version =
Inliner.prototype.version =
require(path.resolve(__dirname, '..', 'package.json')).version;

Inliner.errors = require('./errors');

Inliner.defaults = function() {
  return {
    images: true,
    compressCSS: true,
    collapseWhitespace: true,
    images: true,
  };
};
