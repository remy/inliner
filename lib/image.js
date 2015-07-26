module.exports = image;

var get = require('./get');
var debug = require('debug')('inliner');

function image(url) {
  return get(url, { encoding: 'binary' }).then(function then(res) {
    debug('image loaded: %s', url);
    var buffer = new Buffer(res.body, 'binary').toString('base64');
    return 'data:' + res.headers['content-type'] + ';base64,' + buffer;
  }).catch(function errorHandle(error) {
    debug('image %s failed to load', url, error);
    throw error;
  });
}