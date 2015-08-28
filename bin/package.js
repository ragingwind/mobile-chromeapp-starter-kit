#!/usr/bin/env node
'use strict';

var fs = require('fs');
var archiver = require('archiver');
var mkdirp = require('mkdirp');
var path = require('path');
var ManiVer = require('maniver');

function zip(zipfile, manifest) {
  mkdirp.sync(path.dirname(zipfile));

  var archive = archiver('zip');
  var output = fs.createWriteStream(zipfile);

  output.on('close', function() {
    console.log('Written a zip file', zipfile, archive.pointer() + ' total bytes');
  }).on('error', function(err) {
    throw err;
  });

  archive.pipe(output);
  archive.append(new Buffer(JSON.stringify(manifest, null, '\t')), {
    name: 'manifest.json'
  }).bulk([{
    cwd: 'src/',
    expand: true,
    nonull: true,
    src: [
      'chrome-apps',
      'manifest.mobile.json',
      'polymer-starter-kit/dist/**/*',
      '!polymer-starter-kit/dist/**/manifest.json'
    ],
    dest: '/'
  }]).finalize();
}

function updateManifest(manifest, version) {
  var maniver = new ManiVer(manifest.version);
  var versionup = maniver[version];

  manifest.version = versionup.apply(maniver).version();
  return manifest;
}

var dest = 'package';
var manifest = require('../src/manifest.json');
var zipfile = path.join(dest, manifest.name + '-' + manifest.version + '.zip');

zip(zipfile, updateManifest(manifest, process.argv[2] || 'build'));
