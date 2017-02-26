function doit() {
  var foo = {default:'bar'};
  // default is a reserved word which breaks parsing in IE<=8
  return foo.default;
}
