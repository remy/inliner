module.exports = image;

var debug = require('debug')('inliner');
var mime = require('mime');
var SVGO = require('svgo');
var svgo = new SVGO();
var basename = require('path').basename;
var Promise = require('es6-promise').Promise; // jshint ignore:line

function image(url) {
  url = url.replace(/\??#.*$/, '');
  var inliner = this;
  this.emit('progress', 'get image ' + basename(url));
  return this.get(url, { encoding: 'binary' }).then(function then(res) {
    if (url.indexOf('data:') === 0) {
      return url;
    }

    debug('image loaded: %s', url);

    // if the url is SVG, let's compress and use the XML directly
    if (res.body && mime.lookup(url) === 'image/svg+xml' &&
      !inliner.options.nosvg) {
      return new Promise(function (resolve, reject) {
        svgo.optimize(res.body.toString(), function (result) {
          debug('optimising svg');
          if (result.error) {
            debug('errored', result.error);
            return reject(new Error(result.error));
          }
          var replacements = {
            '<': '%3C',
            '>': '%3E',
            '"': '%22',
            '\'': '%27',
          };
          var body = result.data.replace(/["'<>]/g, function (m) {
            return replacements[m];
          });
          resolve('data:image/svg+xml;utf8,' + body);
        });
      });
    }

    // otherwise we base64 encode the image
    return 'data:' + res.headers['content-type'] + ';base64,' +
            new Buffer(res.body, 'binary').toString('base64');

  }).catch(function errorHandle(error) {
    debug('image %s failed to load', url, error);
    throw error;
  });
}
