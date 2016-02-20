module.exports = options;

var minimist = require('minimist');

function options(args) {
  var argv = minimist(args, {
    boolean: [ // flags
      'version',
      'help',
      'debug',
      'verbose',
      'noimages',
      'nocompress',
      'nosvg',
      'same-origin-only',
      'videos',
      'inlinemin',
    ],
    string: [ // options
      'encoding',
    ],
    alias: {
      images: 'noimages', // legacy support
      V: 'version',
      h: 'help',
      d: 'debug',
      v: 'verbose',
      i: 'noimages',
      n: 'nocompress',
      e: 'encoding',
      s: 'nosvg',
      o: 'videos',
      m: 'inlinemin',
      H: 'header',
    },
  });

  // copy across specific options
  if (argv.nocompress) {
    argv.compressCSS = false;
    argv.compressJS = false;
    argv.collapseWhitespace = false;
  }
  if (argv['same-origin-only']) {
    argv.sameOriginOnly = true;
  }
  argv.images = !argv.noimages;

  argv.useStdin = !process.stdin.isTTY;

  return argv;
}
