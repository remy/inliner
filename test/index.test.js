var test = require('tap-only');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('then-fs');
var path = require('path');
var http = require('http');
var debug = require('debug')('inliner:test');
var st = require('st');
var server;

test('setup mock server', function (t) {
  server = http.createServer(function (req, res) {
    if (isASCII(req.url)) {
      st(path.resolve(__dirname, 'fixtures'))(req, res);
    }
    else {
      // Fail because all non-ascii chars should be urlencoded
      // (some http servers don't handle non-ascii)
      res.statusCode = 404;
      res.end();
    }
  }).listen(54321);

  server.on('listening', function listening() {
    t.pass('mock server ready');
    t.end();
  });
});

test('inliner core functions', function coreTests(t) {
  var Inliner = require('../');

  t.plan(4);

  t.equal(typeof Inliner, 'function', 'Inliner is a function');
  t.equal(Inliner.version,
    require('../package.json').version, 'should have version');

  var inliner = new Inliner();
  t.ok(inliner, 'inline is instantiated');

  var roundtripHTML = '<!DOCTYPE html><html></html>';
  new Inliner(roundtripHTML, function (error, html) {
    t.equal(html, roundtripHTML, 'recognizes HTML as main input');
  });
});

test('inliner handles given source as local', function sourcedTests(t) {
  var Inliner = require('../');

  t.plan(1);

  var content = fs.readFileSync(__dirname + '/fixtures/css-ext-import.src.html', 'utf8');
  new Inliner(content, function (error) {
    t.equal(error, null, 'treats local content as file');
  });
});

test('failures', function failureTests(t) {
  var Inliner = require('../');
  var throwBack = function (e) { return e; };
  return Promise.all([
    'http://localhost:11111_11',
    'http://localhost:11111',
    'http://localhost:1111'].map(function (url) {
      return (new Inliner('http://localhost:11111_11').promise).catch(throwBack).then(function (res) {
        t.ok(res instanceof Error, url + ' throws error');
      });
    }));
});

test('inliner fixtures', function fixtureTests(t) {
  var testFilter = Object.keys(process.env).map(function (key) {
    if (key.toLowerCase() === 'filter') {
      return process.env[key];
    }
    return false;
  }).filter(Boolean).shift();

  if (testFilter) {
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

  Promise.all(results).then(function then(results) {
    return Promise.all(files.map(function map(file, i) {
      // Read test-specific command line arguments.
      var optsfile = file.replace('.src.html', '.opts.json');
      var opts = {};
      try {
        opts = require(optsfile);
        debug('loaded options %s', optsfile, opts);
      } catch (e) {}

      return new Promise(function inlinerPromise(resolve, reject) {
        new Inliner(file, opts, function callback(error, html) {
          var basename = path.basename(file);
          if (error) {
            error.message += ' @ ' + basename;
            return reject(error);
          }
          t.equal(html.trim(), results[i].trim(), basename + ' matches');
          debug('result', html.trim());
          // debug('expected', results[i].trim());
          resolve();
        });
      });
    }));
  }).catch(t.threw).then(t.end);
});

test('tear down', function (t) {
  server.close();
  t.pass('tear down complete');
  t.end();
});

function isASCII(str) {
  return /^[\x00-\x7F]*$/.test(str);
}
