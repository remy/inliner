#!/usr/bin/env node

var alias = {
  V: 'version',
  h: 'help',
  d: 'debug',
  v: 'verbose',
  i: 'images',
  n: 'nocompress',
};

var argv = process.argv.slice(2).reduce(function reduce(acc, arg) {
  if (arg.indexOf('-') === 0) {
    arg = arg.slice(1);

    if (alias[arg] !== undefined) {
      acc[alias[arg]] = true;
    } else if (arg.indexOf('-') === 0) {
      acc[arg.slice(1)] = true;
    } else {
      acc[arg] = true;
    }
  } else {
    acc._.push(arg);
  }

  return acc;
}, { _: [] });

if (argv.debug) {
  require('debug').enable('inliner');
}

// checks for available update and returns an instance
var updateNotifier = require('update-notifier');
var pkg = require(__dirname + '/../package.json');
var notifier = updateNotifier({ pkg: pkg });
if (notifier.update) {
  // notify using the built-in convenience method
  notifier.notify();
}

var Inliner = require('../');
var url = argv._.shift();

var argvKeys = Object.keys(argv).filter(function filter(item) {
  return item !== '_';
});

if (!url && argvKeys.length === 0 || argv.help) {
  // show USAGE!
  console.log(require('fs').readFileSync(__dirname + '/../docs/usage.txt', 'utf8'));
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