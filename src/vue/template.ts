export default function moveHtmlTemplate (config: any, path: string) {
  config.plugin('html').tap((args: any[]) => {
    args[0].template = path || args[0].template.replace('public\\', '')
    return args
  })
}
