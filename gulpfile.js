var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var del = require('del');
var runSequence = require('run-sequence');
var ccad = require('cca-delegate');
var args = require('minimist')(process.argv.slice(2));
var bundles = require('./vulcanize.json').bundles;
var opts = {
  platform: /chrome|android|ios/.test(args.platform) ? args.platform : 'chrome',
  watch: !!args.watch,
  dist: !!args.dist,
  target: args.dist ? 'dist' : 'app',
  port: args.port
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
  .pipe($.if(opts.dist, gulp.dest('.tmp/')))
  .pipe($.if(opts.dist && '*.css', $.cssmin()))
  .pipe(gulp.dest(opts.target));
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
  var targets = [];
  var path = require('path');

  Object.keys(bundles).forEach(function(bundle) {
    targets = bundles[bundle].imports.map(function(d) {
      return path.join('app/bower_components/', path.basename(d), '/**/*');
    });
  });

  return gulp.src(targets, {base: 'app/bower_components/'})
    .pipe($.changed('dist/bower_components'))
    .pipe(gulp.dest('dist/bower_components'))
    .pipe($.size({title: 'bower'}));
});

gulp.task('common', function() {
  var dest = opts.target + '/bower_components/common-elements';

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
        strip: true
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
  var tasks = !opts.dist ? ['styles', 'common'] : [
      ['styles', 'images', 'common'],
      ['copy', 'bower'],
      'manifest', 'html', 'vulcanize'];
  runSequence.apply(runSequence, tasks);
});

gulp.task('run', function() {
  ccad.options({
    platform: opts.platform,
    linkto: opts.target,
    cwd: './platform',
    verbose: true
  });

  ccad.run().then(function() {
    if (opts.watch) {
      function within(tasks) {return opts.dist ? tasks : null};
      gulp.watch(['app/**/*.html', '!app/elements/**/*.html'], [within(['copy', 'html']), ccad.run]);
      gulp.watch(['app/scripts/**/*.js'], ['jshint', within('copy'), ccad.run]);
      gulp.watch(['app/{elements,styles}/**/*.{scss,css}'], ['styles', ccad.run]);
      gulp.watch(['app/elements/**/*.{js,html}'], ['jshint', within('vulcanize'), ccad.run]);
      gulp.watch(['app/images/**/*'], within(['image', ccad.run]));
      gulp.watch(['vulcanize.json'], ['common', within('bower'), ccad.run]);
    }
  }).catch(function(err) {
    console.log('Run returns an error:', err.toString());
  });
});

gulp.task('push', function() {
  ccad.push({
    target: opts.port || '192.168.0.30',
    linkto: opts.target,
    watch: opts.watch,
    cwd: './platform',
    verbose: true
  });
});

gulp.task('package', ['clean', 'build'], function() {
  return gulp.src(opts.target + '/**/*')
    .pipe($.zip('chromeapp.zip'))
    .pipe(gulp.dest('package'))
    .pipe($.size({title: 'package'}));
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('build', 'run', cb);
});
