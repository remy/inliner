module.exports = resolve;
var debug = require('debug')('inliner');

function resolve(inliner, todo, $) {
  debug('start %s links', todo.length);
  return todo.map(function images(image) {
    var url = inliner.resolve(inliner.url, $(image).attr('src'));
    return inliner.image(url).then(function then(dataURL) {
      $(image).attr('src', dataURL);
    }).then(inliner.jobs.done.images);
  });
}

