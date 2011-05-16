var URL = require('url'),
    Buffer = require('buffer').Buffer,
    jsdom = require('jsdom'),
    jsp = require('uglify-js/lib/parse-js'),
    pro = require('uglify-js/lib/process');

function get(url, callback) {
  var oURL = URL.parse(url),
      http = require('http'),
      client = http.createClient(oURL.port || 80, oURL.hostname),
      request = client.request('GET', oURL.pathname, {'host': oURL.hostname});

  request.end();
  request.on('response', function (response) {
    var body = "";

    response.on('end', function () {
      callback && callback(body);
    });
    response.on('data', function (chunk) {
      if (response.statusCode == 200) body += chunk;
    });
  });

  debugger;
}

function img2base64(url, callback) {
  var oURL = URL.parse(url),
      http = require('http'),
      client = http.createClient(oURL.port || 80, oURL.hostname),
      request = client.request('GET', oURL.pathname, {'host': oURL.hostname});

  request.end();
  request.on('response', function (response) {
    var type = response.headers["content-type"],
        prefix = "data:" + type + ";base64,",
        body = "";

    response.setEncoding('binary');
    response.on('end', function () {
      var base64 = new Buffer(body, 'binary').toString('base64'),
          data = prefix + base64;
      
      // console.error('dataurl for ' + url + ': ' + data.length);
      
      callback(data);
    });
    response.on('data', function (chunk) {
      if (response.statusCode == 200) body += chunk;
    });
  });
}

