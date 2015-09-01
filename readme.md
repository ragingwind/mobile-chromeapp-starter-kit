# Mobile Chrome Apps Starter Kit

> Mobile Chrome Apps Starter Kit is Yet Another Opinionated Boilerplate for Chrome Apps development. "Helping you to stay productive following the best practices. A solid starting point for both professionals and newcomers to the industry." - [google/web-starter-kit](http://goo.gl/YNV3lb)

## Setup

1. Install [Mobile Chrome Apps](http://goo.gl/nU5O6U) and Android or iOS SDKs. Please refer to [Install guide of Mobile Chrome Apps](https://github.com/MobileChromeApps/mobile-chrome-apps/blob/master/docs/Installation.md). and then Check your development environment using `cca checkenv`. You will get message like below if you have no problem to use `cca`
    ```
    cca v0.x.x
    Android Development: SDK configured properly.
    iOS Development: SDK configured properly.
    ```

1. Download a latest version of package at [release page](https://github.com/ragingwind/mobile-chrome-apps-starter-kit/releases) then extract where you want to.

    ```
    wget https://github.com/ragingwind/mobile-chrome-apps-starter-kit/archive/v0.1.0.tar.gz
    tar xvf v0.1.0.tar.gz
    ```

1. Run this command to install dependencies for NPM and bower
    ```
    npm install
    ```
and then `postinstall` script will be started. The `postinstall` script runs `npm install && bower install` command for Polymer Starter Kit, which is on `src` path and then starting font migration for `font-roboto` via `google-font-import` which will be downloading `font-roboto` to use its fonts in local.

3. To configure [Mobile Chrome Apps](http://goo.gl/nU5O6U) to use npm handy command below with NAME, ID and PLATFORM config

    ```
    NAME="My App" ID=com.my.app PLATFORM='android ios' npm run config
    ```

## Build and Run

This project has two of the build systems for each project, Mobile Chrome Apps and Polymer Starter Kit. Each build command should be executed on the each project path. Please visit if you want to know more details of build commands.

  - Mobile Chrome App: ./platform
  - Polymer Starter Kit: ./src
  
Or you can use handy scripts with npm. You can execute build and run commands without changing a path. here is list of run scripts

  - `npm run build:app`: run `gulp` command on the `src` path
  - `npm run build:cca`: run `cca build` command on the `platform` path. You should pass platform type, `android` or `ios`. This is a sample of command: `PLATFORM=android npm run build:cca`
  - `npm run build": run both of build command `build:app` and `build:cca` at same time. this is a sample of command: `PLATFORM=android npm run build`
  "npm run chrome": run `cca run chrome` command on the `platform` path,
  "npm run android": run `cca run android` command on the `platform` path,
  "npm run ios": run `cca run ios` command on the `platform` path,
  "npm run push": run `cca push` command on the `platform` path. You should give target ip address. This is a sample of command: `TARGET=192.168.0.10 npm run push`

## Mobile Chrome Apps

We use pre-created project for Mobile Chrome Apps. that means you need to update a few of configurations to fit your application. For example, an application id or name. We are supporting handy script command to configure. `npm run config` command allow you to set a new value to config.xml and If you want to set more configurations, you can user `cordova-config` cli command. Please see [cordova-config-cli](https://www.npmjs.com/package/cordova-config-cli) for more information

## Polymer Starter Kit (PSK)

The starter kit are using PSK as default application. but we have to had some of changes from PSK for fitting in Chrome Apps. We use latest version at this time it was coming over from [latest commit](https://github.com/PolymerElements/polymer-starter-kit/commit/ece4f2c2aa75ce3ebfe6ccd5d71528168ce63a11) at master brach on the PSK. The version of PSK could be updated any time if we need to. Please see below what has been changed in the current version.

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
  
# License

MIT @[Jimmy Moon](http://ragingwind.me)
