# Mobile Chrome Apps Starter Kit

> Mobile Chrome Apps Starter Kit is Yet Another Opinionated Boilerplate for Chrome Apps development. "Helping you to stay productive following the best practices. A solid starting point for both professionals and newcomers to the industry." - [google/web-starter-kit](http://goo.gl/YNV3lb)

# Setup

Setup is consist of three parts. clone, install and configure. This start kit requires project creating with [Mobile Chrome Apps](http://goo.gl/nU5O6U). So you have to `configure` project after downloading and installing dependencies.

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

# Tasks

This kit is using build system based on gulp. And a few task can use more arguments for watching the files or building/running on `dist` version that can be served in production

- `gulp build`: Build your app. To build production ready version using `--dist` argument
- `gulp run`: Run your app on emulators/chrome/device with options below.
  - --platform: `chrome`/`android`/`ios`. You can choose a platform what you want to run the app on. default platform is `chrome`. ex) ```gulp run --platform=android```
  - --dist: To run on the app built for production. gulp task try to change `www link` direction of cordova proejct to `dist`. default direction is to `app`
  - --watch: To rerun app when detect changes of files. Mostly recommended to use for running the on `chrome`. or not? It could be taken some time every rerun.
- `gulp package`: Make a zip package. Using `--dist` argument to make a package from version of production ready.

- `gulp push`: Delegate `push` command of [Mobile Chrome Apps](http://goo.gl/nU5O6U). Please visit for more information. You can deploy the app to device directly without build and install steps.

- `gulp clean`: Cleanup your project files. remove .tmp. caches and generated files like css gets from scss in Your `app` / `dist`

# License

MIT @[ragingwind](http://ragingwind.me)
