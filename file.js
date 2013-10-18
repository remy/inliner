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
  console.error(options.path);
  fs.readFile(options.path, function(err, data){
    if(err) {
      response.statusCode = 404;
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
