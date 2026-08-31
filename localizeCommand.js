/* Copyright 2013 - 2024 Waiterio LLC */

import path from 'node:path'

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import languagesModule from '@monorepool/shared/languages.js'
import addPhrasesModule from '@multilocale/client/addPhrases.js'
import getPhrasesModule from '@multilocale/client/getPhrases.js'
import translateToAllLanguagesModule from '@multilocale/client/translateToAllLanguages.js'
import translateToAllLanguagesLocalModule from '@multilocale/client/translateToAllLanguagesLocal.js'
import updateProjectModule from '@multilocale/client/updateProject.js'
import uuidModule from '@multilocale/client/uuid.js'
import commander from 'commander'
import fs from 'fs-extra'

import ensureAuth from './ensureAuth.js'
import getFiles from './getFiles.js'
import getProject from './getProject.js'
import isAndroid from './isAndroid.js'
import isJavascript from './isJavascript.js'

const addPhrases = addPhrasesModule.default || addPhrasesModule
const getPhrases = getPhrasesModule.default || getPhrasesModule
const translateToAllLanguages =
  translateToAllLanguagesModule.default || translateToAllLanguagesModule
const translateToAllLanguagesLocal =
  translateToAllLanguagesLocalModule.default ||
  translateToAllLanguagesLocalModule
const updateProject = updateProjectModule.default || updateProjectModule
const uuid = uuidModule.default || uuidModule
const languages = languagesModule.default || languagesModule

// Phrases per POST to /api/phrases. Sized well under the api's body limit —
// one project's full widening is tens of thousands of rows and a single write
// returns 413.
const ADD_PHRASES_CHUNK = 500
const GET_PHRASES_LOCALE_BATCH = 8
const UNTRANSLATED_TECHNICAL_LABEL = /^(?:PC\d+|HIRAGANA|KATAKANA)\b/

async function getPhrasesByLocales({ project, locales, log = console.log }) {
  const phrases = []

  for (
    let index = 0;
    index < locales.length;
    index += GET_PHRASES_LOCALE_BATCH
  ) {
    const localeBatch = locales.slice(index, index + GET_PHRASES_LOCALE_BATCH)
    // Fetching a whole app in one request can exceed the API response limit.
    // Locale-sized requests keep the payloads bounded while a small parallel
    // batch avoids turning a reconciliation into 96 serial round trips.
    // eslint-disable-next-line no-await-in-loop
    const batchPhrases = await Promise.all(
      localeBatch.map(language =>
        getPhrases({
          language,
          project,
        }),
      ),
    )

    phrases.push(...batchPhrases.flat())
    log(
      `Read ${Math.min(index + localeBatch.length, locales.length)}/${locales.length} locales`,
    )
  }

  return phrases
}

