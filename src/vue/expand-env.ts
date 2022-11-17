import * as dotenv from 'dotenv'
import path from 'path'

function getTargetType (target: any) {
  return (Object.prototype.toString.call(target).match(/[a-zA-Z]+/g) as Array<string>)[1]
}

export default function expandVueEnv (config: any, env: Array<string|RegExp> = []) {
  env = [
    /^VITE_APP_.+/,
    ...env
  ]
  const baseEnv = dotenv.config().parsed || {}
  const modeEnv = dotenv.config({
    path: path.resolve(config.store.get('context'), `.env.${process.env.NODE_ENV}`)
  }).parsed
  Object.assign(baseEnv, modeEnv)
  const targetEnv = Object.keys(baseEnv).filter(key => {
    for (let i = 0; i < env.length; i++) {
      const type = getTargetType(env[i])
      if (type === 'String' && env[i] === key) return true
      if (type === 'RegExp' && (env[i] as RegExp).test(key)) return true
    }
    return false
  }).reduce((env: any, key: string) => {
    env[key] = JSON.stringify(baseEnv[key])
    return env
  }, {})

  config.plugin('define').tap((args: object[]) => {
    const arg: any = args[0]
    Object.assign(arg['process.env'], targetEnv)
    return args
  })
}
