module.exports = resolve;
var debug = require('debug')('inliner');

function resolve(inliner, todo, $) {
  debug('start %s links', todo.length);
  return todo.map(function links(link) {
    var url = $(link).attr('href');
    if (url.indexOf('http') !== 0) {
      url = inliner.resolve(inliner.url, url);
    }
    inliner.emit('progress', 'processing external css ' + url);
    return inliner.get(url).then(function then(res) {
      var css = res.body;
      inliner.jobs.done.links();
      return inliner.cssImports(url, css)
        .then(inliner.cssImages.bind(inliner, url));
    }).then(function then(css) {
      $(link).replaceWith('<style>' + css + '</style>');
    });
  });
}