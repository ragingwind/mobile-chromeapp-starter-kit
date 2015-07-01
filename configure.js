  var exec = require('exec-then');
var args = require('minimist')(process.argv.slice(2));

if (args._.length === 0) {
  console.log([
      'Usage',
      '   node ./configure com.your.company.YourAppName --android --ios',
      '',
      'Options',
      '   --ios: Choose iOS platform',
      '   --android: Choose Android platform',
      '   --verbose: Show messages'
  ].join('\n'));
  return;
}

var bin = [
  'cca create ./platform',
  args._[0],
  args.android ? '--android' : '',
  args.ios ? '--ios' : '',
  '--link-to=app/manifest.json'
].join(' ');

exec(bin, {verbose: args.verbose}, function(res) {
  if (res.err) {
    console.log('You\'ve got problems. Check out errors');
    console.log(res.err ? res.err.toString() : 'Failed to create in Unknown reason');
  }
});
