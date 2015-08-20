#!/usr/bin/env node

var minimist = require('minimist');
var readFileSync = require('fs').readFileSync;

var argv = minimist(process.argv.slice(2), opts = {
  boolean: ['V', 'h', 'd', 'v', 'i', 'n',],
  string: ['e',],
  alias: {
    V: 'version',
    h: 'help',
    d: 'debug',
    v: 'verbose',
    i: 'images',
    n: 'nocompress',
    e: 'encoding',
  },
});

if (argv.debug) {
  require('debug').enable('inliner');
}

// checks for available update and returns an instance
var defaults = require('lodash.defaults');
var pkg = JSON.parse(readFileSync(__dirname + '/../package.json'));

require('update-notifier')({
  pkg: defaults(pkg, { version: '0.0.0' }),
}).notify();

var Inliner = require('../');
var url = argv._.shift();

var argvKeys = Object.keys(argv).filter(function filter(item) {
  return item !== '_';
});

if (!url && argvKeys.length === 0 || argv.help) {
  var usage = readFileSync(
    __dirname + '/../docs/usage.txt', 'utf8'
  );
  console.log(usage);
  process.exit(0);
}

if (argv.version) {
  console.log(pkg.version === '0.0.0' ? 'development' : pkg.version);
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
