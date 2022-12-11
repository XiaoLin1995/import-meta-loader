import * as t from '@babel/types'
import * as _path from 'path'
import { PathToRegexpOptions } from './types'

export function getFileType (fileUrl: string) {
  const idx = fileUrl.lastIndexOf('.')
  return fileUrl.substr(idx + 1)
}

export function getQueryValue (str: string, key: string) {
  const reg = new RegExp('(^|&)' + key + '=([^&]*)(&|$)', 'i')
  const res = str.substr(1).match(reg)
  return res ? res[2] : ''
}

export function getFileLanguage (path: string, query: string) {
  const queryLang = getQueryValue(query, 'lang')
  if (queryLang) return queryLang
  return getFileType(path)
}

export function isImportMeta (path: any, prop: string) {
  if (!path.isIdentifier({ name: 'import' })) return false
  const parentNode = path?.parent
  if (!t.isMetaProperty(parentNode)) return false
  const parentProperty = parentNode?.property
  if (parentProperty?.name !== 'meta') return false

  const grandparentNode: t.MemberExpression = path?.parentPath?.parent
  if (!t.isMemberExpression(grandparentNode)) return false
  if (!prop) return true

  const grandparentProperty = grandparentNode?.property as t.Identifier
  if (grandparentProperty?.name !== prop) return false

  if (prop === 'url') {
    return isNewUrlHref(path.parentPath.parentPath.parentPath)
  }

  return true
}

function transformPathSlash (path: string) {
  const str = path.replaceAll('\\', '/')
  return /^([.]{1,2}\/|[/])/.test(str) ? str : './' + str
}

export function transformPathToRegexp (path: string, { rootPath, resourcePath, alias, isVite2 }: PathToRegexpOptions) {
  const resourceDir = _path.join(resourcePath, '../')
  const aliasPath = (Object.entries(alias) as [string, string][]).find(([key]) => {
    return path.substr(0, key.length + 1) === key + '/'
  })

  if (aliasPath) {
    const [key, value] = aliasPath
    const realPath = _path.join(value, path.replace(key + '/', ''))
    const relative = _path.relative(resourceDir, realPath)
    if (relative) {
      path = transformPathSlash(relative)
    } else {
      const matchRes = path.match(/[^/]+$/)
      if (matchRes) path = './' + matchRes[0]
    }
    if (!isVite2) {
      path = transformPathSlash(_path.join(resourceDir, path).replace(rootPath, ''))
    }
  }

  if (!isVite2 && path.substr(0, 1) !== '/') {
    path = transformPathSlash(_path.relative(resourceDir, _path.join(resourceDir, path)))
  }
  const starReg = /\/[*]{1,}\//
  const useSubdirectories = starReg.test(path)
  const idx =
    path.match(starReg)?.index ||
    path.match(/\/[^/]+$/)?.index ||
    path.indexOf('/')
  let directory = './'
  let regexp = '^'
  if (idx !== -1) {
    directory = path.substr(0, idx + 1)
    path = path.substr(idx + 1)
    regexp = '^[^/]+\\/'
  }

  const arr: string[] = path.split('/')
  const str = arr
    .map((path) => {
      let reg = /^[.]+$/g
      if (reg.test(path)) {
        return path.replace(reg, ($1) => {
          return '\\' + $1
        })
      }

      reg = /^[*]$/g
      if (reg.test(path)) return path.replace(reg, '[^/]+')

      reg = /^[*]{2,}$/g
      if (reg.test(path)) return path.replace(reg, '.+')

      reg = /([*]{1})\.([^/]+)/g
      if (reg.test(path)) {
        return path.replace(reg, ($1, $2, $3) => {
          return `[^/]+\\.${$3}`
        })
      }

      path = path.replace(/[*]/g, '\\*')

      return path
    })
    .join('\\/')

  regexp += str + '$'
  return {
    directory,
    useSubdirectories,
    regexp
  }
}

export function isNewUrlHref (path: any) {
  const pathNode: t.NewExpression = path.node
  const pathCallee = pathNode.callee as t.Identifier
  const pathParent: t.MemberExpression = path.parent
  if (
    t.isNewExpression(path) &&
    pathCallee.name === 'URL' &&
    t.isIdentifier(pathParent.property) &&
    pathParent.property.name === 'href'
  ) {
    return true
  }
  return false
}

export function getImportMetaData (path: any, type: string) {
  if (type === 'url') {
    return {
      type,
      url: path.parentPath.parentPath.parent.arguments[0].value,
      path: path.parentPath.parentPath.parentPath.parentPath
    }
  }
  if (type === 'env') {
    return {
      type,
      path: path.parentPath.parentPath
    }
  }

  const targetNode = path.parentPath.parentPath.parent
  const urlArg = targetNode.arguments[0]
  const isArray = t.isArrayExpression(urlArg)
  const url = []

  if (isArray) {
    (urlArg.elements as t.StringLiteral[]).forEach(item => {
      url.push(item.value)
    })
  } else {
    url.push(urlArg.value)
  }

  return {
    type,
    url,
    path: path.parentPath.parentPath.parentPath
  }
}
