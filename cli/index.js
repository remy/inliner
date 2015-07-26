#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2), {
  alias: {
    V: 'version',
    h: 'help',
    d: 'debug',
    v: 'verbose',
    i: 'images',
    n: 'nocompress',
  },
});

if (argv.debug) {
  require('debug').enable('inliner');
}

var Inliner = require('../');

// checks for available update and returns an instance
// var updateNotifier = require('update-notifier');
// var pkg = require('../package.json');
// var notifier = updateNotifier({ pkg: pkg });
// if (notifier.update) {
//   // notify using the built-in convenience method
//   notifier.notify();
// }

var url = argv._.shift();

var argvKeys = Object.keys(argv).filter(function (item) {
  return item !== '_';
});

if (!url && argvKeys.length === 0 || argv.help) {
  // show USAGE!
  console.log('  Examples:');
  console.log('');
  console.log('    $ inliner -v http://twitter.com > twitter.html');
  console.log('    $ inliner -ni http://twitter.com > twitter.html');
  console.log('');
  console.log('  For more details see http://github.com/remy/inliner/');
  console.log('');
  process.exit(0);
}

if (argv.version) {
  console.log(Inliner.version);
}

var options = Inliner.defaults();

if (argv.nocompress) {
  options.compressCSS = false;
  options.collapseWhitespace = false;
}

options.images = !argv.images;

var inliner = new Inliner(url, argv, function result(error, html) {
  if (error) {
    var message = Inliner.errors[error.code] || error.message;
    console.error(message);

    if (argv.debug) {
      console.error(error.stack);
    }

    process.exit(1);
  }
  console.log(html);
});

if (argv.verbose) {
  inliner.on('progress', function progress(event) {
    console.error(event);
  });

  inliner.on('jobs', function jobs(event) {
    console.error(event);
  });
}