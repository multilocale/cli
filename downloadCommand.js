/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const { execSync } = require('child_process')
const fs = require('fs-extra')
const path = require('node:path')
const getPhrasesModule = require('@multilocale/client/getPhrases.js')

const getPhrases = getPhrasesModule.default || getPhrasesModule
const rehydrateSession = require('./session/rehydrateSession.js')
const isLoggedInSession = require('./session/isLoggedInSession.js')
const getAndroidResPath = require('./getAndroidResPath.js')
const getConfig = require('./getConfig.js')
const getExtension = require('./getExtension.js')
const getFormat = require('./getFormat.js')
const getHeader = require('./getHeader.js')
const getProject = require('./getProject.js')
const getPostScript = require('./getPostScript.js')
const isAndroid = require('./isAndroid.js')
const login = require('./login.js')

function sortObject(o) {
  return Object.keys(o)
    .sort()
    .reduce((r, k) => {
      r[k] = o[k]
      return r
    }, {})
}

// Android string-resource escape rules: `&`/`<`/`>` are XML-escaped,
// apostrophe and double-quote get backslash-escaped (Android's resource
// parser treats unescaped quotes as string delimiters and apostrophes as
// literal markers). Without this, values like "Tips & best practices" or
// "Today's schedule" make `aapt` reject the resource file. Some imported
// values already contain `\'` / `\"` escapes from a previous Android
// import — the negative lookbehind keeps us from doubling those into
// `\\'` (which Android then misreads as `\` followed by an unescaped `'`).
function escapeAndroidStringValue(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(?<!\\)'/g, "\\'")
    .replace(/(?<!\\)"/g, '\\"')
}

// Apple .strings escape rules: backslash, double-quote, and control
// characters must be escaped. The file is parsed as an old-style
// property list, so unescaped quotes terminate the string.
function escapeSwiftStringValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function downloadCommand() {
  const command = new commander.Command('download')
  command.description('download translation files from multilocale.com')
  command.option('--project [project]', 'project id or name')
  command.option('--format [format]', 'format of dictionary files')
  command.option('--extension [extension]', 'extension of dictionary files')
  command.option('--header [header]', 'header of dictionary files')
  command.option(
    '--post-script [post-script]',
    'post-script to run after downloading dictionary files',
  )
  command.action(async options => {
    try {
      console.log('download')

      rehydrateSession()

      if (!isLoggedInSession()) {
        await login()
      }

      let project = await getProject(options)
      let format = await getFormat(options)
      let extension = await getExtension(options)
      let header = await getHeader(options)
      let postScript = await getPostScript(options)

      console.log(`Project: ${project.name} (${project._id})`)
      console.log(`Format: ${format}`)
      console.log(`Extension: ${extension}`)

      if (header) {
        console.log(
          `Header: ${header.replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t')}`,
        )
      }

      if (postScript) {
        console.log(`Post-script: ${postScript}`)
      }

      const phrases = await getPhrases({
        project: project.name,
      })
      console.log(`Found ${phrases?.length ?? 0} phrases`)

      if (isAndroid()) {
        console.log('Android project detected')
        const androidResPath = getAndroidResPath()

        const language2key2value = phrases.reduce(
          (language2key2value, phrase) => {
            if (!language2key2value[phrase.language]) {
              language2key2value[phrase.language] = {
                locale: phrase.language,
              }
            }
            language2key2value[phrase.language][phrase.key] = phrase.value
            return language2key2value
          },
          {},
        )
        // console.log('language2key2value', language2key2value)
        const languages = Object.keys(language2key2value).sort()

        console.log(`Found ${languages?.length ?? 0} languages`)

        for (let l = 0; l < languages.length; l += 1) {
          const language = languages[l]
          const key2value = sortObject(language2key2value[language])
          const keys = Object.keys(key2value)
          const stringsXml =
            // '/* DO NOT EDIT MANUALLY */\n' +
            // `/* Edit at https://app.multilocale.com/projects/${project._id} */\n` +
            // '/* Download translation files with https://github.com/multilocale/multilocale-cli */\n' +
            '<?xml version="1.0" encoding="utf-8"?>\n' +
            `<resources>\n${
            keys.reduce((string, key) => {
              const value = key2value[key] || ''

              string += `<string name="${key}">${escapeAndroidStringValue(value)}</string>\n`

              return string
            }, '')
            }</resources>\n`

          const folderPath =
            language === 'en'
              ? path.resolve(androidResPath, 'values')
              : path.resolve(androidResPath, `values-${language}`)

          // console.log({ folderPath })

          if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath)
          }
          const stringsXmlPath = path.resolve(folderPath, 'strings.xml')

          // console.log({ stringsXmlPath })

          const stringXmlPretty = stringsXml

          // console.log({ stringXmlPretty })

          fs.writeFileSync(stringsXmlPath, stringXmlPretty)
          console.log(
            `${language}: ${stringsXmlPath.replace(path.resolve('.'), '')}`,
          )
        }
      } else {
        const language2key2value = phrases.reduce(
          (language2key2value, phrase) => {
            if (!language2key2value[phrase.language]) {
              language2key2value[phrase.language] = {
                locale: phrase.language,
              }
            }
            language2key2value[phrase.language][phrase.key] = phrase.value
            return language2key2value
          },
          {},
        )

        const { locales } = project
        const config = getConfig()
        let paths = project.paths || config?.paths

        if (!paths) {
          if (format === 'swift') {
            paths = [`%lang%.lproj/Localizable.${extension}`]
          } else {
            paths = [`translations/%lang%.${extension}`]
          }
        }

        paths.forEach(path_ => {
          if (path_.includes('%lang%')) {
            locales.forEach(language => {
              const phrasesDictionaryPath = path.resolve(
                path_.replace('%lang%', language),
              )
              const key2value = sortObject(language2key2value[language])

              fs.mkdirSync(path.dirname(phrasesDictionaryPath), {
                recursive: true,
              })

              let dictionaryFileContent = ''

              if (header) {
                dictionaryFileContent += `${header}`
              }

              if (format === 'json') {
                dictionaryFileContent += JSON.stringify(key2value, null, 2)
              } else if (format === 'esm') {
                dictionaryFileContent += `export default ${JSON.stringify(key2value, null, 2)}`
              } else if (format === 'js') {
                dictionaryFileContent += `module.exports = ${JSON.stringify(key2value, null, 2)}`
              } else if (format === 'cjs') {
                dictionaryFileContent += `module.exports = ${JSON.stringify(key2value, null, 2)}`
              } else if (format === 'swift') {
                const keys = Object.keys(key2value).filter(k => k !== 'locale')
                dictionaryFileContent += keys
                  .map(
                    key =>
                      `"${escapeSwiftStringValue(key)}" = "${escapeSwiftStringValue(key2value[key] || '')}";`,
                  )
                  .join('\n')
              }

              dictionaryFileContent += '\n'

              fs.writeFileSync(phrasesDictionaryPath, dictionaryFileContent)

              console.log(
                `  ${language}: ${phrasesDictionaryPath.replace(
                  path.resolve('.'),
                  '',
                )}`,
              )
            })
          } else {
            console.log(`Path ${path_} does not include %lang%`)
          }
        })

        if (postScript) {
          console.log(`Running post-script: ${postScript}`)
          execSync(postScript, { stdio: 'inherit' })
          console.log('Post-script completed')
        }

        // let indexJS = ''
        // languages.forEach(language => {
        //   indexJS += `const ${language} = require('./${language}.json'\n`)
        // })
        // indexJS += '\nmodule.exports = {\n'
        // languages.forEach(language => {
        //   indexJS += `  ${language},\n`
        // })
        // indexJS += '}\n'
        // fs.mkdirsSync(path.resolve('./translations'))
        // fs.writeFileSync(path.resolve('./translations/index), indexJS)
        // let languagesJS = 'module.exports = [\n'
        // languages.forEach(language => {
        //   languagesJS += `  '${language}',\n`
        // })
        // languagesJS += ']\n'
        // fs.writeFileSync(
        //   path.resolve('./translations/languages),
        //   languagesJS,
        // )

        console.log('Download completed')
      }
    } catch (error) {
      console.log('error', error)
    }
  })

  return command
}

module.exports = downloadCommand
