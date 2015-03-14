# Mobile Chrome Apps Starter Kit

> Mobile Chrome Apps Starter Kit is Yet Another Opinionated Boilerplate for Chrome Apps development. "Helping you to stay productive following the best practices. A solid starting point for both professionals and newcomers to the industry." - [google/web-starter-kit](http://goo.gl/YNV3lb)

# Setup

0. Install [Mobile Chrome Apps](http://goo.gl/nU5O6U) and Android or iOS SDKs. Please refer to [Install guide of Mobile Chrome Apps](https://github.com/MobileChromeApps/mobile-chrome-apps/blob/master/docs/Installation.md). and then Check your development environment using `cca checkenv`. You will get message like below if you have no problem to use `cca`
    ```
    cca v0.5.1
    Android Development: SDK configured properly.
    iOS Development: SDK configured properly.
    ```

1. Clone project from github and change directory into created path
    
    ```
    git clone https://github.com/ragingwind/mobile-chrome-apps-starter-kit.git 
    cd mobile-chrome-apps-starter-kit
    ```

2. Install dependencies of NPM and Bower

    ```
    npm install && bower install
    ```

3. Configure a project that is created with [Mobile Chrome Apps](http://goo.gl/nU5O6U) `configure.js` executes `cca` command with arguments

    ```
    node ./configure com.your.company.YourAppName --android --ios
    ```

4. Configure an environment for development. ex) Remove `platform` in `.gitignore`  if you want to keep your `platform` directory. files in `platform/platforms` would be better that stay in `.gitignore` since build the app

5. Build and Run. Try this ```gulp clean && gulp build --dist && gulp run --dist```

# Tasks

This kit is using build system based on gulp. And a few task can use more arguments for watching the files or building/running on `dist` version that can be served in production. [see video](https://www.youtube.com/watch?v=aGmOzrnHjPM)

- `gulp build`: Build your app. To build production ready version using `--dist` argument
- `gulp run`: Run your app on emulators/chrome/device with options below. ex) ```gulp run --dist --watch --platform=android```
  - --platform: `chrome`/`android`/`ios`. You can choose a platform what you want to run the app on. default platform is `chrome`.
  - --dist: To run on the app built for production. gulp task try to change `www link` direction of cordova proejct to `dist`. default direction is to `app`
  - --watch: To rerun app when detect changes of files. Mostly recommended to use for running the on `chrome`. or not? It could be taken some time every rerun.
- `gulp package`: Make a zip package. Using `--dist` argument to make a package from version of production ready.

- `gulp push`: Delegate `push` command of [Mobile Chrome Apps](http://goo.gl/nU5O6U). Please visit for more information. You can deploy the app to device directly without build and install steps.

- `gulp clean`: Cleanup your project files. remove .tmp. caches and generated files like css gets from scss in Your `app` / `dist`

# [Content Security Policy (CSP)](http://goo.gl/8MiQmf)

[Currently Mobile Chrome Apps(cca) doesn't enforce CSP for apps](http://stackoverflow.com/questions/21940272/does-cordova-webview-violate-csp) but we have to consider CSP to develop the app running on both side between chrome and mobile devices. Check out these rules:

- Creating custom elements: You have to create javascript and html separated files in elements for using Polymer element without any post process.
- Using vulcanized Polymer `common` elements: This kit using pre-vulcanized Polymer elements in app. `gulp common` task will generates vulcanized polymer component to bower_component with name as `common-elements/polymer-elements.html` that includes Polymer elements is listed in `vulcanize.json`. That mean is you should add Polymer element names on `vulcanize.json` when you feel that other polymer is needed. And then you can imports Polymer common elements to your custom elements at top of the files like common/standard library of outside languages. 

# License

MIT @[Jimmy Moon](http://ragingwind.me)
