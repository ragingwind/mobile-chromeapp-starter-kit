#!/usr/bin/env node
'use strict';

var fs = require('fs');
var mkdirp = require('mkdirp');
var shell = require('shelljs');
var name = process.argv[2] || 'com.my.app';
var platforms = process.argv[3] || '--android';

function replacePath() {
  var gulpfile = './src/gulpfile.js';
  var content = fs.readFileSync(gulpfile);

  content = content.toString().replace(/\'dist/gi, '\'chrome/dist');
  fs.writeFileSync(gulpfile, content);
}

console.log(process.argv);
console.log('Setup will be started with %s, %s', name, platforms);

var cmd = [
  'git submodule update --init --recursive',
  'cp -r bin/chrome src/chrome',
  // ['cca create ./platform', name, platforms, '--link-to=./src/manifest.json'].join(' '),
  // 'cd src/polymer-starter-kit',
  // 'npm install && bower install',
  // 'gf-import ./bower_components/font-roboto/roboto.html --html=./bower_components/font-roboto/'
].join(' && ');

mkdirp.sync('./platform');

var exec = shell.exec(cmd, {async: true}, function() {
  // replacePath();

  console.log('Setup has been done');
});
