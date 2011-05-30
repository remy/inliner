# Inliner

Turns your web page to a single HTML file with everything inlined - perfect for appcache manifests on mobile devices that you want to reduce those http requests.

## What it does

- Get a list of all the assets required to drive the page: CSS, JavaScript, images and images used in CSS
- Minify JavaScript (via [uglify-js](https://github.com/mishoo/UglifyJS "mishoo/UglifyJS - GitHub"))
- Strips white from CSS
- Base64 encode images
- Puts everything back together as a single HTML file with a simplfied doctype

## Installation

Check out a working copy of the source code with [Git](http://git-scm.com), or install `inliner` via [npm](http://npmjs.org) (the recommended way). The latter will also install `inliner` into the system's `bin` path.

    $ git clone https://github.com/remy/inliner.git
    $ npm install inliner -g
    
`inliner` uses a `package.json` to describe the dependancies, and if you install via a github clone, ensure you run `npm install` from the `inliner` directory to install the dependancies (or manually install [jsdom](https://github.com/tmpvar/jsdom "tmpvar/jsdom - GitHub") and [uglify-js](https://github.com/mishoo/UglifyJS "mishoo/UglifyJS - GitHub")).

## Usage

### via npm

If you installed via npm, then you can use inliner via the command line as per:

    inliner http://remysharp.com

This will output the inlined markup.  You can easily save this to a new file for testing:

    inliner http://remysharp.com > remysharp.html

To use inline inside your script:

    var inliner = require('inliner');

    inliner('http://remysharp.com', function (html) {
      // compressed and inlined HTML page
      console.log(html);
    });

Note that if you include the inliner script via a git submodule, it requires jsdom to be installed via `npm install jsdom`, otherwise you should be good to run.

I plan to include a web service at some point, but obviously this won't be able to access localhost domains.

Once you've inlined the crap out of the page, add the `manifest="self.appcache"` to the `html` tag and create an empty file called self.appcache ([read more](http://remysharp.com/2011/01/31/simple-offline-application/)).

## Support

- Collapses all white space in HTML
- Strips all HTML comments
- Pulls JavaScript and CSS inline to HTML
- Compresses JavaScript via uglify (if not compressed already)
- Converts all images to based64 data urls, both inline images and CSS images
- Imports all @import rules from CSS (recusively)
- Applies media query rules (for print, tv, etc media types)
- Leaves conditional comments in place
- If JavaScript can't be imported (or is Google Analytics), source is not put inline

## Limitations / Caveats

- Whitespace compression might get a little heavy handed - all whitespace is collapsed from n spaces to one space.
- Compresses whitespace inside of `<pre>` elements
  