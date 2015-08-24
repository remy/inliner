var request = require('request');
var assign = require('lodash.assign');
var debug = require('debug')('inliner');
var fs = require('then-fs');
var mime = require('mime');
var util = require('util');
var path = require('path');

var cache = {};
var UA = require('../config.json').UserAgent;

module.exports = function get(url, options) {
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
    headers: {
      'User-Agent': UA,
    },
  });

  debug('request %s', url);

  cache[url] = new Promise(function promise(resolve, reject) {
    request(url, settings, function response(error, res, body) {
      if (error) {
        debug('request failed: %s', error.message);
        return reject(error);
      }

      debug('response: %s %s', res.statusCode, url);
      if (!error && res.statusCode === 200) {
        resolve({ headers: res.headers, body: body, fallback: false, });
      } else if (!error) {
        var urlMime = mime.lookup(url);
        if (urlMime.indexOf('image/') === 0) {
          // use fallback image instead of aborting
          var fallback = path.join(__dirname, '..', 'fallback.svg');
          resolve(fs.readFile(fallback).then(function read(body) {
            return {
              body: body,
              headers: { 'content-type': mime.lookup(fallback), },
              fallback: true,
            };
          }));
        } else {
          return reject(new Error(util.format(
            'HTTP %d - %s %s',
            res.statusCode, url, mime.lookup(url)
          )));
        }
      } else {
        // this shouldn't ever happen - error is handled above
        return reject(new Error('Unexpected error.'));
      }
    });
  });

  return cache[url];
};
