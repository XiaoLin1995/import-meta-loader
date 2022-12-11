
import * as parser from '@babel/parser'
import traverse from '@babel/traverse'
import generator from '@babel/generator'
import * as t from '@babel/types'
import {
  isImportMeta,
  transformPathToRegexp,
  getImportMetaData,
  checkIsExclude
} from './utils'
import {
  ImportMetaArray,
  PathToRegexpOptions,
  LoaderOptions
} from './types'

export default function transformCode (source: string, { env }: LoaderOptions, config: PathToRegexpOptions, fileType: string) {
  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: [
      'jsx',
      fileType === 'ts' ? 'typescript' : 'flow'
    ]
  })

  const importMetaData: ImportMetaArray[] = []

  traverse(ast, {
    enter (path) {
      if (isImportMeta(path, 'url')) {
        const { path: parentPath, url, type } = getImportMetaData(path, 'url', config)
        importMetaData.push({ path: parentPath, url, type })
      } else if (isImportMeta(path, 'glob')) {
        const { path: parentPath, url, type } = getImportMetaData(path, 'glob', config)
        const parentNode = parentPath.node
        const parentArgumentsTwo = parentNode.arguments[1]

        if (t.isObjectExpression(parentArgumentsTwo)) {
          const property = (parentArgumentsTwo.properties as t.ObjectProperty[]).find((item) => {
            return t.isIdentifier(item.key) && item.key.name === 'eager' && t.isBooleanLiteral(item.value) && item.value.value
          })
          if (t.isObjectProperty(property)) {
            importMetaData.push({ path: parentPath, url, type: 'globEager' })
          } else {
            importMetaData.push({ path: parentPath, url, type })
          }
        } else {
          importMetaData.push({ path: parentPath, url, type })
        }
      } else if (isImportMeta(path, 'globEager')) {
        const {
          path: parentPath,
          url,
          type
        } = getImportMetaData(path, 'globEager', config)
        importMetaData.push({ path: parentPath, url, type })
      } else if (isImportMeta(path, 'env')) {
        const { path: parentPath, type } = getImportMetaData(path, 'env', config)
        const envValue = parentPath.parent?.property?.name || ''
        importMetaData.push({ path: parentPath, type, value: envValue })
      }
    }
  })

  importMetaData.forEach(({ path, url, type, value }) => {
    if (type === 'url') {
      path.replaceWith(
        t.callExpression(t.identifier('require'), [t.stringLiteral(url as string)])
      )
    } else if (type === 'env') {
      const processEnv = t.memberExpression(
        t.identifier('process'),
        t.identifier('env')
      )

      let newPath: t.MemberExpression | t.BinaryExpression = processEnv
      if (value === 'MODE') {
        newPath = t.memberExpression(newPath, t.identifier(env.MODE))
      } else if (value === 'BASE_URL') {
        newPath = t.memberExpression(newPath, t.identifier(env.BASE_URL))
      } else if (value === 'PROD') {
        newPath = t.binaryExpression(
          '===',
          t.memberExpression(newPath, t.identifier(env.MODE)),
          t.stringLiteral('production')
        )
      } else if (value === 'DEV') {
        newPath = t.binaryExpression(
          '!==',
          t.memberExpression(newPath, t.identifier(env.MODE)),
          t.stringLiteral('production')
        )
      } else if (value) {
        newPath = t.memberExpression(
          newPath,
          t.identifier(value)
        )
      }
      value ? path.parentPath.replaceWith(newPath) : path.replaceWith(newPath)
    } else if (['glob', 'globEager'].includes(type)) {
      const globBody: any[] = []

      const includeUrl: string[] = []
      const excludeUrl: string[] = [];

      (url as string[]).forEach(val => {
        if (checkIsExclude(val)) {
          excludeUrl.push(val)
        } else {
          includeUrl.push(val)
        }
      })

      globBody.push(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('excludeKeys'),
            t.arrayExpression([])
          )
        ]),

        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('includeKeys'),
            t.arrayExpression([])
          )
        ])
      )

      excludeUrl.forEach((val: string) => {
        const { directory, useSubdirectories, regexp } = transformPathToRegexp(
          val,
          config
        )

        globBody.push(
          t.expressionStatement(
            t.callExpression(
              t.functionExpression(
                null,
                [],
                t.blockStatement([
                  t.variableDeclaration('const', [
                    t.variableDeclarator(
                      t.identifier('files'),
                      t.callExpression(
                        t.memberExpression(
                          t.identifier('require'),
                          t.identifier('context')
                        ),
                        [
                          t.stringLiteral(directory),
                          t.booleanLiteral(useSubdirectories),
                          t.regExpLiteral(regexp),
                          t.stringLiteral('lazy')
                        ]
                      )
                    )
                  ]),
                  t.expressionStatement(
                    t.callExpression(
                      t.memberExpression(
                        t.callExpression(
                          t.memberExpression(
                            t.identifier('files'),
                            t.identifier('keys')
                          ),
                          []
                        ),
                        t.identifier('forEach')
                      ),
                      [
                        t.functionExpression(
                          null,
                          [t.identifier('key')],
                          t.blockStatement([
                            t.variableDeclaration('const', [
                              t.variableDeclarator(
                                t.identifier('realKey'),
                                t.binaryExpression(
                                  '+',
                                  t.stringLiteral(directory),
                                  t.callExpression(
                                    t.memberExpression(
                                      t.identifier('key'),
                                      t.identifier('replace')
                                    ),
                                    [t.stringLiteral('./'), t.stringLiteral('')]
                                  )
                                )
                              )
                            ]),
                            t.expressionStatement(
                              t.callExpression(
                                t.memberExpression(
                                  t.identifier('excludeKeys'),
                                  t.identifier('push')
                                ),
                                [
                                  t.identifier('realKey')
                                ]
                              )
                            )
                          ])
                        )
                      ]
                    )
                  )
                ])
              ),
              []
            )
          )
        )
      })

      includeUrl.forEach((val: string, idx: number) => {
        const { directory, useSubdirectories, regexp } = transformPathToRegexp(
          val,
          config
        )

        let mode: string
        let modulesKey: t.FunctionExpression | t.CallExpression
        if (type === 'glob') {
          mode = 'lazy'
          modulesKey = t.functionExpression(
            null,
            [],
            t.blockStatement([
              t.returnStatement(
                t.callExpression(
                  t.memberExpression(
                    t.callExpression(t.identifier('files'), [
                      t.identifier('key')
                    ]),
                    t.identifier('then')
                  ),
                  [
                    t.functionExpression(
                      null,
                      [t.identifier('value')],
                      t.blockStatement([
                        t.returnStatement(
                          t.newExpression(t.identifier('Promise'), [
                            t.functionExpression(
                              null,
                              [t.identifier('resolve')],
                              t.blockStatement([
                                t.ifStatement(
                                  t.binaryExpression(
                                    '===',
                                    t.callExpression(
                                      t.memberExpression(
                                        t.memberExpression(
                                          t.memberExpression(
                                            t.identifier('Object'),
                                            t.identifier('prototype')
                                          ),
                                          t.identifier('toString')
                                        ),
                                        t.identifier('call')
                                      ),
                                      [t.identifier('value')]
                                    ),
                                    t.stringLiteral('[object Module]')
                                  ),
                                  t.blockStatement([
                                    t.returnStatement(
                                      t.callExpression(t.identifier('resolve'), [
                                        t.identifier('value')
                                      ])
                                    )
                                  ])
                                ),
                                t.expressionStatement(
                                  t.callExpression(t.identifier('resolve'), [
                                    t.objectExpression([
                                      t.objectProperty(
                                        t.identifier('default'),
                                        t.identifier('value')
                                      )
                                    ])
                                  ])
                                )
                              ])
                            )
                          ])
                        )
                      ])
                    )
                  ]
                )
              )
            ])
          )
        } else {
          mode = 'sync'
          modulesKey = t.callExpression(
            t.functionExpression(
              null,
              [],
              t.blockStatement([
                t.variableDeclaration('const', [
                  t.variableDeclarator(
                    t.identifier('value'),
                    t.callExpression(t.identifier('files'), [t.identifier('key')])
                  )
                ]),
                t.ifStatement(
                  t.binaryExpression(
                    '===',
                    t.callExpression(
                      t.memberExpression(
                        t.memberExpression(
                          t.memberExpression(
                            t.identifier('Object'),
                            t.identifier('prototype')
                          ),
                          t.identifier('toString')
                        ),
                        t.identifier('call')
                      ),
                      [t.identifier('value')]
                    ),
                    t.stringLiteral('[object Module]')
                  ),
                  t.blockStatement([t.returnStatement(t.identifier('value'))])
                ),
                t.returnStatement(
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier('default'),
                      t.identifier('value')
                    )
                  ])
                )
              ])
            ),
            []
          )
        }
        globBody.push(
          t.variableDeclaration(
            'var',
            [
              t.variableDeclarator(
                t.identifier('_url_' + idx),
                t.callExpression(
                  t.functionExpression(
                    null,
                    [],
                    t.blockStatement([
                      t.variableDeclaration('const', [
                        t.variableDeclarator(
                          t.identifier('files'),
                          t.callExpression(
                            t.memberExpression(
                              t.identifier('require'),
                              t.identifier('context')
                            ),
                            [
                              t.stringLiteral(directory),
                              t.booleanLiteral(useSubdirectories),
                              t.regExpLiteral(regexp),
                              t.stringLiteral(mode)
                            ]
                          )
                        )
                      ]),
                      t.variableDeclaration('const', [
                        t.variableDeclarator(
                          t.identifier('modules'),
                          t.objectExpression([])
                        )
                      ]),
                      t.expressionStatement(
                        t.callExpression(
                          t.memberExpression(
                            t.callExpression(
                              t.memberExpression(
                                t.identifier('files'),
                                t.identifier('keys')
                              ),
                              []
                            ),
                            t.identifier('forEach')
                          ),
                          [
                            t.functionExpression(
                              null,
                              [t.identifier('key')],
                              t.blockStatement([
                                t.variableDeclaration('const', [
                                  t.variableDeclarator(
                                    t.identifier('realKey'),
                                    t.binaryExpression(
                                      '+',
                                      t.stringLiteral(directory),
                                      t.callExpression(
                                        t.memberExpression(
                                          t.identifier('key'),
                                          t.identifier('replace')
                                        ),
                                        [t.stringLiteral('./'), t.stringLiteral('')]
                                      )
                                    )
                                  )
                                ]),
                                t.ifStatement(
                                  t.logicalExpression(
                                    '&&',
                                    t.unaryExpression(
                                      '!',
                                      t.callExpression(
                                        t.memberExpression(
                                          t.identifier('excludeKeys'),
                                          t.identifier('includes')
                                        ),
                                        [
                                          t.identifier('realKey')
                                        ]
                                      )
                                    ),
                                    t.unaryExpression(
                                      '!',
                                      t.callExpression(
                                        t.memberExpression(
                                          t.identifier('includeKeys'),
                                          t.identifier('includes')
                                        ),
                                        [
                                          t.identifier('realKey')
                                        ]
                                      )
                                    )
                                  ),
                                  t.blockStatement([
                                    t.expressionStatement(
                                      t.callExpression(
                                        t.memberExpression(
                                          t.identifier('includeKeys'),
                                          t.identifier('push')
                                        ),
                                        [
                                          t.identifier('realKey')
                                        ]
                                      )
                                    ),
                                    t.expressionStatement(
                                      t.assignmentExpression(
                                        '=',
                                        t.memberExpression(
                                          t.identifier('modules'),
                                          t.identifier('realKey'),
                                          true
                                        ),
                                        modulesKey
                                      )
                                    )
                                  ])
                                )
                              ])
                            )
                          ]
                        )
                      ),
                      t.returnStatement(t.identifier('modules'))
                    ])
                  ),
                  []
                )
              )
            ]
          )
        )
      })

      globBody.push(
        t.returnStatement(
          t.callExpression(
            t.memberExpression(
              t.identifier('Object'),
              t.identifier('assign')
            ),
            includeUrl.map((val, idx) => {
              return t.identifier('_url_' + idx)
            })
          )
        )
      )

      path.replaceWith(
        t.callExpression(
          t.functionExpression(
            null,
            [],
            t.blockStatement(globBody)
          ),
          []
        )
      )
    }
  })

  const output = generator(ast)
  return output.code
}
