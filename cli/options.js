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
      'skip-absolute-urls',
      'videos',
      'inlinemin',
      'nocache',
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
      c: 'nocache',
    },
  });

  // copy across specific options
  if (argv.nocompress) {
    argv.compressCSS = false;
    argv.compressJS = false;
    argv.collapseWhitespace = false;
  }
  if (argv['skip-absolute-urls']) {
    argv.skipAbsoluteUrls = true;
  }
  argv.images = !argv.noimages;

  argv.useStdin = !process.stdin.isTTY;

  argv.verbose = argv.verbose || !process.stdout.isTTY;

  argv.cache = !argv.nocache;

  return argv;
}
