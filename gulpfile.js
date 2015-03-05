var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var gutil = require('gulp-util');
var del = require('del');
var fs = require('fs');
var runSequence = require('run-sequence');
var next = require('next-promise');
var ccad = require('cca-delegate');
    ccad.options({verbose: true});
var polymports = require('gulp-polymports');

var config = {
  target: 'chrome',
  watch: false,
  optimize: false,
  app: 'build'
};

var styleTask = function(stylesPath, srcs) {
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

gulp.task('configure', function() {
  var opts = require('minimist')(process.argv.slice(2));
  config.watch = !!opts.watch;
  config.optimize = (!!opts.optimize || !!opts.o);
  config.app = opts.app;
  if (opts.target) {
    config.target = opts.target;
  }
});

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
  console.log('CALLED', 'vulcanize:common');
  var dest = './app/bower_components/common-elements';
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
    .pipe(gulp.dest('build'));
});

gulp.task('vulcanize', function(cb) {
  var tasks = [];

  tasks.push(['styles:elements', 'copy:elements']);
  if (config.optimize) {
    tasks.push('vulcanize:elements');
  }
  tasks.push(cb);

  runSequence.apply(runSequence, tasks);
});

var watchTask = function(postTask) {
  return function() {
    var targets = [
      [['app/**/*.html', '!app/elements/**/*.html'], ['copy']],
      [['app/scripts/**/*.js'], ['jshint', 'copy']],
      [['app/styles/**/*.{scss,css}'], ['styles']],
      [['app/images/**/*'], ['images']],
      [['app/elements/**/*.{scss,css}'], ['styles:elements']],
      [['app/elements/**/*.{js,html}'], ['vulcanize']],
      [['vulcanize.json'], ['vulcanize:common']]
    ];

    targets.forEach(function(t) {
      if (postTask) {
        t[1].push(postTask);
      }
      gulp.watch(t[0], t[1]);
    });
  }
};

gulp.task('build', ['configure', 'jshint'], function() {
  var tasks = [
    ['styles', 'images', 'vulcanize:common'],
    ['copy', 'copy:bower'],
    'vulcanize'
  ];

  if (config.optimize) {
    tasks.push('html');
  }

  if (config.watch) {
    tasks.push(watchTask());
  }

  runSequence.apply(runSequence, tasks);
});

gulp.task('clean', function(cb) {
  del.sync(['.tmp', 'build', 'app/bower_components/common-elements']);
  $.cache.clearAll(cb);
});

gulp.task('run', ['configure'], function() {
  var run = function() {
    ccad.run({
      platform: config.target,
      cwd: './platform'
    }).then(null, function(err) {
      err & console.log(err.toString());
    });
  }

  run();

  if (config.watch) {
    watchTask(run)();
  }
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('build', 'run', cb);
});
