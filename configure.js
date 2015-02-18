var next = require('next-promise');
var inquirer = require('inquirer');
var conf = require('nconf')
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

function setConfig(answers) {
var pkg = conf.file({file: 'package.json'});
    pkg.set('config', {
      appID: answers.appID,
      platforms: answers.appPlatforms
    });
    pkg.set('name', answers.appID.split('.').pop());
    pkg.save();
}

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
      value: 'android'
    },
    {
      name: 'iOS',
      value: 'ios'
    }]
  }], function(answers) {
    var params = ['', answers.appID];

    if (answers.appPlatforms.length > 0) {
      answers.appPlatforms.forEach(function(p) {
        params.push('--' + p);
      });
    }

    manifest[1].run += params.join(' ');
    next(answers);
  });
}

askFor(function(answers) {
  console.log('Start to install dependencies and configure development environments');

  next(manifest, function(run) {
    console.log(run.guide);
    return exec(run.run, function(res) {
      run.err = res.err;
    });
  }).then(function() {
    if (manifest[1].err) {
      console.log('You\'ve got problems. Check out errors and rerun \'npm install\' script');
      console.log(res.err ? res.err.toString() : 'Failed to create in Unknown reason');
    }

    console.log('Configuration has been saved');
    setConfig(answers);
  });
});
