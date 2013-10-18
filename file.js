/*
 * Implments file: protocol URI request.
 */

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

module.exports.request = function(options) {
  var ret = new EventEmitter();
  ret.end = function(){};
  var response = new EventEmitter();
  response.headers = {};
  response.headers['content-type'] = '';
  response.setEncoding = function(){};
  //uri parser seems to leave a trailing ?
  if(options.path.slice(-1) == '?') {
    options.path = options.path.slice(0, options.path.length-1);
  }
  fs.readFile(options.path, function(err, data){
    if(err) {
      console.error(options);
      ret.emit('error', err);
    } else {
      response.statusCode = 200;
      ret.emit('response', response);
      response.emit('data', data);
      response.emit('end');
    }
  });
  return ret;
}
