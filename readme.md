# Mobile Chrome Apps Starter Kit

![Demo for Mobile Chrome Apps Starter Kit](https://cloud.githubusercontent.com/assets/124117/9600512/671e3ba4-50d6-11e5-8e2f-cdf37431b88a.gif)

> Mobile Chrome Apps Starter Kit is Yet Another Opinionated Boilerplate for Chrome Apps development. "Helping you to stay productive following the best practices. A solid starting point for both professionals and newcomers to the industry." - [google/web-starter-kit](http://goo.gl/YNV3lb)

*Issues with the output or build should be reported on the `Mobile Chrome App` [issue tracker](https://github.com/MobileChromeApps/mobile-chrome-apps/issues) or `Polymer Starter Kit` [issue tracker](https://github.com/PolymerElements/polymer-starter-kit/issues).*

## Setup

1. Install [Mobile Chrome Apps](http://goo.gl/nU5O6U) and Android or iOS SDKs. Please refer to [Install guide of Mobile Chrome Apps](https://github.com/MobileChromeApps/mobile-chrome-apps/blob/master/docs/Installation.md) for further information and then please make sure that your development environment can use `cca checkenv`. You will get a message like below if you have no problem to use `cca`
    ```
    cca v0.x.x
    Android Development: SDK configured properly.
    iOS Development: SDK configured properly.
    ```

1. Download a latest version of package at [release page](https://github.com/ragingwind/mobile-chromeapp-starter-kit/releases) then extract where you want to.

    ```
    mkdir mcsk && cd $_
    curl -fsSL https://github.com/ragingwind/mobile-chromeapp-starter-kit/archive/v1.2.1.tar.gz | tar -xz --strip-components 1
    ```

    or git clone

    ```
    git clone https://github.com/ragingwind/mobile-chromeapp-starter-kit.git
    ```
1. Update some of properties of package.json which might be related to your project such as `name`, 'appId`, `description`, `repository` and `author`, will be used to update `config.xml` for cordova project.

  ```
  {
    "name": "mobile-chromeapp-starter-kit",
    "appId": "com.your.appid2",
    "description": "Mobile Chrome Apps Starter Kit is Yet Another Opinionated Boilerplate for Chrome Apps development",
    "author": {
      "name" : "Jimmy Moon",
      "email" : "ragingwind@gmail.com",
      "url" : "http://ragingwind.me"
    },
    "repository": "ragingwind/mobile-chromeapp-starter-kit",
  }
  ```

1. Run this command to install dependencies for NPM and bower
    ```
    npm install && npm run setup
    ```
`postinstall` script will be started after then, which script try to install rest of npm package, bower and start migration of font for `font-roboto` through `google-font-import`, it makes PSK use `font-roboto` at local. `npm run setup` script manage to change the content in gulfile.js of PSK and execute setup command of cca to set up cca project, in that time, properties of package.json will be used for setting.

## Build and Run

This project has extra gulp command to build and run cca project, which is in the `src/tasks`. Please refer to commands below

- `gulp cca:build`: build application and then build cordova project. `platform` should be passed for build, `--platform=android`. **At this momment, we only support build for android**
- `gulp cca:run`: run cordova project on emulate or devices. use options with `--platform=chrome|android` and `--run=emulate|device`
- `gulp cca:push`: run `cca push` command on the `platform` path. You should give target with ip address, with target option `--target=192.168.0.10` and `--watch`
- `culp cca:package`: Make and copy a unsigned zip file for Chrome and apk of Android to `package` path. It should be run after `build`

Please visit reference sites if you want to know further details of cca build commands.

## Mobile Chrome Apps

We use pre-created CCA project for Mobile Chrome App, that means you need to update a few of configurations to fit your application what you want. During first installation time of the cca project will be configured with properties of package.json, such as application id, name or version. We are using handy script command, [cordova-config-cli](https://www.npmjs.com/package/cordova-config-cli) allow you to set a new value to config.xml. If you would like to update more configurations please see [cordova-config-cli](https://www.npmjs.com/package/cordova-config-cli) for more information

## Polymer Starter Kit (PSK)

We use final released full version of PSK as default application, after download from github as the time of first installation but we have to have some of changes from PSK for fitting in Chrome Apps. Please see below what will be in the latest version.

Change `dist` path to `./platform/www/app/` at `gulpfile.js` and you need to update some of codes at `app/elements/routing.html` to be able to display first page view of `home` correctly on chrome app. Add workaround code for a route exception. The element route code will be stopped when Chrome Apps raise an exception as `history.replaceState` is not supported in Packaged Apps. So we added a workaround code that route value set again manually. [this documents](https://github.com/PolymerElements/polymer-starter-kit/blob/master/docs/chrome-dev-editor.md) is related to this issue.

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

Finally, We need to make font-roboto at `app/bower_components/font-roboto` downloaded google fonts to local because Chrome Apps doesn't allow to use Google Fonts on remote site so we need to download all fonts in `font-roboto` to use in local. after run `npm install`, `postinstall` script will excutes `google-font-import` command to make it up.

## Known Issues

- Tested on Mac OSX with Android and chrome except ios
- Some of files should be removed before build manually. For example `manifest.json`, `.gz`
- All of features of Polymer Starter Kit has not been tested yet
- Failed to route `home` at starting the application on Android's emulator/device

# License

MIT @[Jimmy Moon](http://ragingwind.me)
