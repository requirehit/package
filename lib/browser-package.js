var Builder = require( 'requirehit-builder' );

var PackageLoader = module.exports = Builder.extend({
  dirname: __dirname,
  files: [
    './browser/index.js',
  ],
});
