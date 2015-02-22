var next = require('next-promise');
var inquirer = require('inquirer');
var conf = require('nconf');
var exec = require('exec-then');
    exec.verbose = true;
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
    run: 'cca create ./platform',
    guide: 'Create a new Chrome Mobile App project',
  }
];

if (args.input.length === 0 || Object.keys(args.flags).length === 0) {
  args.showHelp();
  return;
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
  console.log(run.guide);
  return exec(run.run, function(res, deferred) {
    if (run.err) {
      deferred.reject(run.err)
    }
  });
}).then(function() {
  console.log('done');
}, function (err) {
  console.log('You\'ve got problems. Check out errors and rerun \'npm install\' script');
  console.log(err ? err.toString() : 'Failed to create in Unknown reason');
});
