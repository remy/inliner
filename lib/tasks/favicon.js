module.exports = resolve;
var debug = require('debug')('inliner');

function resolve(inliner, todo, $) {
  debug('start %s favicon', todo.length);
  return todo.map(function links(link) {
    inliner.emit('progress', 'processing favicon ' + url);
    var url = inliner.resolve(inliner.url, $(link).attr('href'));
    return inliner.image(url).then(function then(dataURL) {
      $(link).attr('href', dataURL);
    }).then(inliner.jobs.done.favicon);
  });
}
