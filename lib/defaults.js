module.exports = function () {
  return {
    images: true,
    compressCSS: true,
    collapseWhitespace: true,
    nosvg: false, // by default, DO compress SVG with SVGO
  };
};