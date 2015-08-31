#!/usr/bin/env node
'use strict';

var fs = require('fs');
var mkdirp = require('mkdirp');
var shell = require('shelljs');
var xml = require('xml2js');

var name = process.argv[2] || 'com.my.app';
var platforms = process.argv[3] || '--android';

function replacePath() {
  var gulpfile = './src/gulpfile.js';
  var content = fs.readFileSync(gulpfile);

  content = content.toString().replace(/\'dist/gi, '\'chrome/dist');
  fs.writeFileSync(gulpfile, content);
}

function addHooks() {
  var xmlfile = './platform/config.xml';
  var parser = xml.Parser();
  var builder = new xml.Builder();

  parser.parseString(fs.readFileSync(xmlfile), function(err, data) {
    if (err) {
      throw new Error(err);
    }

    // <hook type="before_prepare" src="../bin/remove-archives.js"/>
    data.widget.hook = {
      '$': {
        'type': 'before_prepare',
        'src': '../bin/remove-archives.js'
      }
    };

    fs.writeFileSync(xmlfile, builder.buildObject(data, {
      pretty:true, indent: ' ', newline: '\n'
    }));
  });
}

console.log('Setup will be started with %s, %s', name, platforms);

var cmd = [
  'git submodule update --init --recursive',
  'cp -r templates/chrome src/chrome',
  ['cca create ./platform', name, platforms, '--link-to=./src/chrome/manifest.json'].join(' '),
  'cd src',
  'npm install && bower install',
  'gf-import ./bower_components/font-roboto/roboto.html --html=./bower_components/font-roboto/'
].join(' && ');

mkdirp.sync('./platform');

shell.exec(cmd, {async: true}, function() {
  replacePath();

  addHooks();

  console.log('Setup has been done');
});
