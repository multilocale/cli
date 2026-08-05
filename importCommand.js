/* Copyright 2013 - 2024 Waiterio LLC */
const fs = require('fs-extra')
const path = require('node:path')
const commander = require('commander')
const xml2js = require('xml2js')
const {
  withJson,
  printJson,
  fail,
} = require('@monorepool/agentfirst/output.js')
const addPhrasesModule = require('@multilocale/client/addPhrases.js')
const translateStringModule = require('@multilocale/client/translateString.js')
const uuidModule = require('@multilocale/client/uuid.js')

// `@multilocale/client` is ESM with default exports, so requiring it from this
// CommonJS bundle yields the namespace object, not the function. Every other
// command already unwraps it this way; importCommand called the namespace
// directly and died with `uuid2 is not a function` the moment it reached the
// first phrase — meaning `import`, the entry point for "I already have
// translation files", never worked in a published build. It was masked until
// now because it threw earlier, on `paths.forEach` (see getPaths.js).
const addPhrases = addPhrasesModule.default || addPhrasesModule
const translateString = translateStringModule.default || translateStringModule
const uuid = uuidModule.default || uuidModule
const ensureAuth = require('./ensureAuth.js')
const flattenTranslations = require('./flattenTranslations.js')
const _getAndroidResPath = require('./getAndroidResPath.js')
const isAndroid = require('./isAndroid.js')
const isJavascript = require('./isJavascript.js')
const getFiles = require('./getFiles.js')
const getPaths = require('./getPaths.js')
const getProject = require('./getProject.js')

const { isPlainObject } = flattenTranslations

