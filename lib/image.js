module.exports = image;

var debug = require('debug')('inliner');

function image(url) {
  url = url.replace(/#.*$/, '');
  this.emit('progress', 'get image ' + url);

  // Return a dictionary with the base64-encoded image and a hint
  // whether  the fallback image has been used.
  return this.get(url, { encoding: 'binary' }).then(function then(res) {
    if (url.indexOf('data:') === 0) {
      return { url: url, fallback: false, };
    }

    debug('image loaded: %s', url);
    var buffer = new Buffer(res.body, 'binary').toString('base64');
    return {
      url: 'data:' + res.headers['content-type'] + ';base64,' + buffer,
      fallback: res.fallback,
    }
  }).catch(function errorHandle(error) {
    debug('image %s failed to load', url, error);
    throw error;
  });
}
