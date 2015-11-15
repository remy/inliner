#!/usr/bin/env node

var readFileSync = require('fs').readFileSync;
var Promise = require('es6-promise').Promise; // jshint ignore:line

main();

function main() {
  var argv = require('./options')(process.argv.slice(2));

  if (argv.debug) {
    require('debug').enable('inliner');
  }

  var url = argv._.shift();

  if (argv.version) {
    console.log(require('../package.json').version || 'development');
    process.exit(0);
  }

  if ((!url && !argv.useStdin) || argv.help) {
    var usage = readFileSync(
      __dirname + '/../docs/usage.txt', 'utf8'
    );
    console.log(usage);
    process.exit(0);
  }

  var Inliner = require('../');

  var p = Promise.resolve(url);

  if (argv.useStdin) {
    p = new Promise(function (resolve) {
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      var data = '';

      process.stdin.on('data', function(chunk) {
        data += chunk;
      });

      process.stdin.on('end', function() {
        resolve(data);
      });
    });
  }

  p.then(function (source) {
    var inliner = new Inliner(source, argv, function result(error, html) {
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

    return inliner;
  }).then(function (inliner) {
    // checks for available update and returns an instance
    // note: we're doing this after we kick off inliner, since there's a
    // noticeable lag in boot because of it
    var defaults = require('lodash.defaults');
    var pkg = JSON.parse(readFileSync(__dirname + '/../package.json'));

    require('update-notifier')({
      pkg: defaults(pkg, { version: '0.0.0' }),
    }).notify();

    inliner.on('warning', function progress(event) {
      console.warn('warning: ' + event);
    });

    if (argv.verbose) {
      inliner.on('progress', function progress(event) {
        console.error(event);
      });

      inliner.on('jobs', function jobs(event) {
        console.error(event);
      });
    }
  });

}