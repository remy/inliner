module.exports = resolve;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var debug = require('debug')('inliner');

function resolve(inliner, todo, $) {
  debug('start %s scripts', todo.length);
  return todo.map(function scripts(script) {
    var $script = $(script);
    var src = $script.attr('src');
    var source = $script.text();

    var promise;
    var isMinified = false;

    // ext script
    if (src) {
      isMinified = src.indexOf('.min.') !== -1;
      if (isMinified && !inliner.options.inlinemin) {
        debug('skipping pre-minified script');
        inliner.emit('progress', 'skipping minified script ' + src);
        // ignore scripts with .min. in them - i.e. avoid minify
        // scripts that are already minifed
        return false;
      } else if (src.indexOf('google-analytics') !== -1) {
        debug('skipping analytics');
        inliner.emit('progress', 'skipping analytics script');
        // ignore analytics
        return false;
      }

      $script.removeAttr('src');
      var url = src;
      if (url.indexOf('http') !== 0) {
        url = inliner.resolve(inliner.url, url);
      }

      promise = inliner.get(url).then(function (data) {
        debug('ret from inliner.get');
        return data;
      });
    } else {
      inliner.emit('progress', 'processing inline script');
      promise = Promise.resolve({
        body: source,
      });
    }

    promise = promise.then(function then(res) {
      if (res.body !== undefined) {
        res = res.body;
      }
      // in case of local buffer
      return res.toString();
    });

    if (inliner.options.compressJS && !isMinified) {
      promise = promise.then(inliner.uglify.bind(inliner));
    }

    return promise.then(function then(res) {
      // remove ETAGO (https://mathiasbynens.be/notes/etago)
      res = res.replace(/<\/script/gi, '<\\/script');
      $script.text(res);
    });
  }).filter(Boolean);
}
