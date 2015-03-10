# Chrome Apps Starter Kit

> Chrome Apps Starter Kit is an opinionated boilerplate for Chrome Apps development. Helping you to stay productive following the best practices. A solid starting point for both professionals and newcomers to the industry. :)

# How to use

```
git clone https://github.com/ChromeAppsWebComponents/chromeapps-starter-kit.git && cd chromeapps-starter-kit

# DO NOT RUN under ./bin directory
node ./bin/configure com.company.myApp --android --ios
```

> Remove `platform` in `.gitignore` if you want to keep your `platform` directory

# Tasks

> This kit is using build system based on gulp. And a few task can accept more options through additional parameters (--watch)

- `gulp clean`: Cleanup your project files. remove .tmp. caches and generated files like css gets from scss in Your `app` / `dist`

- `gulp build`: Build your app. If you want to build your project to `dist` using `--dist` option

- `gulp run`: Run your app on emulators/chrome/device with options
  --platform: You can select a target to run the app. Using no `--platform` option if you want to run the app on `chrome`. Using other platforms, give platform name with `--platform`. like this `--platform=android` or `--platform=ios`
  --dist: To run app built on `dist`. gulp task will change www-link path of cordova project. If you are using? The app runs with source in `app`
  --watch: To rerun app when your project files has been changed. It would be better that you develop with source of the `app` on chrome. or not? It could be taken some time every rerun.

- `gulp package`: Make a package/zip your project with source in `dist`;

# License

MIT @[ragingwind](http://ragingwind.me)
