var inliner = require('./inliner').inliner;

inliner(process.ARGV[2] || 'http://remysharp.com', function (html) {
  console.log(html);
});