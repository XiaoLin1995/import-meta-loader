import log4js from 'log4js'

log4js.configure({
  appenders: { transformCode: { type: 'file', filename: 'transform_code.log' } },
  categories: { default: { appenders: ['transformCode'], level: 'debug' } }
})

export const logger = log4js.getLogger('transform_code')
