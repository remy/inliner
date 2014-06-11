/**
 * These tests just check that the required options have defaults. The behavior controlled by the defaults is
 * relied upon by clients.
 * TODO build tests that verify the actual behavior; not only that defaults are provided.
 * John Bito <johnbi@zillow.com>
 */
/*global require: false, describe:true, it: true */

var Inliner = require('../inliner'),
    keys = Object.keys || require('object-keys'),
    Assert = require('assert');


function checkDefault(optionName) {
  'use strict';
  var defaults = Inliner.defaults();
  
  Assert.notEqual(keys(defaults).indexOf(optionName), -1, "there must be a default for " + optionName);
}

describe('inliner', function () {
  'use strict';
  it('should have default options', function () {
    var i, count = 0,
    defaults = Inliner.defaults();
    Assert.ok(defaults, "defaults must not be empty");
    for (i in defaults) {
      Assert.ok(defaults[i], "there must be a value for each default key");
      count++;
    }
    Assert.notEqual(count, 0, "there must at least one default value");
  });
  it('should provide a default for compressCSS', function () {
    checkDefault('compressCSS');
  });
  it('should provide a default for compressJS', function () {
    checkDefault('compressJS');
  });
  it('should provide a default for webRoot', function () {
    checkDefault('webRoot');
  });
});


