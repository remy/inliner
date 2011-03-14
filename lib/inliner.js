var URL = require('url'),
    Buffer = require('buffer').Buffer,
    jsdom = require('jsdom'),
    jsp = require('./uglify-js/lib/parse-js'),
    pro = require('./uglify-js/lib/process');

function get(url, callback) {
  var oURL = URL.parse(url),
      http = require('http'),
      client = http.createClient(80, oURL.hostname),
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
  
}

function img2base64(url, callback) {
  var oURL = URL.parse(url),
      http = require('http'),
      client = http.createClient(80, oURL.hostname),
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
      urlMatch = /url\((?:['"]*)(.*?)(?:['"]*)\)/g,
      singleURLMatch = /url\((?:['"]*)(.*?)(?:['"]*)\)/,
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

var inliner = module.exports = function (url, options, callback) {
  
  if (typeof options == 'function') {
    callback = options;
    options = { compressCSS: true, collapseWhitespace: true };
  }
  
  jsdom.env(url, [
    'http://code.jquery.com/jquery-1.5.min.js'
  ], function(errors, window) {

    var todo = { scripts: true, images: true, links: true, styles: true },
        assets = {
          scripts: window.$('script[src]').filter(function () { return this.parentNode.lastChild !== this; }),
          images: window.$('img'),
          links: window.$('link[rel=stylesheet]'),
          styles: window.$('style')
        },
        breakdown = {},
        items = 0,
        images = {};

    for (var key in todo) {
      if (todo[key] === true && assets[key]) {
        breakdown[key] = assets[key].length;
        items += assets[key].length;      
      }
    }

    function finished() {
      if (items === 0) {
        window.$('script:last').remove();
        // collapse the white space
        var html = window.document.innerHTML;
        if (options.collapseWhitespace) html = html.replace(/\s+/g, ' ');
        // console.log(html);
        callback('<!DOCTYPE html>' + html);
      } else if (items < 0) {
        console.log('something went wrong on finish');
      } 
      
      items--;
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
      var link = this;
      // console.log('link: ' + link.href);
      get(link.href, function (css) {
        getImagesFromCSS(link.href, css, function (css) {
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
            var orig_code = this.innerHTML,
                ast = jsp.parse(orig_code); // parse code and get the initial AST

            ast = pro.ast_mangle(ast); // get a new AST with mangled names
            ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
            var final_code = pro.gen_code(ast);

            // some protection against putting script tags in the body
            final_code = final_code.replace(/<\/script>/gi, '<\\/script>');

            window.$(this).text(final_code);
        });
        items -= assets.scripts.length;
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
          $script.removeAttr('src').text(data);
          // $script.before('<!-- ' + scriptURL + ' -->');
          breakdown.scripts--;
          scriptsFinished();
        });      
      }
    });

    // console.log($scripts[$scripts.length - 1].parentNode.lastChild == $scripts[$scripts.length - 1]);

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
}

inliner.vesion = '0.0.1';