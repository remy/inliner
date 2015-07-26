module.exports = findAssets;

var cheerio = require('cheerio');

function findAssets(html) {
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