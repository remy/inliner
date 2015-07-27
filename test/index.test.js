'use strict';
var test = require('tape');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('then-fs');
var path = require('path');

test('inliner core functions', function coreTests(t) {
  var Inliner = require('../');

  t.equal(typeof Inliner, 'function', 'Inliner is a function');
  t.equal(Inliner.version, require('../package.json').version);

  var inliner = new Inliner();
  t.ok(inliner, 'inline is instantiated');

  t.end();
});

test('inliner fixtures', function fixtureTests(t) {
  var Inliner = require('../');
  var files = fs.readdirSync(path.resolve(__dirname, 'fixtures'));
  var results = [];
  files = files.filter(function filter(file) {
    return file.indexOf('.src.') !== -1;
  }).filter(function filter(file) {
    // helps to diganose a single file
    // return file.indexOf('image-css.src.html') === 0;
    return file;
  }).map(function map(file) {
    file = path.resolve(__dirname, 'fixtures', file);
    results.push(fs.readFile(file.replace('.src.', '.result.'), 'utf8'));
    return file;
  });

  t.plan(files.length);

  Promise.all(results).then(function then(results) {
    files.map(function map(file, i) {
      new Inliner(file, function callback(error, html) {
        var basename = path.basename(file);
        if (error) {
          t.fail(error.message + ' @ ' + basename);
          console.log(error.stack);
        }
        t.equal(html.trim(), results[i].trim(), basename + ' matches');
      });
    });
  }).catch(function errHandler(error) {
    t.fail(error.message);
    console.log(error.stack);
    t.bailout();
  });
});