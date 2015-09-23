'use strict';
var gulp = require('gulp');
var util = require('gulp-util');
var runSequence = require('run-sequence');
var ccad = require('cca-delegate');
var platform = util.env.platform || 'android';
var run = util.env.run || 'emulate';
var target = util.env.target || null;
var watch = util.env.watch || false;

// Set global options
ccad.options({
  verbose: true,
  maxBuffer: 1000 * 1024,
  timeout:0,
  cwd:'./platform'
});

// Make a package for android and chrome, cordova application should be built before
gulp.task('cca:package', function(cb) {
  ccad.packageup('./package').then(function () {
    cb();
  });
});

// Build cordova application, PSK should be built before its run
gulp.task('cca:build', function(cb) {
  ccad.build([platform]).then(function() {
    cb();
  });
});

// Push cordova application to Chrome App Developer Tools running on target device
gulp.task('cca:push', function(cb) {
  if (!target) {
    throw new Error('cca:push needs target IP Address');
  }

  ccad.push({
    target: target,
    watch: watch
  }).then(function () {
    cb();
  });
});

// Run cordova application on specific platform what you want
gulp.task('cca:run', function(cb) {
  if (!/^emulate|^device/.test(run)) {
    throw new Error('cca:run got invalid running option');
  }

  ccad.run({
    platform: platform,
    run: run
  }).then(function () {
    cb();
  });
});

// Build cordova application, the default task
gulp.task('cca', ['clean'], function (cb) {
  runSequence('default', 'cca:build', cb);
});
