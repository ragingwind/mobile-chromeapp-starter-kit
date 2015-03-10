var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var del = require('del');
var fs = require('fs');
var path = require('path');
var runSequence = require('run-sequence');
var ccad = require('cca-delegate');
    ccad.options({verbose: true});

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
  var cssmin = env.target === 'dist';

  return gulp.src([
    'app/styles/*.scss',
    'app/elements/**/*.scss'
  ], {base: 'app'})
  .pipe($.rename({suffix:'.scss'}))
  .pipe($.rubySass({
      style: 'expanded',
      precision: 10
    })
    .on('error', console.error.bind(console))
  )
  .pipe($.if('*.scss', $.rename(function(p) {p.extname += '.css'})))
  .pipe($.if(cssmin, gulp.dest('.tmp/')))
  .pipe($.if(cssmin && '*.css', $.cssmin()))
  .pipe(gulp.dest(env.target));
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

gulp.task('bower', function() {
  return gulp.src([
    'app/bower_components/**/*'
  ])
  .pipe($.changed('dist/bower_components'))
  .pipe(gulp.dest('dist/bower_components'))
  .pipe($.size({title: 'bower'}));
});

gulp.task('common', function() {
  var dest = path.join(env.target, '/bower_components/common-elements');
  var bundles = JSON.parse(fs.readFileSync('./vulcanize.json')).bundles;

  $.polymports.src(bundles)
    .pipe($.vulcanize({
      dest: dest,
      csp: true,
      inline: true,
      strip: true
    }))
    .pipe(gulp.dest(dest));
});

gulp.task('vulcanize', function(cb) {
  var copy = gulp.task('vulcanize:copy', function() {
    return gulp.src([
      'app/elements/**/*',
      '!app/elements/**/*.scss'
      ])
      .pipe(gulp.dest('dist/elements'));
  });

  var vulcan = gulp.task('vulcanize:app', function() {
    return gulp.src('dist/elements/app-main/app-main.html')
      .pipe($.vulcanize({
        dest: 'dist/elements/app-main',
        csp: true,
        inline: true,
        // strip: true
      }))
      .pipe(gulp.dest('dist/elements/app-main'));
  });
  return runSequence('vulcanize:copy', 'vulcanize:app', cb);
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
    runSequence(['styles', 'common']);
  } else {
    runSequence(
      ['styles', 'images', 'common'],
      ['copy', 'bower'],
      'manifest', 'html', 'vulcanize');
    }
});

gulp.task('run', function() {
  var run = function(cb) {
    ccad.run({
      platform: env.platform,
      linkto: env.target,
      cwd: './platform'
    }).then(function() {cb()}, function(err) {cb(err)});
  };

  run(function(err) {
    if (err) {
      err & console.log('Errors', err);
      return;
    }

    if (env.watch) {
      var within = function(left, start, items) {
        if (typeof start !== 'number') {
          items = start;
          start = 0;
        }

        if (env.target !== 'app') {
          left.splice(start ? start : 0, 0, items);
        }

        return left;
      };

      gulp.watch(['app/**/*.html', '!app/elements/**/*.html'], within([run], ['copy', 'html']));
      gulp.watch(['app/scripts/**/*.js'], within(['jshint', run], 1, ['copy']));
      gulp.watch(['app/{elements,styles}/**/*.{scss,css}'], ['styles', run]);
      gulp.watch(['app/elements/**/*.{js,html}'], ['jshint', 'vulcanize', run]);
      gulp.watch(['app/images/**/*'], within([run], 'image'));
      gulp.watch(['vulcanize.json'], within(['common', run], 1, 'bower'));
    }
  });
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('build', 'run', cb);
});

env.configure();