function convertXmlStringToJson(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, (err, result) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

function importCommand() {
  const command = new commander.Command('import')
  command.description('import local translation files into multilocale.com')
  command.option('--project [project]', 'project id or name')
  command.option(
    '--no-flatten',
    'refuse nested dictionaries instead of flattening them into dot paths',
  )
  withJson(command)
  command.action(async options => {
    // Progress goes to stderr in json mode so stdout stays parseable.
    const print = options.json ? console.error : console.log

    try {
      print('import into multilocale.com')

      await ensureAuth()

      const project = await getProject(options)
      const defaultLocale = project.defaultLocale || 'en'

      if (isAndroid()) {
        print('Android project detected')

        let files = getFiles()
        files = files.filter(file => file.endsWith('strings.xml'))

        print(`Found ${files.length} languages`)

        let phrases = []

        for (let f = 0; f < files.length; f += 1) {
          const file = files[f]
          let language = defaultLocale
          if (file.includes('/values-')) {
            language = file.split('/values-')[1].split('/')[0] // eslint-disable-line
          }

          let stringsXmlPath = path.resolve(file)
          if (stringsXmlPath.startsWith('/')) {
            stringsXmlPath = stringsXmlPath.slice(1)
          }
          const stringsXml = fs.readFileSync(stringsXmlPath, 'utf8')

          const stringsJson = await convertXmlStringToJson(stringsXml)

          const phrasesForLanguage = stringsJson.resources.string.map(
            ({ $: { name }, _ }) => ({
              _id: uuid(),
              key: name,
              value: _,
              language,
              creationTime: new Date().toISOString(),
              lastEditTime: new Date().toISOString(),
              googleTranslate: false,
              imported: true,
              organizationId: project.organizationId,
              projects: [project.name],
            }),
          )

          print(`${language}: Found ${phrasesForLanguage.length} phrases`)

          phrases = phrases.concat(phrasesForLanguage)
        }

        await addPhrases(phrases)

        if (options.json) {
          printJson({
            ok: true,
            project: project.name,
            projectId: project._id,
            phrases: phrases.length,
            url: `https://app.multilocale.com/projects/${project._id}`,
          })

          return
        }

        console.log(
          `Added ${phrases.length} phrases: https://app.multilocale.com/projects/${project._id}`,
        )
      } else if (isJavascript()) {
        print('Javascript project detected')

        const files = getFiles()
        const { locales } = project
        const paths = getPaths({ project })
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

        if (filesFound.length > 0) {
          print(
            `Found ${filesFound.length} files in ${localesFound.length} locales:`,
          )
          filesFound.forEach(fileFound => print(`  ${fileFound}`))

          const key2locale2phrase = {}
          // Whether any file needed flattening, so the round trip can be
          // pointed out once at the end rather than after every file.
          let flattenedAnyFile = false

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

              if (!isPlainObject(json)) {
                throw new Error(
                  `${file} is not a JSON object — a translation file must be a dictionary of keys to strings`,
                )
              }

              // A phrase is a flat key/value pair. Nested dictionaries used to
              // be stored verbatim, so `{"checkout":{"failed":"…"}}` became a
              // phrase whose value was an object, which the machine translator
              // then billed credits to turn into garbage. Flatten to dot paths
              // first; nothing object-shaped may reach addPhrases.
              const { nested, skipped, translations } =
                flattenTranslations(json)

              if (nested && options.flatten === false) {
                throw new Error(
                  `${file} is a nested dictionary and --no-flatten was passed. ` +
                    'Multilocale phrases are flat key/value pairs — drop ' +
                    '--no-flatten to store nested keys as dot paths ' +
                    '(checkout.failed), or flatten the file yourself.',
                )
              }

              if (nested) {
                flattenedAnyFile = true
                print(
                  `${file}: nested dictionary flattened into dot paths (e.g. checkout.failed)`,
                )
              }

              skipped.forEach(({ key, reason }) => {
                print(`${file}: skipped key ${key} (${reason})`)
              })

              const keys = Object.keys(translations)

              const language = locale
              let phrasesForLanguage = 0

              keys.forEach(key => {
                if (!key2locale2phrase[key]) {
                  key2locale2phrase[key] = {}
                }

                let value = translations[key]

                if (!value && language === defaultLocale) {
                  value = key
                }

                if (value) {
                  const phrase = {
                    _id: uuid(),
                    key,
                    value,
                    language,
                    creationTime: new Date().toISOString(),
                    lastEditTime: new Date().toISOString(),
                    googleTranslate: false,
                    imported: true,
                    organizationId: project.organizationId,
                    projects: [project.name],
                    projectsIds: [project._id],
                  }

                  key2locale2phrase[key][locale] = phrase
                  phrasesForLanguage += 1
                }
              })

              print(`${language}: Found ${phrasesForLanguage} phrases`)
            }
          }

          // Phrases are flat, so a nested catalogue only round-trips if
          // `download` is told to re-nest it. Saying so here is the only place
          // the user is known to have nested files; discovering it later means
          // discovering it as a diff that rewrites every translation file.
          if (flattenedAnyFile) {
            print(
              'These files are nested: add "nested": true to multilocale.json (or pass --nested to download) to get them back in the same shape.',
            )
          }

          const keys = Object.keys(key2locale2phrase)

          for (let k = 0; k < keys.length; k += 1) {
            const key = keys[k]
            const locales = Object.keys(key2locale2phrase[key])

            if (locales.length === 0) {
              throw new Error(`key ${key} has no locales`)
            }

            let from = defaultLocale

            if (!key2locale2phrase[key][defaultLocale]) {
              from = locales[0]
            }

            const missingLocales = project.locales.filter(
              to => !locales.includes(to),
            )

            const BATCH_SIZE = 10
            for (let l = 0; l < missingLocales.length; l += BATCH_SIZE) {
              const batch = missingLocales.slice(l, l + BATCH_SIZE)
              await Promise.all(
                batch.map(async to => {
                  const phraseFrom = key2locale2phrase[key][from]
                  const string = phraseFrom.value

                  let translation

                  try {
                    const result = await translateString({ string, to, from })
                    translation = result.translation
                  } catch (_error) {
                    throw new Error(
                      `Could not translate '${string}' from ${from} to ${to}`,
                      { cause: _error },
                    )
                  }

                  const phraseTo = {
                    _id: uuid(),
                    key,
                    value: translation,
                    language: to,
                    creationTime: new Date().toISOString(),
                    lastEditTime: new Date().toISOString(),
                    googleTranslate: true,
                    organizationId: project.organizationId,
                    projects: [project.name],
                    projectsIds: [project._id],
                  }

                  print(`${to}: translated key ${key} to ${translation}`)

                  key2locale2phrase[key][to] = phraseTo
                }),
              )
            }
          }

          const phrases = Object.keys(key2locale2phrase).reduce(
            (phrases, key) =>
              phrases.concat(Object.values(key2locale2phrase[key])),
            [],
          )

          await addPhrases(phrases)

          if (options.json) {
            printJson({
              ok: true,
              project: project.name,
              projectId: project._id,
              phrases: phrases.length,
              url: `https://app.multilocale.com/projects/${project._id}`,
            })

            return
          }

          console.log(
            `Added ${phrases.length} phrases: https://app.multilocale.com/projects/${project._id}`,
          )
        } else {
          if (options.json) {
            printJson({ ok: true, project: project.name, phrases: 0 })

            return
          }

          console.log('Could not find any file matching paths in project')
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

module.exports = importCommand
