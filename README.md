# Inliner

Turns your web page to a single HTML file with everything inlined - perfect for appcache manifests on mobile devices that you want to reduce those http requests.

![](https://img.shields.io/github/workflow/status/tauri-apps/tauri-inliner/test%20library?label=test%20library

## What it does
- Get a list of all the assets required to drive the page: CSS, JavaScript, images, videos and images used in CSS
- Minify JavaScript (via [uglify-js](https://github.com/mishoo/UglifyJS "mishoo/UglifyJS - GitHub"))
- Strips white from CSS
- Base64 encode images and videos
- Puts everything back together as a single HTML file with a simplified doctype

## Installation
Install the `inliner` utility via [npm](http://npmjs.org):

    $ npm install -g tauri-inliner
    $ yarn global add tauri-inliner

You can also consume it in your projects locally, which is actually recommended for keeping up with latest versions.

    $ npm install --save-dev @tauri-apps/tauri-inliner
    $ yarn add --dev @tauri-apps/tauri-inliner

## Usage
If you have either installed via npm or put the inliner bin directory in your path, then you can use inliner via the command line as per:

    inliner https://tauri.studio

This will output the inlined markup with default options. You can see more options on how to disable compression or how not to base64 encode images using the help:

    tauri-inliner --help
    yarn tauri-inliner --help

To use inline inside your own script:

    var Inliner = require('inliner');

    new Inliner('https://tauri.studio', function (error, html) {
      // compressed and inlined HTML page
      console.log(html);
    });

Or:

    var inliner = new Inliner('https://tauri.studio');

    inliner.on('progress', function (event) {
      console.error(event);
    }).on('end', function (html) {
      // compressed and inlined HTML page
      console.log(html);
    });

Once you've inlined the contents of the page, you can optionally configure a [service worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) to add advanced caching and offline functionality.

## Support

- Collapses all white space in HTML (except inside `<pre>` elements)
- Strips all HTML comments
- Pulls JavaScript and CSS inline to HTML
- Compresses JavaScript via uglify (if not compressed already)
- Converts all images and videos to based64 data urls, inline images, video poster images and CSS images
- Imports all @import rules from CSS (recusively)
- Applies media query rules (for print, tv, etc media types)
- Leaves conditional comments in place
- If JavaScript can't be imported (or is Google Analytics), source is not put inline

## Limitations / Caveats

- Whitespace compression might get a little heavy handed - all whitespace is collapsed from `n` spaces to 1 space.

## Filing issues & PRs

Please see the [contributing](https://github.com/tauri-apps/tauri/blob/dev/.github/CONTRIBUTING.md) for guidelines.
