module.exports = uglify;

var UglifyJS = require('uglify-js');

function uglify(source) {
  this.emit('progress', 'compressing javascript');
  if (source.body) {
    source = source.body;
  }

  // in case of local buffer
  source = source.toString();

  return UglifyJS.minify(source, {
    fromString: true,
  }).code;
}