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
      '   --android: Choose Android platform',
      '   --verbose: Show messages'
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
manifest[2].run = [
  manifest[2].run,
  args.input[0],
  args.flags.android ? '--android' : null,
  args.flags.ios ? '--ios' : null,
  '--link-to=app/manifest.json'
].join(' ');

// Run commands in the manifest
next(manifest, function(run) {
  console.info(run.guide);

  return exec(run.run, {verbose: args.flags.verbose}, function(res, deferred) {
    if (res.err) {
      deferred.reject(res.err);
    }
  });
}).then(function() {
  console.log('done');
}, function (err) {
  console.log('You\'ve got problems. Check out errors');
  console.log(err ? err.toString() : 'Failed to create in Unknown reason');
});


