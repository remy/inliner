var request = require('request');
var assign = require('lodash.assign');
var debug = require('debug')('inliner');

var cache = {};

module.exports = function get(url, options) {
  debug('request %s', url);

  var settings = assign({}, options, {
    followRedirect: true,
  });

  if (cache[url]) {
    return Promise.resolve(cache[url]);
  }

  return new Promise(function promise(resolve, reject) {
    request(url, settings, function response(error, res, body) {
      if (error) {
        debug('request failed: %s', error.message);
        return reject(error);
      }

      debug('response: %s %s', res.statusCode, url);
      if (!error && res.statusCode === 200) {
        cache[url] = { headers: res.headers, body: body };
        resolve(cache[url]);
      } else {
        return reject(new Error(res.statusCode));
      }
    });
  });
};