var request = require('request');
var assign = require('lodash.assign');
var debug = require('debug')('inliner');
var fs = require('then-fs');
var mime = require('mime');

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

  if (cache[url]) {
    debug('request responding with cache');
    return cache[url];
  }

  this.emit('progress', 'loading ' + url);

  if (this.isFile && url.indexOf('http') !== 0) {
    debug('inliner.get file: %s', url);
    cache[url] = fs.readFile(url).then(function read(body) {
      return {
        body: body,
        headers: {
          'content-type': mime.lookup(url),
        },
      };
    });

    return cache[url];
  }

  debug('inliner.get url: %s', url);

  var settings = assign({}, options, {
    encoding: null,
    followRedirect: true,
  });

  debug('request %s', url);

  cache[url] = new Promise(function promise(resolve, reject) {
    request(url, settings, function response(error, res, body) {
      if (error) {
        debug('request failed: %s', error.message);
        return reject(error);
      }

      if (!res) {
        res = { headers: {}, statusCode: null };
      }

      debug('response: %s %s', res.statusCode, url);
      if (res.statusCode !== 200) {
        body = '';
        inliner.emit('warning', res.statusCode + ' on ' + url);
      }

      resolve({
        body: body,
        headers: res.headers,
        statusCode: res.statusCode,
      });
    });
  });

  return cache[url];
};
