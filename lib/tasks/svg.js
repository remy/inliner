module.exports = resolve;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var debug = require('debug')('inliner');
var SVGO = require('svgo');
var svgo = new SVGO();

function resolve(inliner, todo, $) {
  debug('start %s svg', todo.length, !!$);
  return todo.map(function (svg) {
    if (inliner.options.nosvg) {
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      var $svg = $(svg);
      var source = $svg.html();

      debug('optimising svg');

      // reconstruct the SVG element outer tag
      var top = '<svg ' + Object.keys(svg.attribs).reduce(function (acc, curr) {
        acc.push(curr + '="' + svg.attribs[curr] + '"');
        return acc;
      }, []).join(' ') + '>';

      source = top + source + '</svg>';

      svgo.optimize(source, function (result) {
        if (result.error) {
          debug('svg failed', result.error);
          return;
        }
        debug('optimised again');

        $svg.replaceWith(result.data);
      });

      resolve();
    });

  });
}