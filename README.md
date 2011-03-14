# Inliner

Turns your web page to a single HTML file with everything inlined - perfect for appcache manifests on mobile devices that you want to reduce those http requests.

## What it does

- Get a list of all the assets required to drive the page: CSS, JavaScript, images and images used in CSS
- Minify JavaScript (via [uglify-js](https://github.com/mishoo/UglifyJS "mishoo/UglifyJS - GitHub"))
- Strips white from CSS
- Base64 encode images
- Puts everything back together as a single HTML file with a simplfied doctype

## Usage

    var inliner = require('./inliner').inliner;

	inliner('http://remysharp.com', function (html) {
	  // compressed and inlined HTML page
	  console.log(html);
	});

I plan to include a web service at some point, but obviously this won't be able to access localhost domains.

Once you've inlined the crap out of the page, add the `manifest="self.appcache"` to the `html` tag and create an empty file called self.manifest ([read more](http://remysharp.com/2011/01/31/simple-offline-application/)).

## Limitations / Caveats

- Whitespace compression might get a little heavy handed - all whitespace is collapsed from n spaces to one space.
- Doesn't support @import rules in CSS
- I've not tested it much (yet)! :)
- It was written in about 2 hours or so, so the code is a little messy, sorry!