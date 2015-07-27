module.exports = uglify;

var UglifyJS = require('uglify-js');

function uglify(source) {
  this.emit('progress', 'compressing javascript');
  if (source.body) {
    source = source.body;
  }
  return UglifyJS.minify(source, {
    fromString: true,
  }).code;
}