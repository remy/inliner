module.exports = uglify;

var debug = require('debug')('inliner');
var UglifyJS = require('uglify-js');

function uglify(source) {
  this.emit('progress', 'compressing javascript');
  if (source.body) {
    source = source.body;
  }

  // in case of local buffer
  source = source.toString();
  debug('uglifying %sbytes', source.length);

  return UglifyJS.minify(source, {
    fromString: true,
  }).code;
}