function compressCSS(css) {
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

function getImagesFromCSS(rooturl, rawCSS, callback) {
  var images = {},
      urlMatch = /url\((?:['"]*)(?!['"]*data:)(.*?)(?:['"]*)\)/g,
      singleURLMatch = /url\((?:['"]*)(?!['"]*data:)(.*?)(?:['"]*)\)/,
      matches = rawCSS.match(urlMatch),
      imageCount = matches === null ? 0 : matches.length; // TODO check!
  
  function checkFinished() {
    if (imageCount < 0) {
      console.log('something went wrong :-S');
    } else if (imageCount == 0) {
      callback(rawCSS.replace(urlMatch, function (m, url) {
        return 'url(' + images[url] + ')';
      }));
    }
  }
  
  if (imageCount) {
    matches.forEach(function (url) {
      url = url.match(singleURLMatch)[1];
      var resolvedURL = URL.resolve(rooturl, url);
      if (images[url] === undefined) {
        img2base64(resolvedURL, function (dataurl) {
          imageCount--;
          if (images[url] === undefined) images[url] = dataurl;
          checkFinished();
        });
      } else {
        imageCount--;
        checkFinished();
      }
    });
  } else {
    callback(rawCSS);
  }
}

function removeComments(element) {
  var nodes = element.childNodes,
      i = nodes.length;
  
  while (i--) {
    if (nodes[i].nodeName === '#comment') {
      element.removeChild(nodes[i]);
    }
    removeComments(nodes[i]);
  }
}

var inliner = module.exports = function (url, options, callback) {
  
  if (typeof options == 'function') {
    callback = options;
    options = { compressCSS: true, collapseWhitespace: true };
  }
  
  jsdom.env(url, [
    'http://code.jquery.com/jquery-1.5.min.js'
  ], function(errors, window) {
    // remove jQuery that was included with jsdom
    window.$('script:last').remove();

    var todo = { scripts: true, images: true, links: true, styles: true },
        assets = {
          scripts: window.$('script[src]'),
          images: window.$('img').filter(function(){ return this.src.indexOf('data:') == -1; }),
          links: window.$('link[rel=stylesheet]'),
          styles: window.$('style')
        },
        breakdown = {},
        images = {};

    for (var key in todo) {
      if (todo[key] === true && assets[key]) {
        breakdown[key] = assets[key].length;
      }
    }

    function finished() {
      var items = 0;
      for (var key in breakdown) {
        items += breakdown[key];
      }

      if (items === 0) {
        // manually remove the comments
        var els = removeComments(window.document.documentElement);
        
        // collapse the white space
        var html = window.document.innerHTML;
        if (options.collapseWhitespace) html = html.replace(/\s+/g, ' ');
        // console.log(html);
        callback('<!DOCTYPE html>' + html);
      } else if (items < 0) {
        console.log('something went wrong on finish');
        console.dir(breakdown);
      } 
    }

    todo.images && assets.images.each(function () {
      var img = this;
      img2base64(URL.resolve(url, img.src), function (dataurl) {
        if (dataurl) images[img.src] = dataurl;
        img.src = dataurl;
        breakdown.images--;
        // console.log('images finished');
        finished();
      });
    });

    todo.styles && assets.styles.each(function () {
      var style = this;
      getImagesFromCSS(url, this.innerHTML, function (css) {
        style.innerHTML = css;
        breakdown.styles--;
        // console.log('style finished');
        finished();
      });
    });

    todo.links && assets.links.each(function () {
      var link = this,
          linkURL = URL.resolve(url, link.href);

      get(linkURL, function (css) {
        getImagesFromCSS(linkURL, css, function (css) {
          if (options.compressCSS) css = compressCSS(css);
          breakdown.links--;
          
          var style = '',
              media = link.getAttribute('media');
          if (false && media) {
            style = '<style>@media ' + media + '{' + css + '}</style>';
          } else {
            style = '<style>' + css + '</style>';
          }
          
          window.$(link).replaceWith(style);
          // console.log('link finished');
          finished();
        });
      });
    });

    function scriptsFinished() {
      if (breakdown.scripts == 0) {
        // now compress the source JavaScript
        assets.scripts.each(function () {
          var $script = window.$(this),
              src = $script.attr('src'),
              orig_code = this.innerHTML;

          $script.removeAttr('src');

          // don't compress already minified code
          if(!/\bmin\b/.test(src)) { 
            var ast = jsp.parse(orig_code); // parse code and get the initial AST

            ast = pro.ast_mangle(ast); // get a new AST with mangled names
            ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
            var final_code = pro.gen_code(ast);

            // some protection against putting script tags in the body
            final_code = final_code.replace(/<\/script>/gi, '<\\/script>');

            window.$(this).text(final_code);
          }
        });
        finished();
      }
    }

    // basically this is the jQuery instance we tacked on to the request,
    // but we're just being extra sure before we do zap it out  
    todo.scripts && assets.scripts.each(function () {
      var $script = window.$(this),
          scriptURL = URL.resolve(url, this.src);

      if (scriptURL.indexOf('google-analytics.com') !== -1) { // ignore google
        breakdown.scripts--;
        scriptsFinished();
      } else {
        get(scriptURL, function (data) {
          $script.text(data);
          // $script.before('<!-- ' + scriptURL + ' -->');
          breakdown.scripts--;
          scriptsFinished();
        });      
      }
    });

    // edge case - if there's no images, nor scripts, nor links - we call finished manually
    if (assets.links.length == 0 && 
        assets.styles.length == 0 && 
        assets.images.length == 0 && 
        assets.scripts.length == 0) {
      finished();
    }

    /** Inliner jobs:
     *  1. get all inline images and base64 encode
     *  2. get all external style sheets and move to inline
     *  3. get all image references in CSS and base64 encode and replace urls
     *  4. get all external scripts and move to inline
     *  5. compress JavaScript
     *  6. compress CSS & support media queries
     *  7. compress HTML (/>\s+</g, '> <');
     * 
     *  FUTURE ITEMS:
     *  - support for @import
     *  - javascript validation - i.e. not throwing errors
     */
  });
};

inliner.version = JSON.parse(require('fs').readFileSync('package.json').toString()).version;

if (!module.parent) {
  if (process.argv[2] === undefined) {
    console.log('Usage: inliner http://yoursite.com\ninliner will output the inlined HTML, CSS, images and JavaScript');
    process.exit();
  }

  inliner(process.argv[2], function (html) {
    console.log(html);
  });
}