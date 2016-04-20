#!/usr/bin/env node

var readFileSync = require('fs').readFileSync;
var Promise = require('es6-promise').Promise; // jshint ignore:line
var ansi = require('ansi-escapes');

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

      process.stdin.on('data', function (chunk) {
        data += chunk;
      });

      process.stdin.on('end', function () {
        resolve(data);
      });
    });
  }

  var time = process.hrtime();
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

    if (argv.verbose) {
      var styles = require('ansi-styles');
      console.warn(ansi.cursorHide + '\n\n' + ansi.cursorUp() +
        ansi.cursorSavePosition);

      var jobs = {};
      var progress = '';
      var update = function () {
        var remaining = jobs.breakdown.join(', ');
        if (remaining) {
          remaining = ' remaining: ' + remaining;
        }

        var str = styles.green.open +
          (100 - (jobs.todo / jobs.total * 100 | 0)) + '%' +
          styles.green.close +
          remaining +
          styles.gray.open +
          '\nLast job: ' + progress +
          styles.gray.close;

        process.stderr.write(
          ansi.cursorRestorePosition +
          ansi.cursorLeft +
          ansi.eraseLines(2) +
          str.trim() + '\n');
      };

      inliner.on('progress', function progressEvent(event) {
        progress = event;
        update();
      });

      inliner.on('jobs', function jobsEvent(event) {
        jobs = event;
        update();
      });

      inliner.on('warning', function warningEvent(event) {
        progress = event;
        update();
      });

      inliner.on('end', function () {
        var diff = process.hrtime(time);
        process.stderr.write(styles.green.open + 'Time: ' + diff[0] + 's ' +
          (diff[1] / 1e6).toFixed(3) + 'ms\n' + styles.green.close);
        process.stderr.write(ansi.cursorShow);
      });

      'exit SIGINT SIGTERM'.split(' ').map(function (event) {
        process.once(event, function () {
          process.stderr.write(ansi.cursorShow); // put the cursor back
          try { process.kill(process.pid, event); } catch (e) {}
        });
      });
    } else {
      inliner.on('warning', function progress(event) {
        console.warn('warning: ' + event);
      });
    }
  });
}
