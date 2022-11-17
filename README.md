# import-meta-loader

The plugin allows you to use vite's `import.meta` syntax with webpack

## Install

```bash
npm install import-meta-loader --save-dev
# or
yarn add import-meta-loader -D
```

## Usage

### For vue-cli
```js
// vue.config.js
const importMetaLoader = require('import-meta-loader')
const path = require('path')

module.exports = {
  // ...
  chainWebpack: (config) => {
    config.module.rule('js')
      .test(/\.js$/)
      .exclude.add(path.resolve('node_modules'))
      .end()
      .use(importMetaLoader)
      .loader('import-meta-loader')
      .options({
        // isVite2: true,
        alias: Object.fromEntries(config.resolve.alias.store)
      })
      .end()
    importMetaLoader.expandVueEnv(config) // make vue cli support environment variables that start width "VITE_APP_" 
    importMetaLoader.moveHtmlTemplate(config) // you need to move /public/index.html to /index.html, /index.html will be the entry
  }
}
```

### For webpack
```js
// webpack.config.js
module.exports = {
  // ...
  module: {
    rules: [
      // ...
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          // ...
          {
            loader: 'import-meta-loader',
            options: {
              // isVite2: true,
              // alias: {}
            }
          }
        ]
      }
    ]
  }
}
```
## Options

| name    | value                    | description                                            |
| ------- | ------------------------ | ------------------------------------------------------ |
| isVite2 | Boolean (default: false) | vite2 returns a different value than vite3             |
| alias   | Object                   | If an alias is configured, you need to set this option |

## Examples

```js
// vite => webpack
import.meta.env //=> process.env
import.meta.env.MODE //=> process.env.NODE_ENV
import.meta.env.BASE_URL //=> process.env.BASE_URL
import.meta.env.PROD //=> process.env.NODE_ENV === 'production'
import.meta.env.DEV //=> process.env.NODE_ENV !== 'production'

new URL('filePath', import.meta.url).href //=> require('filePath')

import.meta.glob('filePath') //=> ... require.context('dirPath', useSubdirectories: boolean, RegExp, 'lazy') ...
import.meta.glob('filePath', { eager: true }) //=> vite3 ... require.context('dirPath', useSubdirectories: boolean, RegExp, 'sync') ...
import.meta.globEager('filePath') //=> vite2 ... require.context('dirPath', useSubdirectories: boolean, RegExp, 'sync') ...
```

## Template

[https://github.com/XiaoLin1995/vuecli-vite-template](https://github.com/XiaoLin1995/vuecli-vite-template)




## License

MIT
