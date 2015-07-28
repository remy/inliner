'use strict';
var test = require('tape');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('then-fs');
var path = require('path');
var tapSpec = require('tap-spec');
var http = require('http');
var st = require('st');

test.createStream().pipe(tapSpec()).pipe(process.stdout);

test('inliner core functions', function coreTests(t) {
  var Inliner = require('../');

  t.equal(typeof Inliner, 'function', 'Inliner is a function');
  t.equal(Inliner.version, require('../package.json').version, 'should have version');

  var inliner = new Inliner();
  t.ok(inliner, 'inline is instantiated');

  t.end();
});

test('inliner fixtures', function fixtureTests(t) {
  var testFilter = process.argv.slice(-1).pop();
  var testOffset = 1;

  if (testFilter === '--cov') { // this is part of our npm test command
    testFilter = null;
    testOffset = 0;
  } else {
    t.pass('filtering against ' + testFilter + '.src.html');
  }

  var Inliner = require('../');
  var files = fs.readdirSync(path.resolve(__dirname, 'fixtures'));
  var results = [];
  files = files.filter(function filter(file) {
    return file.indexOf('.src.') !== -1;
  }).filter(function filter(file) {
    // helps to diganose a single file
    return testFilter ?
           file.indexOf(testFilter + '.src.html') === 0 :
           file;
  }).map(function map(file) {
    file = path.resolve(__dirname, 'fixtures', file);
    results.push(fs.readFile(file.replace('.src.', '.result.'), 'utf8'));
    return file;
  });

  t.plan(files.length + testOffset);

  var server = http.createServer(
    st(path.resolve(__dirname, 'fixtures'))
  ).listen(54321);

  server.on('listening', function listening() {
    Promise.all(results).then(function then(results) {
      return Promise.all(files.map(function map(file, i) {
        return new Promise(function inlinerPromise(resolve, reject) {
          new Inliner(file, function callback(error, html) {
            var basename = path.basename(file);
            if (error) {
              error.message += ' @ ' + basename;
              return reject(error);
            }
            t.equal(html.trim(), results[i].trim(), basename + ' matches');
            resolve();
          });
        });
      }));
    }).catch(function errHandler(error) {
      t.fail(error.message);
      console.log(error.stack);
      t.bailout();
    }).then(function close() {
      server.close();
    });
  });
});