function addLocaleCommand() {
  const command = new commander.Command('localize')
  command.description(
    'add a new locale and translate all existing phrases into it',
  )
  command.option('--project [project]', 'project id or name')
  command.option(
    '-m, --model <model>',
    'translation model (uses local LLM if available: claude, codex; fallback to API: gpt-5.6-luna, gpt-5-mini, gemini-3.5-flash, claude-haiku-4-5)',
    'gpt-5.6-luna',
  )
  command.argument(
    '<locales>',
    'comma-separated locales or "all" to add and translate',
  )
  withJson(command)
  command.action(async (localesArg, options) => {
    // Progress goes to stderr in json mode so stdout stays parseable.
    const print = options.json ? console.error : console.log

    try {
      print('localize')

      if (!localesArg) {
        throw new Error(`argument locales '${localesArg}' is not valid`)
      }

      await ensureAuth()

      let project = await getProject(options)
      const defaultLocale = project.defaultLocale || 'en'

      let localesToAdd

      if (localesArg === 'all') {
        localesToAdd = Object.keys(languages)
      } else {
        localesToAdd = localesArg.split(',').map(l => l.trim())
      }

      // Two different sets, and conflating them is what made this command
      // unable to finish a job it had already half-done:
      //   localesRequested — every locale the phrases must end up covering
      //   localesNew       — the subset the PROJECT does not list yet
      // Adding a locale to the project and translating the phrases into it are
      // separate steps, and the second is far slower, so any interruption
      // leaves the project listing locales it has no phrases for. Returning
      // early on "no new locales" meant a re-run could never repair that — the
      // project looked done and the phrases stayed missing, which ships as an
      // untranslated page. Reconcile against localesRequested instead; the
      // per-key filter below skips whatever is already complete, so a re-run is
      // cheap and idempotent.
      const localesRequested = [...localesToAdd]
      const localesNew = localesToAdd.filter(l => !project.locales.includes(l))
      const alreadyPresent = localesToAdd.filter(l =>
        project.locales.includes(l),
      )

      if (alreadyPresent.length > 0) {
        print(
          `Already on the project: ${alreadyPresent.length} locales — will still reconcile their phrases`,
        )
      }

      if (localesNew.length > 0) {
        print(`Locales to add: ${localesNew.join(', ')}`)
      }

      localesToAdd = localesRequested

      if (isAndroid()) {
        print('Android project detected')

        throw new Error('Not implemented yet')
      } else if (isJavascript()) {
        print('Javascript project detected')

        // localesNew, not localesToAdd — the latter is now the full requested
        // set and would re-add locales the project already lists.
        const updatedLocales = [...project.locales, ...localesNew]
        // `paths` is only set on projects that keep translations as local
        // files; a `*-www` project has none, and `paths.forEach` below used to
        // throw "Cannot read properties of undefined" right after
        // updateProject() had already widened the locale list.
        const { paths = [] } = project

        project = await updateProject({
          ...project,
          locales: updatedLocales,
        })

        print(
          `Project ${project.name || project._id} now lists ${updatedLocales.length} locales (${localesNew.length} added)`,
        )

        const files = getFiles()
        const locales = updatedLocales

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

        const key2locale2phrase = {}

        if (filesFound.length > 0) {
          print(
            `Found ${filesFound.length} files in ${localesFound.length} locales:`,
          )
          filesFound.forEach(fileFound => print(`  ${fileFound}`))

          for (let l = 0; l < localesFound.length; l += 1) {
            const locale = localesFound[l]
            const localeFiles = locale2files[locale]

            for (let f = 0; f < localeFiles.length; f += 1) {
              let file = localeFiles[f]

              if (file.startsWith('/')) {
                file = file.substring(1)
              }

              const filePath = path.resolve(file)

              const fileString = fs.readFileSync(filePath, 'utf8')

              const extension = path.extname(file)

              let json

              if (extension === '.json') {
                json = JSON.parse(fileString)
              } else {
                throw new Error(
                  `Unsupported file extension ${extension} for file ${file}`,
                )
              }

              const keys = Object.keys(json)

              const language = locale
              let phrasesForLanguage = 0

              keys.forEach(key => {
                if (!key2locale2phrase[key]) {
                  key2locale2phrase[key] = {}
                }

                let value = json[key]

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
        } else {
          // Not every project keeps its translations as local files. A `*-www`
          // project has no `paths` at all — its phrases live on
          // multilocale.com and the build fetches them — so seeding from disk
          // finds nothing. Falling through here used to print "Could not find
          // any file matching paths" and translate nothing, which is worse
          // than failing: updateProject() above has already widened the
          // project's locale list, so the project ends up advertising locales
          // it has no phrases for. Read the existing phrases from the server
          // and translate those instead.
          print(
            'No local translation files matched — reading existing phrases from multilocale.com',
          )

          const phrases = await getPhrasesByLocales({
            project: project.name,
            locales: updatedLocales,
            log: print,
          })

          phrases.forEach(phrase => {
            if (!key2locale2phrase[phrase.key]) {
              key2locale2phrase[phrase.key] = {}
            }
            key2locale2phrase[phrase.key][phrase.language] = phrase
          })

          print(
            `Found ${phrases.length} phrase rows across ${Object.keys(key2locale2phrase).length} keys`,
          )
        }

        {
          const keys = Object.keys(key2locale2phrase)

          const newPhrases = []
          const failedKeys = []
          let addedTotal = 0

          for (let k = 0; k < keys.length; k += 1) {
            const key = keys[k]
            const existingLocales = Object.keys(key2locale2phrase[key])

            if (existingLocales.length === 0) {
              throw new Error(`key ${key} has no locales`)
            }

            let from = defaultLocale

            if (!key2locale2phrase[key][defaultLocale]) {
              from = existingLocales[0]
            }

            const phraseFrom = key2locale2phrase[key][from]
            const string = phraseFrom.value

            // Per key, not the global localesToAdd: a key can already hold
            // some of the target locales — from a shared phrase, or from an
            // earlier run that died partway through hundreds of keys. Asking
            // for those again would write a second row for the same
            // (key, language). Filtering here also makes the command safe to
            // re-run: a second invocation translates only what is still
            // missing.
            const localesMissing = localesToAdd.filter(
              locale => !key2locale2phrase[key][locale],
            )

            if (localesMissing.length === 0) {
              print(`Skipping key "${key}" — already complete`)

              continue // eslint-disable-line no-continue
            }

            print(
              `Translating key "${key}" to ${localesMissing.length} locales...`,
            )

            // The translate endpoint returns intermittent 503s under load, and
            // the client's own `retries: 3` is not enough — during a long run
            // several keys will exhaust it. Throwing here used to abandon the
            // whole project on one bad key, losing every key after it, and the
            // original error was swallowed (`catch (_error)`) so the log said
            // only "Could not translate", never that it was a 503.
            // Back off and retry, and if a key still will not translate, skip
            // it and carry on: one unavailable key is not a reason to lose the
            // other 200. Skipped keys are reported at the end rather than
            // silently dropped, and a re-run picks them up.
            let language2value
            let usedLocalLlm = false
            let translationModel = options.model
            if (UNTRANSLATED_TECHNICAL_LABEL.test(string)) {
              print(
                `Keeping technical label "${string}" unchanged in every locale`,
              )
              language2value = Object.fromEntries(
                localesMissing.map(locale => [locale, string]),
              )
            } else {
              let attempt = 0

              for (;;) {
                try {
                  if (attempt === 0) {
                    try {
                      const localResult = await translateToAllLanguagesLocal({
                        value: string,
                        languages: localesMissing,
                        from,
                      })
                      language2value = localResult.language2value
                      usedLocalLlm = true
                      translationModel = localResult.model
                      print(`  using local ${translationModel}`)
                      break
                    } catch (localError) {
                      print(
                        `  local translation unavailable: ${localError.message}`,
                      )
                      print(`  falling back to multilocale API...`)
                    }
                  }

                  language2value = await translateToAllLanguages({
                    value: string,
                    languages: localesMissing,
                    from,
                    model: options.model,
                    projectId: project._id,
                  })
                  break
                } catch (error) {
                  attempt += 1
                  const status = error?.cause?.status || error?.status || '?'

                  if (attempt > 5) {
                    print(
                      `Giving up on key "${key}" after ${attempt} attempts (last status ${status}) — skipping`,
                    )
                    failedKeys.push(key)
                    break
                  }

                  const backoffMs = attempt * 5000

                  print(
                    `  translate failed for "${key}" (status ${status}), retry ${attempt}/5 in ${backoffMs / 1000}s`,
                  )
                  await new Promise(resolve => {
                    setTimeout(resolve, backoffMs)
                  })
                }
              }

              if (language2value) {
                translationModel = usedLocalLlm
                  ? translationModel
                  : options.model
              }
            }

            if (!language2value) {
              continue // eslint-disable-line no-continue
            }

            localesMissing.forEach(localeToAdd => {
              const translation = language2value[localeToAdd]
              const phraseTo = {
                _id: uuid(),
                key,
                value: translation,
                language: localeToAdd,
                creationTime: new Date().toISOString(),
                lastEditTime: new Date().toISOString(),
                googleTranslate: !usedLocalLlm,
                machineTranslated: true,
                model: translationModel,
                context: null,
                organizationId:
                  phraseFrom.organizationId || project.organizationId,
                projects: phraseFrom.projects?.length
                  ? [...phraseFrom.projects]
                  : [project.name],
                projectsIds: phraseFrom.projectsIds?.length
                  ? [...phraseFrom.projectsIds]
                  : [project._id],
              }

              print(`${localeToAdd}: translated key ${key} to ${translation}`)

              newPhrases.push(phraseTo)
            })

            // Flush as we go rather than accumulating every phrase for one
            // POST at the end. That single write was unbounded: widening
            // one large site meant 191 keys x 69 locales in one body, which the
            // api rejected with 413 Request Entity Too Large — discarding 46
            // minutes of translation at the last step, with nothing saved.
            // Chunking keeps the payload bounded and makes partial progress
            // durable, so an interrupted run keeps what it already translated
            // and a re-run only picks up the remainder.
            if (newPhrases.length >= ADD_PHRASES_CHUNK) {
              const phrasesToSave = newPhrases.splice(0, newPhrases.length)
              await addPhrases(phrasesToSave)
              addedTotal += phrasesToSave.length
              print(`  saved ${addedTotal} phrases so far`)
            }
          }

          if (newPhrases.length > 0) {
            addedTotal += newPhrases.length
            await addPhrases(newPhrases.splice(0, newPhrases.length))
          }

          if (options.json) {
            printJson({
              ok: failedKeys.length === 0,
              project: project.name,
              projectId: project._id,
              locales: localesRequested,
              added: addedTotal,
              failedKeys,
              url: `https://app.multilocale.com/projects/${project._id}`,
            })
          } else {
            console.log(
              `Added ${addedTotal} phrases: https://app.multilocale.com/projects/${project._id}`,
            )
          }

          // Never let a partial run read as a complete one. The command exits
          // 0 either way, so this signal is the only one that the project is
          // still short — re-run it once the translate service recovers.
          if (failedKeys.length > 0) {
            print(
              `INCOMPLETE: ${failedKeys.length} key(s) could not be translated and were skipped: ${failedKeys.join(', ')}`,
            )
            process.exitCode = 1
          }
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

export default addLocaleCommand
