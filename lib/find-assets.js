module.exports = findAssets;

var cheerio = require('cheerio');
var debug = require('debug')('inliner');

function findAssets(html, cheerioLoadOptions) {
  var $ = cheerio.load(html, cheerioLoadOptions);
  debug('loaded DOM');


  var images = $('img');
  var links = $('link[rel=stylesheet]');
  var styles = $('style');
  var scripts = $('script');

  return {
    $: $,
    images: images,
    links: links,
    styles: styles,
    scripts: scripts,
  };
}
