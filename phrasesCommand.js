/* Copyright 2013 - 2024 Waiterio LLC */
const { inspect } = require('node:util')
const commander = require('commander')
const getPhrasesModule = require('@multilocale/client/getPhrases.js')

const getPhrases = getPhrasesModule.default || getPhrasesModule
const rehydrateSession = require('./session/rehydrateSession.js')
const isLoggedInSession = require('./session/isLoggedInSession.js')
const getProject = require('./getProject.js')
const login = require('./login.js')

function phrasesCommand() {
  const command = new commander.Command('phrases')
  command.description('query phrases')

  // multilocale phrases list
  command
    .command('list')
    .description('list all phrases for a project, grouped by language')
    .option('--project [project]', 'project id or name')
    .option('-l, --language [language]', 'filter by language')
    .option('-k, --key [key]', 'filter by key')
    .option('--languages', 'only show list of languages')
    .action(async options => {
      try {
        rehydrateSession()

        if (!isLoggedInSession()) {
          console.log('Please login first')
          await login()
          rehydrateSession()
        }

        const project = await getProject(options)

        const parameters = { project: project.name }
        if (options.language) parameters.language = options.language
        if (options.key) parameters.key = options.key

        const phrases = await getPhrases(parameters)

        if (phrases.length === 0) {
          console.log('No phrases found')

          return
        }

        const byLanguage = phrases.reduce((acc, phrase) => {
          if (!acc[phrase.language]) {
            acc[phrase.language] = []
          }
          acc[phrase.language].push(phrase)

          return acc
        }, {})

        const languages = Object.keys(byLanguage).sort()

        if (options.languages) {
          console.log(`${languages.length} language(s): ${languages.join(', ')}`)

          return
        }

        console.log(
          `Found ${phrases.length} phrase(s) across ${languages.length} language(s)`,
        )

        languages.forEach(lang => {
          const langPhrases = byLanguage[lang]
          console.log(`\n${lang} (${langPhrases.length} phrases):`)
          langPhrases.forEach(phrase => {
            console.log(`  ${phrase.key}: ${phrase.value}`)
          })
        })
      } catch (error) {
        console.log('error', error)
      }
    })

  // multilocale phrases get [key]
  command
    .command('get [key]')
    .description('get raw JSON of phrases, optionally filtered by key')
    .option('--project [project]', 'project id or name')
    .option('-l, --language [language]', 'filter by language')
    .option('-k, --key [key]', 'filter by key')
    .option('-n, --limit [limit]', 'limit number of results')
    .action(async (key, options) => {
      try {
        rehydrateSession()

        if (!isLoggedInSession()) {
          console.log('Please login first')
          await login()
          rehydrateSession()
        }

        const project = await getProject(options)

        const parameters = { project: project.name }
        if (key || options.key) parameters.key = key || options.key
        if (options.language) parameters.language = options.language

        let phrases = await getPhrases(parameters)

        if (options.limit) {
          phrases = phrases.slice(0, parseInt(options.limit, 10))
        }

        console.log(inspect(phrases, { colors: true, depth: null }))
      } catch (error) {
        console.log('error', error)
      }
    })

  return command
}

module.exports = phrasesCommand
