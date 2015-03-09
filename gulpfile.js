var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var del = require('del');
var fs = require('fs');
var path = require('path');
var runSequence = require('run-sequence');
var merge = require('merge-stream');
var next = require('next-promise');
var ccad = require('cca-delegate');
    ccad.options({verbose: true});
var polymports = require('gulp-polymports');
var linkto = require('cordova-linkto');

var env = {
  platform: 'chrome',
  watch: false,
  target: 'app',
  configure: function() {
    var opts = require('minimist')(process.argv.slice(2));

    env.watch = !!opts.watch;

    if (opts.platform && /chrome|android|ios/.test(opts.platform)) {
      env.platform = (opts.platform || opts.p);
    }

    if (opts.dist) {
      env.target = 'dist';
    }
  }
};

var styleTask = function(stylesPath, srcs) {
  var dest = path.join(env.target, stylesPath);
  var optimize = env.target === 'dist';

  return gulp.src(srcs.map(function(src) {
      return path.join('app/', stylesPath, src);
    }))
    .pipe($.if('*.scss', $.rename({suffix:'.scss'})))
    .pipe($.changed(dest, {extension: '.scss'}))
    .pipe($.rubySass({
        style: 'expanded',
        precision: 10
      })
      .on('error', console.error.bind(console))
    )
    .pipe($.if('*.scss', $.rename(function(p) {p.extname += '.css'})))
    .pipe($.if(optimize, gulp.dest('.tmp/' + stylesPath)))
    .pipe($.if('*.css' && optimize, $.cssmin()))
    .pipe(gulp.dest(dest));
};

var runApp = function() {
  ccad.run({
    platform: env.platform,
    cwd: './platform'
  }).then(null, function(err) {
    err & console.log(err.toString());
    cb(err);
  });
};

gulp.task('jshint', function() {
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
    .pipe(gulp.dest('dist/images'));
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
  .pipe($.changed('dist/'))
  .pipe(gulp.dest('dist'));
});

gulp.task('copy:bower', function() {
  return gulp.src([
    'app/bower_components/**/*'
  ])
  .pipe($.changed('dist/bower_components'))
  .pipe(gulp.dest('dist/bower_components'));
});

gulp.task('copy:elements', function() {
  return gulp.src([
    'app/elements/**/*',
    '!app/elements/**/*.scss'
    ])
    .pipe($.changed('dist/elements'))
    .pipe(gulp.dest('dist/elements'));
});

gulp.task('vulcanize:common', function() {
  var dest = path.join(env.target, '/bower_components/common-elements');
  var bundles = JSON.parse(fs.readFileSync('./vulcanize.json')).bundles;

  polymports.src(bundles)
    .pipe($.vulcanize({
      dest: dest,
      csp: true,
      inline: true,
      strip: true
    }))
    .pipe(gulp.dest(dest));
});

gulp.task('vulcanize:elements', function() {
  var dest = './dist/elements/app-main';
  gulp.src('dist/elements/app-main/app-main.html')
    .pipe($.vulcanize({
      dest: dest,
      csp: true,
      inline: true,
      strip: true
    }))
    .pipe(gulp.dest(dest));
});

gulp.task('html', function () {
  var assets = $.useref.assets({searchPath: ['app']});
  return gulp.src([
      'app/**/*.html',
      '!app/{elements,bower_components}/**/*.html'
    ])
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
    .pipe(gulp.dest('dist'));
});

gulp.task('manifest', function() {
  return gulp.src('app/manifest.json')
    .pipe($.chromeManifest({
      buildnumber: true,
    }))
    .pipe($.if('*.css', $.cssmin()))
    .pipe($.if('*.js', $.sourcemaps.init()))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.js', $.sourcemaps.write()))
    .pipe(gulp.dest('dist'));
});

gulp.task('vulcanize', ['styles:elements', 'copy:elements', 'vulcanize:elements']);

gulp.task('clean', function(cb) {
  del.sync([
    '.tmp', '.sass-cache', 'dist',
    'app/bower_components/common-elements',
    'app/elements/**/*.scss.css**',
    'app/styles/*.scss.css**'
  ]);
  $.cache.clearAll(cb);
});

gulp.task('build', ['jshint'], function() {
  if (env.target === 'app') {
    runSequence(
      ['styles', 'vulcanize:common'],
      'styles:elements'
    );
  } else {
    runSequence(
      ['styles', 'images', 'vulcanize:common'],
      ['copy', 'copy:bower'],
      'manifest', 'html', 'vulcanize');
    }
});

gulp.task('run', function() {
  linkto(env.target, './platform', function(err) {
    if (err) {
      console.log('Failed to change app path to', env.target);
      return;
    }

    runApp();

    if (env.watch) {
      if (env.target === 'app') {
        gulp.watch(['app/scripts/**/*.js'], ['jshint', runApp]),
        gulp.watch(['app/styles/**/*.{scss,css}'], ['styles', runApp]),
        gulp.watch(['app/elements/**/*.{scss,css}'], ['styles:elements', runApp]),
        gulp.watch(['vulcanize.json'], ['vulcanize:common', runApp])
      } else {
        gulp.watch(['app/**/*.html', '!app/elements/**/*.html'], ['copy', 'html', runApp]);
        gulp.watch(['app/scripts/**/*.js'], ['jshint', 'copy', runApp]),
        gulp.watch(['app/styles/**/*.{scss,css}'], ['styles', runApp]),
        gulp.watch(['app/images/**/*'], ['images', runApp]),
        gulp.watch(['app/elements/**/*.{scss,css}'], ['styles:elements', runApp]),
        gulp.watch(['app/elements/**/*.{js,html}'], ['vulcanize', runApp]),
        gulp.watch(['vulcanize.json'], ['vulcanize:common', runApp])
      }
    }
  });
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('build', 'run', cb);
});

env.configure();
