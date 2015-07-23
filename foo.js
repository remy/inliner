var jsp = require("uglify-js").parser;
var pro = require("uglify-js").uglify;
var fs = require('fs');

fs.readFile('site.js', 'utf8', function (e, data) {
  var orig_code = data;
  var ast = jsp.parse(orig_code); // parse code and get the initial AST
  ast = pro.ast_mangle(ast); // get a new AST with mangled names
  ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
  var final_code = pro.gen_code(ast); // compressed code here

console.log(final_code);
});

