/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const { execSync } = require('child_process')
const fs = require('fs-extra')
const path = require('node:path')
const {
  withJson,
  printJson,
  fail,
} = require('@monorepool/agentfirst/output.js')
const getPhrasesModule = require('@multilocale/client/getPhrases.js')

const getPhrases = getPhrasesModule.default || getPhrasesModule
const ensureAuth = require('./ensureAuth.js')
const getAndroidResPath = require('./getAndroidResPath.js')
const getExtension = require('./getExtension.js')
const getFormat = require('./getFormat.js')
const getHeader = require('./getHeader.js')
const getNested = require('./getNested.js')
const getPaths = require('./getPaths.js')
const getProject = require('./getProject.js')
const getPostScript = require('./getPostScript.js')
const isAndroid = require('./isAndroid.js')
const unflattenTranslations = require('./unflattenTranslations.js')

function sortObject(o) {
  return Object.keys(o)
    .sort()
    .reduce((r, k) => {
      r[k] = o[k]
      return r
    }, {})
}

// Sorting a nested dictionary has to recurse: sorting only the flat dot-path
// keys gets the top level almost right and every deeper level wrong, and a
// dictionary whose key order changes between runs makes every download a diff.
function sortObjectDeep(o) {
  return Object.keys(o)
    .sort()
    .reduce((r, k) => {
      const value = o[k]
      r[k] =
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? sortObjectDeep(value)
          : value
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
  // Defining --nested before --no-nested keeps the option tri-state in
  // commander: undefined when neither is passed, so multilocale.json still
  // gets a say, instead of an implicit default overriding it.
  command.option(
    '--nested',
    'write nested dictionaries, re-nesting dot-path keys (checkout.failed)',
  )
  command.option('--no-nested', 'write flat dot-path keys (default)')
  command.option(
    '--post-script [post-script]',
    'post-script to run after downloading dictionary files',
  )
  withJson(command)
  command.action(async options => {
    // Progress goes to stderr in json mode so stdout stays parseable.
    const print = options.json ? console.error : console.log

    try {
      print('download')

      await ensureAuth()

      let project = await getProject(options)
      let format = await getFormat(options)
      let extension = await getExtension(options)
      let header = await getHeader(options)
      let nested = await getNested(options)
      let postScript = await getPostScript(options)

      // Every dictionary file written, as printed, for the json result.
      const writtenFiles = []

      print(`Project: ${project.name} (${project._id})`)
      print(`Format: ${format}`)
      print(`Extension: ${extension}`)

      // Nesting is a property of an object-shaped dictionary. Android string
      // resources and Apple .strings are flat key/value files with nowhere to
      // put a nested key, so the flag is reported as ignored rather than
      // silently written into something the platform cannot parse.
      if (nested && (isAndroid() || format === 'swift')) {
        print(
          `Nested: ignored, ${
            isAndroid() ? 'Android string resources are' : 'the swift format is'
          } a flat key/value file`,
        )
        nested = false
      } else if (nested) {
        print('Nested: true')
      }

      if (header) {
        print(
          `Header: ${header.replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t')}`,
        )
      }

      if (postScript) {
        print(`Post-script: ${postScript}`)
      }

      const phrases = await getPhrases({
        project: project.name,
      })
      print(`Found ${phrases?.length ?? 0} phrases`)

      if (isAndroid()) {
        print('Android project detected')
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
        const languages = Object.keys(language2key2value).sort()

        print(`Found ${languages?.length ?? 0} languages`)

        for (let l = 0; l < languages.length; l += 1) {
          const language = languages[l]
          const key2value = sortObject(language2key2value[language])
          const keys = Object.keys(key2value)
          const stringsXml =
            '<?xml version="1.0" encoding="utf-8"?>\n' +
            `<resources>\n${keys.reduce((string, key) => {
              const value = key2value[key] || ''

              string += `<string name="${key}">${escapeAndroidStringValue(value)}</string>\n`

              return string
            }, '')}</resources>\n`

          const folderPath =
            language === 'en'
              ? path.resolve(androidResPath, 'values')
              : path.resolve(androidResPath, `values-${language}`)

          if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath)
          }
          const stringsXmlPath = path.resolve(folderPath, 'strings.xml')

          const stringXmlPretty = stringsXml

          fs.writeFileSync(stringsXmlPath, stringXmlPretty)
          writtenFiles.push(stringsXmlPath.replace(path.resolve('.'), ''))
          print(`${language}: ${stringsXmlPath.replace(path.resolve('.'), '')}`)
        }

        if (options.json) {
          printJson({
            ok: true,
            project: project.name,
            format: 'android',
            nested,
            files: writtenFiles,
          })
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
        const paths = getPaths({ project, format, extension })

        paths.forEach(path_ => {
          if (path_.includes('%lang%')) {
            locales.forEach(language => {
              const phrasesDictionaryPath = path.resolve(
                path_.replace('%lang%', language),
              )
              // `?? {}` because a configured locale with no phrases yet has no
              // entry here at all, and sortObject would throw `Cannot convert
              // undefined or null to object` — taking the whole download down
              // rather than the one empty locale. A project with 96 locales and
              // phrases in `en` only is the normal state right after
              // `projects create`, so this was the common case, not the edge.
              // Writing the empty dictionary is right: the file's absence is
              // what the runtime would fail on.
              const key2value = sortObject(language2key2value[language] ?? {})

              // Flat is what a phrase set is; nesting is a rendering of it, so
              // it happens here, on the way out, and only when asked for.
              // `dictionary` is the flat map itself unless --nested/"nested"
              // says otherwise, which keeps the default output byte-identical.
              let dictionary = key2value

              if (nested) {
                const unflattened = unflattenTranslations(key2value)

                unflattened.conflicts.forEach(({ key, reason }) => {
                  print(`  ${language}: kept ${key} flat — ${reason}`)
                })

                dictionary = sortObjectDeep(unflattened.translations)
              }

              fs.mkdirSync(path.dirname(phrasesDictionaryPath), {
                recursive: true,
              })

              let dictionaryFileContent = ''

              if (header) {
                dictionaryFileContent += `${header}`
              }

              if (format === 'json') {
                dictionaryFileContent += JSON.stringify(dictionary, null, 2)
              } else if (format === 'esm') {
                dictionaryFileContent += `export default ${JSON.stringify(dictionary, null, 2)}`
              } else if (format === 'js') {
                dictionaryFileContent += `module.exports = ${JSON.stringify(dictionary, null, 2)}`
              } else if (format === 'cjs') {
                dictionaryFileContent += `module.exports = ${JSON.stringify(dictionary, null, 2)}`
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

              writtenFiles.push(
                phrasesDictionaryPath.replace(path.resolve('.'), ''),
              )
              print(
                `  ${language}: ${phrasesDictionaryPath.replace(
                  path.resolve('.'),
                  '',
                )}`,
              )
            })
          } else {
            print(`Path ${path_} does not include %lang%`)
          }
        })

        if (postScript) {
          print(`Running post-script: ${postScript}`)
          // In json mode the post-script's stdout is routed to stderr so it
          // cannot pollute the JSON result on stdout.
          execSync(postScript, {
            stdio: options.json
              ? ['ignore', process.stderr, process.stderr]
              : 'inherit',
          })
          print('Post-script completed')
        }

        if (options.json) {
          printJson({
            ok: true,
            project: project.name,
            format,
            nested,
            files: writtenFiles,
          })

          return
        }

        console.log('Download completed')
      }
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

module.exports = downloadCommand
