
import webpack from 'webpack'
import * as loaderUtils from 'loader-utils'
import {
  LoaderOptions,
  PathToRegexpOptions
} from './types'
import transformCode from './transform'
import { getFileLanguage } from './utils'

export { default as expandVueEnv } from './vue/expand-env'
export { default as moveHtmlTemplate } from './vue/template'

export default function importMetaLoader (this:webpack.LoaderContext<LoaderOptions>, source: string) {
  const defaultOptions = {
    isVite2: false,
    alias: {},
    env: {
      MODE: 'NODE_ENV',
      BASE_URL: 'BASE_URL'
    }
  }
  const opts = this.getOptions ? this.getOptions() : loaderUtils.getOptions(this)
  const options = Object.assign({}, defaultOptions, opts)

  const config: PathToRegexpOptions = {
    resourcePath: this.resourcePath,
    rootPath: this.rootContext || (this as any).options.context,
    // alias: (this._compilation as webpack.Compilation).options.resolve.alias as object,
    alias: options.alias,
    isVite2: options.isVite2
  }
  const res = transformCode(source, options, config, getFileLanguage(this.resourcePath, this.resourceQuery) || 'js')
  return res
}
