var gulp = require('gulp');
var gutil = require('gulp-util');
var path = require('path');
var ccad = require('cca-delegate');
    ccad.options({verbose: true});
var $ = require('gulp-load-plugins')();
var opts = require('minimist')(process.argv.slice(2), {});


// build for web application placed under `app`
gulp.task('build:app', function() {
});

// Run cca build command with a specific platform or all platforms
// YOu can pass no platform if you want build all platforms.
// gulp build --android --ios
gulp.task('build', function(done) {
  var platforms = [];
  opts.android && platforms.push('android');
  opts.ios && platforms.push('ios');

  ccad.build(platforms.length > 0 ? platforms : null, {
    cwd: path.join(__dirname, 'platform'),
    maxBuffer: 1000 * 1024,
    timeout:0
  }).then(function() {
    done();
  });
});
