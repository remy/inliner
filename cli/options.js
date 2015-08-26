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
      'nosvg',
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
    },
  });

  // copy across specific options
  if (argv.nocompress) {
    argv.compressCSS = false;
    argv.collapseWhitespace = false;
  }
  argv.images = !argv.noimages;

  return argv;
}