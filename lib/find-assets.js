module.exports = findAssets;

var cheerio = require('cheerio');
var debug = require('debug')('inliner');

function findAssets(html) {
  debug('loading DOM');
  var $ = cheerio.load(html);


  var images = $('img');
  var links = $('link[rel=stylesheet]');
  var styles = $('style');
  var scripts = $('script');

  return {
    $: $,
    images: images,
    links: links,
    styles: styles,
    js: scripts,
  };
}