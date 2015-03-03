var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var gutil = require('gulp-util');
var fs = require('fs');
var del = require('del');
var path = require('path');
var runSequence = require('run-sequence');
var next = require('next-promise');
var ccad = require('cca-delegate');
    ccad.options({verbose: true});
var polymports = require('gulp-polymports');

var opts = require('minimist')(process.argv.slice(2));
var bowercfg = require('bower-config').read();
var cfg = require('./appcfg');
var platforms = ['chrome', 'android'];

var styleTask = function (stylesPath, srcs) {
  return gulp.src(srcs.map(function(src) {
      return 'app/' + stylesPath + src;
    }))
    .pipe($.changed('build/' + stylesPath, {extension: '.scss'}))
    .pipe($.rubySass({
        style: 'expanded',
        precision: 10
      })
      .on('error', console.error.bind(console))
    )
    .pipe(gulp.dest('.tmp/' + stylesPath))
    .pipe($.if('*.css', $.cssmin()))
    .pipe(gulp.dest('build/' + stylesPath));
};

gulp.task('jshint', function () {
  return gulp.src([
    'app/scripts/**/*.js',
    'app/elements/**/*.js',
    'app/elements/**/*.html'
  ])
  .pipe($.jshint.extract())
  .pipe($.jshint())
  .pipe($.jshint.reporter('jshint-stylish'));
});

gulp.task('styles', function() {
  return styleTask('styles', ['/**/*.css', '/*.scss'])
});

gulp.task('styles:elements', function() {
  return styleTask('elements', ['/**/*.css', '/**/*.scss']);;
});

gulp.task('images', function () {
  return gulp.src('app/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('build/images'));
});

gulp.task('copy', function() {
  return gulp.src([
    'app/*',
    'app/fonts/**',
    'app/scripts/**/*',
  ], {
    dot: true,
    base: './app'
  })
  .pipe($.changed('build/'))
  .pipe(gulp.dest('build'));
});

gulp.task('copy:bower', function() {
  return gulp.src([
    'app/bower_components/**/*'
  ])
  .pipe($.changed('build/bower_components'))
  .pipe(gulp.dest('build/bower_components'));
});

gulp.task('copy:elements', function() {
  return gulp.src([
    'app/elements/**/*',
    '!app/elements/**/*.{css,scss}'
    ])
    .pipe($.changed('build/elements'))
    .pipe(gulp.dest('build/elements'));
});

gulp.task('vulcanize:common', function() {
  var dest = './build/elements';
  polymports.src(require('./appcfg.json').bundles)
    .pipe($.vulcanize({
      dest: dest,
      csp: true,
      inline: true,
      strip: true
    }))
    .pipe(gulp.dest(dest));
});

gulp.task('vulcanize:elements', function() {
  var dest = './build/elements/app-main';
  gulp.src(['build/elements/app-main/app-main.html'])
    .pipe($.vulcanize({
      dest: dest,
      csp: true,
      inline: true,
      strip: true
    }))
    .pipe(gulp.dest(dest));
});

gulp.task('html', ['styles'], function () {
  var assets = $.useref.assets({searchPath: ['app']});
  return gulp.src('build/**/*.html')
    .pipe(assets)
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.csso()))
    .pipe(assets.restore())
    .pipe($.useref())
    .pipe($.if('*.html', $.minifyHtml({conditionals: true, loose: true})))
    .pipe(gulp.dest('build'));
});

gulp.task('html', function () {
  var assets = $.useref.assets({searchPath: ['.tmp', 'app', 'build']});
  return gulp.src([
      'app/**/*.html',
      '!app/{elements,bower_components}/**/*.html'
    ])
    // .pipe($.if('*.html', $.replace('elements/elements.html', 'elements/elements.vulcanized.html')))
    .pipe(assets)
    .pipe($.if('*.js', $.uglify({preserveComments: 'some'})))
    .pipe($.if('*.css', $.cssmin()))
    .pipe(assets.restore())
    .pipe($.useref())
    .pipe($.if('*.html', $.minifyHtml({
      quotes: true,
      empty: true,
      spare: true
    })))
    .pipe(gulp.dest('build'));
});

gulp.task('elements:release', function(cb) {
  runSequence(['styles:elements', 'copy:elements'], 'vulcanize:elements', cb);
});

gulp.task('elements:debug', function(cb) {
  runSequence(['styles:elements', 'copy:elements'], cb);
});

var watch = function(vulcan) {
  var elementsTask = ['jshint', 'copy:elements'];

  if (vulcan) {
    elementsTask.splice(1, 0, 'vulcanize:elements');
  }

  gulp.watch(['app/**/*.html', '!app/elements/**/*.html'], ['copy']);
  gulp.watch(['app/scripts/**/*.js'], ['jshint', 'copy']);
  gulp.watch(['app/styles/**/*.{scss,css}'], ['styles']);
  gulp.watch(['app/images/**/*'], ['images']);
  gulp.watch(['app/elements/**/*.{scss,css}'], ['styles:elements']);
  gulp.watch(['app/elements/**/*.{js,html}'], [vulcan ? 'elements:release' : 'elements:debug']);
  gulp.watch(['appcfg.json'], ['vulcanize:common']);
};

gulp.task('watch', function(cb) {
  watch();
});

gulp.task('clean', del.bind(null, ['.tmp', 'build']));

gulp.task('build:release', ['jshint'], function() {
  runSequence(['copy', 'copy:bower', 'styles', 'images', 'html',],
    'vulcanize:common', 'elements:release');
  if (opts.watch) {
    watch(true);
  }
});

gulp.task('build:debug', ['jshint'], function() {
  // will be replaced to gulp.start or other
  runSequence(['copy', 'copy:bower', 'styles', 'images'],
    'vulcanize:common', 'elements:debug');
  if (opts.watch) {
    watch(true);
  }
});

gulp.task('build', ['clean'], function() {
  gulp.start('build:debug');
});

gulp.task('run', function(cb) {
  var platformsForRunning = [];

  platforms.forEach(function(p) {
    if (opts[p]) {
      platformsForRunning.push(p);
    }
  });

  if (platformsForRunning.length === 0) {
    platformsForRunning.push('chrome');
  }

  next(platformsForRunning, function(p) {
    return ccad.run({
      platform: p,
      cwd: './platform'
    });
  }).then(function() {
    // runSequence('watch', cb);
  }, function(err) {
    err & console.error(err.toString());
    cb();
  });
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('build:debug', 'run', cb);
});
