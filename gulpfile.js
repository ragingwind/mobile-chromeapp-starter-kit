var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var gutil = require('gulp-util');
var fs = require('fs');
var del = require('del');
var path = require('path');
var runSequence = require('run-sequence');
var merge = require('merge-stream');
var next = require('next-promise');
var ccad = require('cca-delegate');
    ccad.options({verbose: true});
var opts = require('minimist')(process.argv.slice(2));
var polymports = require('gulp-polymports');
var bowercfg = require('bower-config').read();
var cfg = require('./appcfg');
var platforms = ['chrome', 'android'];

var styleTask = function (stylesPath, srcs) {
  return gulp.src(srcs.map(function(src) {
      return 'app/' + stylesPath + src;
    }))
    .pipe($.changed(stylesPath, {extension: '.scss'}))
    .pipe($.rubySass({
        style: 'expanded',
        precision: 10
      })
      .on('error', console.error.bind(console))
    )
    .pipe(gulp.dest('.tmp/' + stylesPath))
    .pipe($.if('*.css', $.cssmin()))
    .pipe(gulp.dest('build/' + stylesPath))
    .pipe($.size({title: stylesPath}));
}

gulp.task('vulcanize:common', function() {
  var dest = './build/elements';
  polymports.src(require('./appcfg.json').bundles)
    .pipe($.vulcanize({
      dest: dest,
      csp: true,
      inline: true
    }))
    .pipe(gulp.dest(dest))
    .pipe($.size({title: 'vulcanize:common'}));
});

gulp.task('vulcanize:app', function() {
  var dest = './build/elements/app-main';
  gulp.src(['build/elements/app-main/app-main.html'])
    .pipe($.vulcanize({
      dest: dest,
      csp: true,
      inline: true
    }))
    .pipe(gulp.dest(dest))
    .pipe($.size({title: 'vulcanize:app'}));
});

gulp.task('elements', function() {
  var style = styleTask('elements', ['/**/*.css', '/**/*.scss']);
  var copyElements = gulp.src([
    '!app/elements/**/*.scss',
    'app/elements/**/*'
  ])
  .pipe(gulp.dest('build/elements'))
  .pipe($.size({title: 'copy:element'}));
  return merge(style, copyElements);
});

gulp.task('styles', function() {
  return styleTask('styles', ['/**/*.css', '/*.scss'])
});

gulp.task('copy', function() {
  return gulp.src([
    'app/*',
    'app/images/**/*',
    'app/scripts/**/*',
    '!app/elements'
  ], {
    dot: true,
    base: './app'
  })
  .pipe(gulp.dest('build'))
  .pipe($.size({title: 'copy'}));
});

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

gulp.task('images', function () {
  return gulp.src('app/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('build/images'))
    .pipe($.size({title: 'images'}));
});

gulp.task('fonts', function () {
  return gulp.src(['app/fonts/**'])
    .pipe(gulp.dest('build/fonts'))
    .pipe($.size({title: 'fonts'}));
});

gulp.task('watch', function() {
  if (opts.watch) {
    var fn = opts._[0];
    console.log(fn);
    gulp.watch(['app/**/*.html'], [fn]);
    gulp.watch(['app/styles/**/*.{scss,css}'], ['styles', fn]);
    gulp.watch(['app/elements/**/*.{scss,css}'], ['elements', fn]);
    gulp.watch(['app/scripts/**/*.js', 'app/elements/**/*.js'], ['jshint', fn]);
    gulp.watch(['app/images/**/*'], [fn]);
  }
})

gulp.task('clean', del.bind(null, ['.tmp', 'build']));

gulp.task('build', ['clean'], function(cb) {
  runSequence(['copy', 'styles'],
    'elements',
    'vulcanize:common',
    ['jshint', 'images', 'fonts'],
    // 'vulcanize:app',
    'watch', cb);
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
    runSequence('watch', cb);
  }, function(err) {
    err & console.error(err.toString());
    cb();
  });
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('build', 'run');
});
