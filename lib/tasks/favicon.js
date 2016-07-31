module.exports = resolve;
var debug = require('debug')('inliner');
var basename = require('path').basename;

function resolve(inliner, todo, $) {
  debug('start %s favicon', todo.length);
  return todo.map(function links(link) {
    var url = inliner.resolve(inliner.url, $(link).attr('href'));
    inliner.emit('progress', 'processing favicon ' + basename(url));
    return inliner.image(url).then(function then(dataURL) {
      $(link).attr('href', dataURL);
    }).then(inliner.jobs.done.favicon);
  });
}
