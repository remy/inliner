var match = /url\((?:['"]*)(?!['"]*data:)(.*?)(?:['"]*)\)/g;

module.exports = {
  load: load,
  compress: compress,
  getImages: getImages,
  getImports: getImports,
  match: match,
};

var Promise = require('es6-promise').Promise; // jshint ignore:line
var debug = require('debug')('inliner');

function load(url) {
  var inliner = this;
  inliner.jobs.add('link');
  return inliner.get(url).then(function then(res) {
    debug('css loaded: %s', url);
    inliner.jobs.done.links();
    return res.body;
  }).catch(function errorHandle(error) {
    debug('css %s failed to load', url, error);
    throw error;
  });
}

function getImages(css) {
  var inliner = this;
  var singleURLMatch = /url\(\s*(?:['"]*)(?!['"]*data:)(.*?)(?:['"]*)\s*\)/;
  var matches = css.match(match) || [];
  var images = matches.map(function eachURL(url) {
    var source = url.match(singleURLMatch)[1];
    return {
      source: source,
      resolved: inliner.resolve(source),
    };
  });

  debug('adding %s CSS assets', images.length);
  inliner.jobs.add('image', images.length);

  return Promise.all(images.map(function map(url) {
    return inliner.image(url.resolved).then(function then(dataURL) {
      inliner.jobs.done.images();
      debug('CSS url %s', url.source);
      css = css.replace(new RegExp(url.source, 'g'), function replace() {
        return dataURL;
      });
      return css;
    });
  })).then(function then() {
    return css;
  });
}

function getImports(root, css) {
  var position = css.indexOf('@import');
  var inliner = this;

  if (position !== -1) {
    inliner.jobs.add('link', 1);
    var match = (css.match(/@import\s*(.*)/) || [null, ''])[1];
    var url = match.replace(/url/, '')
      .replace(/['}"()]/g, '')
      .replace(/;/, '')
      .trim()
      .split(' '); // clean up

    // if url has a length > 1, then we have media types to target
    var resolvedURL = inliner.resolve(root, url[0]);
    return inliner.get(resolvedURL).then(function then(res) {
      var importedCSS = res.body;
      inliner.jobs.done.links();
      inliner.emit('progress', 'import ' + resolvedURL);
      if (url.length > 1) {
        url.shift();
        importedCSS = '@media ' + url.join(' ') + '{' + importedCSS + '}';
      }

      css = css.replace('@import ' + match, importedCSS);
      return getImports.call(inliner, root, css);
    });
  } else {
    if (inliner.options.compressCSS) {
      css = compress(css);
    }
    return Promise.resolve(css);
  }
}

function compress(css) {
  return css
    .replace(/\s+/g, ' ')
    .replace(/:\s+/g, ':')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/\} /g, '}')
    .replace(/ \{/g, '{')
    // .replace(/\{ /g, '{')
    .replace(/; /g, ';')
    .replace(/\n+/g, '');
}