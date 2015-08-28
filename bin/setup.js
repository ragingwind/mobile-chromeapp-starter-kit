#!/usr/bin/env node
'use strict';

var mkdirp = require('mkdirp');
var shell = require('shelljs');
var name = process.argv[2] || 'com.my.app';
var platforms = process.argv[3] || '--android';

console.log(process.argv);
console.log('Setup for CCA project will be started with %s, %s', name, platforms);

var cmd = [
  'git submodule update --init --recursive',
  'cd src/polymer-starter-kit; npm install && bower install',
  'gf-import ./bower_components/font-roboto/roboto.html --html=./bower_components/font-roboto/',
  ['cca create ./platform', name, platforms, '--link-to=./src/manifest.json'].join(' ')
].join(' && ');

mkdirp.sync('./platform');

var exec = shell.exec(cmd, {async: true}, function() {
  console.log('obj');
});
