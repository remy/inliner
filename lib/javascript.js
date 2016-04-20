module.exports = uglify;

var debug = require('debug')('inliner');
var UglifyJS = require('uglify-js');

function uglify(source) {
  this.emit('progress', 'compressing javascript');

  source = source.trim();

  if (source === '') {
    this.jobs.done.js();
    return '';
  }

  debug('uglifying %sbytes', source.length);

  var result = '';

  try {
    result = UglifyJS.minify(source, {
      fromString: true,
    }).code;
  } catch (e) {
    // failed to uglify, just return it plain
    result = source;
  }

  this.jobs.done.js();

  return result;
}
