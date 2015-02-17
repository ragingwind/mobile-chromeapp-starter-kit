var next = require('next-promise');
var inquirer = require('inquirer');
var exec = require('exec-then');
    exec.verbose = true;

var manifest = [
  {
    run: 'bower install',
    guide: 'Install bower packages'
  },
  {
    run: 'cca create ./app',
    guide: 'Create a new Chrome Mobile App project',
  }
];

function askFor(next) {
  inquirer.prompt([{
    type: 'input',
    message: 'What is your Application ID ?',
    name: 'appID',
    default: 'com.your.company.YourAppName'
  }, {
    type: 'checkbox',
    message: 'Select platforms what you want to add',
    name: 'appPlatforms',
    choices: [{
      name: 'Android',
      checked: true,
      value: '--android'
    },
    {
      name: 'iOS',
      value: '--ios'
    }]
  }], function(answers) {
    var params = ['', answers.appID];

    if (answers.appPlatforms.length > 0) {
      params = params.concat(answers.appPlatforms);
    }

    manifest[1].run += params.join(' ');
    next();
  });
}

askFor(function() {
  console.log('Start to install dependencies and configure development environments');
  next(manifest, function(run) {
    console.log(run.guide);
    return exec(run.run, run.opt);
  }).then(function() {
    process.exit(0);
  }, function(res) {
    if (!res.params.created) {
      console.log('You\'ve got problems. Check out errors and rerun \'npm install\' script');
      console.log(res.err ? res.err.toString() : 'Failed to create in Unknown reason');
    }
  });
});

