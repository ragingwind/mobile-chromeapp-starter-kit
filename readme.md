# Mobile Chrome Apps Starter Kit

![Demo for Mobile Chrome Apps Starter Kit](https://cloud.githubusercontent.com/assets/124117/9600512/671e3ba4-50d6-11e5-8e2f-cdf37431b88a.gif)

> Mobile Chrome Apps Starter Kit is Yet Another Opinionated Boilerplate for Chrome Apps development. "Helping you to stay productive following the best practices. A solid starting point for both professionals and newcomers to the industry." - [google/web-starter-kit](http://goo.gl/YNV3lb)

*Issues with the output or build should be reported on the `Mobile Chrome App` [issue tracker](https://github.com/MobileChromeApps/mobile-chrome-apps/issues) or `Polymer Starter Kit` [issue tracker](https://github.com/PolymerElements/polymer-starter-kit/issues).*

## Setup

1. Install [Mobile Chrome Apps](http://goo.gl/nU5O6U) and Android or iOS SDKs. Please refer to [Install guide of Mobile Chrome Apps](https://github.com/MobileChromeApps/mobile-chrome-apps/blob/master/docs/Installation.md). and then Check your development environment using `cca checkenv`. You will get message like below if you have no problem to use `cca`
    ```
    cca v0.x.x
    Android Development: SDK configured properly.
    iOS Development: SDK configured properly.
    ```

1. Download a latest version of package at [release page](https://github.com/ragingwind/mobile-chrome-apps-starter-kit/releases) then extract where you want to.

    ```
    wget https://github.com/ragingwind/mca-starter-kit/archive/vx.x.x.tar.gz
    tar xvf vx.x.x.tar.gz
    ```

    or via npm

    ```
    npm install mca-starter-kit
    ```
1. Update some of properties in package.json which are related to your project, are `name`, 'appId`, `description`, `repository` and `author`, will be used to update `config.xml` for cordova project

  ```
  {
    "name": "mca-starter-kit",
    "appId": "com.your.appid2",
    "description": "Mobile Chrome Apps Starter Kit is Yet Another Opinionated Boilerplate for Chrome Apps development",
    "author": {
      "name" : "Jimmy Moon",
      "email" : "ragingwind@gmail.com",
      "url" : "http://ragingwind.me"
    },
    "repository": "ragingwind/mca-starter-kit",
  }
  ```

1. Run this command to install dependencies for NPM and bower
    ```
    npm install
    ```
and then `postinstall` script will be started. The `postinstall` script runs `npm install && npm install --save-dev cca-delegate gulp-util && bower install`, on `src` path and then starting font migration for `font-roboto` via `google-font-import` which will be downloading `font-roboto` to use its fonts in local.

## Build and Run

This project has two build systems for each project. One is Mobile Chrome Apps, Another is Polymer Starter Kit, each build command should be executed on the each project path below.

  - Mobile Chrome App: ./platform
  - Polymer Starter Kit: ./src

or you can use gulp task under `./src` added to `src/app` as `tasks/cca-tasks.js`. You can just execute build and run commands without changing of path to `cordova platform`. here is the list of run scripts

- `gulp cca:build`: build application and then build cordova project. `platform` should be passed for build, `--platform=android`. **At this momment, we only support build for android**
- `gulp cca:run`: run cordova project on emulate or devices. use options with `--platform=chrome|android` and `--run=emulate|device`
- `gulp cca:push`: run `cca push` command on the `platform` path. You should give target with ip address, with target option `--target=192.168.0.10` and `--watch`
- `culp cca:package`: Make and copy a unsigned zip file for Chrome and apk of Android to `package` path. It should be run after `build`

Please visit reference sites if you want to know further details of build commands.

## Mobile Chrome Apps

We use pre-created project for Mobile Chrome Apps. that means you need to update a few of configurations to fit your application. For example, an application id or name. We are supporting handy script command to configure. `npm run config` command, which is described above, allow you to set a new value to config.xml and If you want to set more configurations via `cordova-config` cli command. Please see [cordova-config-cli](https://www.npmjs.com/package/cordova-config-cli) for more information

## Polymer Starter Kit (PSK)

The Mobile Chrome App Starter Kit use PSK as default application but we have to had some of changes from PSK for fitting in Chrome Apps. We use latest version at this time it was coming over from [latest commit](https://github.com/PolymerElements/polymer-starter-kit/commit/ece4f2c2aa75ce3ebfe6ccd5d71528168ce63a11) at master brach on the PSK. The version of PSK could be updated any time if we need to. Please see below what has been changed in the current version.

- gulpfile.js:
  - Change `dist` path to `../platform/www/app/`
  - Add `force` option to `del` to remove target in out of bound
- app/elements/routing.html:
  - Add workaround code for a route exception: The element route code will be stopped when Chrome Apps raise an exception as `history.replaceState` is not supported in Packaged Apps. So we added a workaround code that route value set again manually
  ```javascript
  try {
    // add #! before urls
    page({
      hashbang: true
    });
  } catch (e) {
    app.route = 'home';
  }
  ```
- app/bower_components/font-roboto:
  - Download google fonts to local: Chrome Apps doesn't allow to use Google Fonts on remote site so we need to download all fonts in `font-roboto` to use in local. after run `npm install`, `postinstall` script will run `google-font-import` command to make it up.

## Known Issues

- Tested on Mac OSX with Android and chrome except ios
- Some of files should be removed before build manually. For example `manifest.json`, `.gz`
- All of features of Polymer Starter Kit has not been tested yet
- Failed to route `home` at starting the application on Android's emulator/device

# License

MIT @[Jimmy Moon](http://ragingwind.me)
