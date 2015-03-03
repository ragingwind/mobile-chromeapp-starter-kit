var next = require('next-promise');
var exec = require('exec-then');
var cp = require('cp-file');
var args = require('meow')({
  help: [
      'Usage',
      '   node ./configure com.your.company.YourAppName --android --ios',
      '',
      'Options',
      '   --ios: Choose iOS platform',
      '   --android: Choose Android platform'
  ].join('\n')
});

var manifest = [
  {
    run: 'npm install',
    guide: 'Install NPM packages'
  },
  {
    run: 'bower install',
    guide: 'Install Bower packages'
  },
  {
    run: 'gulp build',
    guide: 'Build a application'
  },
  {
    run: 'cca create ./platform',
    guide: 'Create a Chrome Mobile App project',
  }
];

if (args.input.length === 0 || Object.keys(args.flags).length === 0) {
  args.showHelp();
  return;
}

// Update verbose option
if (args.flags.verbose) {
  manifest[0].run += ' --verbose';
  manifest[1].run += ' --verbose';
  exec.verbose = true;
}

// Update manifest data
manifest[3].run = [
  manifest[3].run,
  args.input[0],
  args.flags.android ? '--android' : null,
  args.flags.ios ? '--ios' : null,
  '--link-to=build/manifest.json'
].join(' ');

// Prepare build file
cp('app/manifest.json', 'build/manifest.json', function() {
  // Run commands in the manifest
  next(manifest, function(run) {
    console.info(run.guide);
    return exec(run.run, function(res, deferred) {
      if (res.err) {
        deferred.reject(res.err);
      }
    });
  }).then(function() {
    cp('build/manifest.mobile.json', 'app/manifest.mobile.json', function() {
      require('rimraf').sync('./build');
    });
  }, function (err) {
    console.log('You\'ve got problems. Check out errors');
    console.log(err ? err.toString() : 'Failed to create in Unknown reason');
  });
});


