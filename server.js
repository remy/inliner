var URL = require('url'),
    Buffer = require('buffer').Buffer,
    jsdom = require("jsdom"),
    jsp = require("uglify-js").parse-js,
    pro = require("uglify-js").process,
    url = process.ARGV[2] || 'http://twitter.com/',
    oURL = URL.parse(url);

function resolveProtocol(url) {
  return url.indexOf('//') === 0 ? oURL.protocol + url : url;
}

function get(url, callback) {
  // url = resolveProtocol(url);
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
  // url = resolveProtocol(url);
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
      
      console.error('dataurl for ' + url + ': ' + data.length);
      
      callback(data);
    });
    response.on('data', function (chunk) {
      if (response.statusCode == 200) body += chunk;
    });
  });
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

jsdom.env(url, [
  'http://code.jquery.com/jquery-1.5.min.js'
], function(errors, window) {
  
  var todo = { scripts: true, images: true, links: true, styles: true },
      // todo = { styles: true },
      assets = {
        scripts: window.$('script[src]').filter(function () { return this.parentNode.lastChild !== this; }),
        images: window.$('img'),
        links: window.$('link[rel=stylesheet]'),
        styles: window.$('style'),
        
      },
      breakdown = {},
      items = 0,
      images = {};
  
  for (var key in todo) {
    if (todo[key] === true) {
      breakdown[key] = assets[key].length;
      items += assets[key].length;      
    }
  }
  
  function finished() {
    items--;
    if (items === 0) {
      window.$('script:last').remove();
      console.log(window.document.innerHTML);      
    } else if (items < 0) {
      console.log('something went wrong on finish');
    } else {
      // console.log('not finished: ' + items);
    }
    // console.dir(breakdown);
  }
  
  todo.images && assets.images.each(function () {
    var img = this;
    img2base64(URL.resolve(url, img.src), function (dataurl) {
      if (dataurl) images[img.src] = dataurl;
      img.src = dataurl;
      breakdown.images--;
      finished();
    });
  });
  
  todo.styles && assets.styles.each(function () {
    var style = this;
    getImagesFromCSS(url, this.innerHTML, function (css) {
      style.innerHTML = css;
      breakdown.styles--;
      finished();
    });
  });
  
  todo.links && assets.links.each(function () {
    var link = this;
    // console.log('link: ' + link.href);
    get(link.href, function (css) {
      getImagesFromCSS(link.href, css, function (css) {
        // console.log(css);
        breakdown.links--;
        window.$(link).replaceWith('<style>' + css + '</style>');
        finished();
      });
    });
  });
  
  // basically this is the jQuery instance we tacked on to the request,
  // but we're just being extra sure before we do zap it out  
  todo.scripts && assets.scripts.each(function () {
    var $script = window.$(this),
        scriptURL = URL.resolve(url, this.src);

    if (scriptURL.indexOf('google-analytics.com') !== -1) { // ignore google
      breakdown.scripts--;
      finished();      
    } else {
      get(scriptURL, function (data) {

        var orig_code = data;
        var ast = jsp.parse(orig_code); // parse code and get the initial AST
        ast = pro.ast_mangle(ast); // get a new AST with mangled names
        ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
        var final_code = pro.gen_code(ast); // compressed code here
        
        $script.removeAttr('src').text(final_code);
        $script.before('<!-- ' + scriptURL + ' -->');
        breakdown.scripts--;
        finished();
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
   *  6. compress CSS
   *  7. compress HTML (/>\s+</g, '> <');
   * 
   *  FUTURE ITEMS:
   *  - support for @import
   *  - support for media queries - important!
   *  - compression options
   *  - javascript validation - i.e. not throwing errors
   */
});