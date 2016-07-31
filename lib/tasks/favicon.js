module.exports = resolve;
var debug = require('debug')('inliner');
var parse = require('path').parse;

function resolve(inliner, todo, $) {
  debug('start %s favicon', todo.length);
  return todo.map(function links(link) {
    var url = inliner.resolve(inliner.url, $(link).attr('href'));
    inliner.emit('progress', 'processing favicon ' + parse(url).base);
    return inliner.image(url).then(function then(dataURL) {
      $(link).attr('href', dataURL);
    }).then(inliner.jobs.done.favicon);
  });
}
