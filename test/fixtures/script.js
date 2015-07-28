function doit(window) {
  var foo = 'remy';
  var bar = window.bar = 'sharp';
  return foo + bar.split('').reverse().join('');
}

console.log(doit(window));
