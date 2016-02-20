module.exports = resolve;
var debug = require('debug')('inliner');

function resolve(inliner, todo, $) {
  debug('start %s videos', todo.length);
  return todo.map(function videos(video) {
    var url = inliner.resolve(inliner.url, $(video).attr('src'));
    var posterUrl = inliner.resolve(inliner.url, $(video).attr('poster'));

    if (inliner.options.noremote &&
	(url.indexOf('//') === 0 || url.indexOf('http') === 0)) {
        debug('skipping remote video');
        inliner.emit('progress', 'skipping remote video');
        return false;
    }

    return Promise.all([
      inliner.image(url).then(function then(dataURL) {
        $(video).attr('src', dataURL);
      }),
      inliner.image(posterUrl).then(function then(dataURL) {
        $(video).attr('poster', dataURL);
      }),
    ]).then(inliner.jobs.done.videos);
  });
}

