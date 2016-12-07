var request = require('request');
var assign = require('lodash.assign');
var debug = require('debug')('inliner');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('then-fs');
var mime = require('mime');
var basename = require('path').basename;

var cache = {};

module.exports = function get(url, options) {
  var inliner = this;
  if (url.indexOf('data:') === 0) {
    debug('asset already inline', url);
    return Promise.resolve({
      headers: {
        'content-type': url.slice(5).replace(/;.*$/, ''),
      },
      body: url,
    });
  }

  if (inliner.options.cache && cache[url]) {
    debug('request responding with cache');
    return cache[url];
  }

  var base = basename(url);

  this.emit('progress', 'loading ' + base);

  var promise;
  if (this.isFile && url.indexOf('http') !== 0) {
    debug('inliner.get file: %s', url);
    promise = fs.readFile(url).then(function read(body) {
      return {
        body: body,
        headers: {
          'content-type': mime.lookup(url),
        },
      };
    }).catch(function (error) {
      if (error.code === 'ENOENT') {
        inliner.emit('warning', 'no such file: ' + base);
      }

      return {
        body: '',
        headers: {
          'content-type': mime.lookup(url),
        },
      };
    });

    if (inliner.options.cache) {
      cache[url] = promise;
    }
    return promise;
  }

  debug('inliner.get url: %s', url);

  var settings = assign({}, options, {
    encoding: null,
    followRedirect: true,
    headers: inliner.headers,
  });

  debug('request %s', url, settings);

  promise = new Promise(function (resolve) {
    request(encodeURI(url), settings, function response(error, res, body) {
      if (error) {
        debug('request failed: %s', error.message);
        inliner.emit('warning', 'failed to request ' + base + ' (' +
          error.message + ')');

        body = '';
        res = {
          headers: {},
        };
      } else if (res.statusCode !== 200) {
        inliner.emit('warning', res.statusCode + ' on ' + base);
      }

      debug('response: %s %s', res.statusCode, url);

      if (res.statusCode >= 400) {
        body = '';
      }

      resolve({
        body: body,
        headers: res.headers,
        statusCode: res.statusCode,
      });
    });
  });

  if (inliner.options.cache) {
    cache[url] = promise;
  }
  return promise;
};
