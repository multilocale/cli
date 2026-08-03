/* Copyright 2013 - 2024 Waiterio LLC */
const fs = require('fs-extra')
const path = require('node:path')
const commander = require('commander')
const {
  withJson,
  printJson,
  fail,
} = require('@monorepool/agentfirst/output.js')
const ensureAuth = require('./ensureAuth.js')
const isAndroid = require('./isAndroid.js')
const isJavascript = require('./isJavascript.js')
const getFiles = require('./getFiles.js')
const getProject = require('./getProject.js')

function unusedCommand() {
  const command = new commander.Command('unused')
  command.description('find translation keys not used in any source file')
  command.option('--project [project]', 'project id or name')
  withJson(command)
  command.action(async options => {
    // Progress goes to stderr in json mode so stdout stays parseable.
    const print = options.json ? console.error : console.log

    try {
      print('find unused strings in project')

      await ensureAuth()

      const project = await getProject(options)
      const _defaultLocale = project.defaultLocale || 'en'

      if (isAndroid()) {
        print('Android project detected')

        throw new Error('Not implemented yet')
      } else if (isJavascript()) {
        print('Javascript project detected')

        let files = getFiles()
        const { locales, paths } = project
        print({ locales, paths })

        const locale2files = {}
        paths.forEach(path_ => {
          if (path_.includes('%lang%')) {
            locales.forEach(locale => {
              const suffix = path_.replace('%lang%', locale)
              const matchingFiles = files.filter(file => file.endsWith(suffix))

              if (matchingFiles.length === 0) {
                print(
                  `No matching files for path ${path_} and locale ${locale}`,
                )
              } else {
                if (!locale2files[locale]) {
                  locale2files[locale] = []
                }

                if (matchingFiles.length === 1) {
                  locale2files[locale].push(matchingFiles[0])
                } else if (matchingFiles.length > 1) {
                  print(
                    `Found multiple matching files for path ${path_} and locale ${locale}:`,
                  )
                  matchingFiles.forEach(matchingFile => {
                    print(`  ${matchingFile}`)
                    locale2files[locale].push(matchingFile)
                  })
                }
              }
            })
          } else {
            print(`Path ${path_} does not include %lang%`)
          }
        })

        const localesFound = Object.keys(locale2files)
        const filesFound = Object.values(locale2files).flat()

        const keysObject = {}

        if (filesFound.length > 0) {
          print(
            `Found ${filesFound.length} files in ${localesFound.length} locales:`,
          )
          filesFound.forEach(fileFound => print(`  ${fileFound}`))

          for (let l = 0; l < localesFound.length; l += 1) {
            const locale = localesFound[l]
            const files = locale2files[locale]

            for (let f = 0; f < files.length; f += 1) {
              let file = files[f]

              if (file.startsWith('/')) {
                file = file.substring(1)
              }

              const filePath = path.resolve(file)

              const fileString = fs.readFileSync(filePath, 'utf8')

              const extension = path.extname(file)

              let json

              if (extension === '.json') {
                json = JSON.parse(fileString)
              } else if (!extension === '.json') {
                throw new Error(
                  `It was not possible to detect the extension of ${file}`,
                )
              } else {
                throw new Error(
                  `Unsupported file extension ${extension} for file ${file}`,
                )
              }

              const keys = Object.keys(json)

              const language = locale

              keys.forEach(key => {
                keysObject[key] = true
              })

              print(`${language}: Found ${keys.length} keys`)
            }
          }

          const keys = Object.keys(keysObject)

          print(
            `Found ${keys.length} unique keys across all ${localesFound.length} locales`,
          )

          const extensions = ['.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs']
          files = files.filter(file => extensions.includes(path.extname(file)))

          for (let f = 0; f < files.length; f += 1) {
            const file = files[f]

            const filePath = path.join(path.resolve('.'), file)

            const fileContent = fs.readFileSync(filePath, 'utf8')

            for (let k = 0; k < keys.length; k += 1) {
              const key = keys[k]

              if (fileContent.includes(key)) {
                delete keysObject[key]
              }
            }
          }

          const unusedKeys = Object.keys(keysObject)

          if (options.json) {
            printJson(unusedKeys)

            return
          }

          console.log(
            `${
              unusedKeys.length
            } keys could not be found in any file with extensions ${extensions.join(
              ', ',
            )}:`,
          )
          console.log(unusedKeys)
        } else {
          throw new Error('Could not find any file matching paths in project')
        }
      } else {
        throw new Error(
          'Could not detect project type — run from the app root (Android needs an AndroidManifest.xml, JavaScript a package.json)',
        )
      }
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

module.exports = unusedCommand
