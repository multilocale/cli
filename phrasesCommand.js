/* Copyright 2013 - 2024 Waiterio LLC */
import { inspect } from 'node:util'

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import getPhrasesModule from '@multilocale/client/getPhrases.js'
import commander from 'commander'

import ensureAuth from './ensureAuth.js'
import getProject from './getProject.js'

const getPhrases = getPhrasesModule.default || getPhrasesModule

function phrasesCommand() {
  const command = new commander.Command('phrases')
  command.description('query phrases')

  // multilocale phrases list
  withJson(
    command
      .command('list')
      .description('list all phrases for a project, grouped by language'),
  )
    .option('--project [project]', 'project id or name')
    .option('-l, --language [language]', 'filter by language')
    .option('-k, --key [key]', 'filter by key')
    .option('--languages', 'only show list of languages')
    .action(async options => {
      try {
        await ensureAuth()

        const project = await getProject(options)

        const parameters = { project: project.name }
        if (options.language) parameters.language = options.language
        if (options.key) parameters.key = options.key

        const phrases = await getPhrases(parameters)

        const byLanguage = phrases.reduce((acc, phrase) => {
          if (!acc[phrase.language]) {
            acc[phrase.language] = []
          }
          acc[phrase.language].push(phrase)

          return acc
        }, {})

        const languages = Object.keys(byLanguage).sort()

        if (options.json) {
          printJson(options.languages ? languages : phrases)

          return
        }

        if (phrases.length === 0) {
          console.log('No phrases found')

          return
        }

        if (options.languages) {
          console.log(
            `${languages.length} language(s): ${languages.join(', ')}`,
          )

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
        fail(error, { json: options.json })
      }
    })

  // multilocale phrases get [key]
  withJson(
    command
      .command('get [key]')
      .description('get raw JSON of phrases, optionally filtered by key'),
  )
    .option('--project [project]', 'project id or name')
    .option('-l, --language [language]', 'filter by language')
    .option('-k, --key [key]', 'filter by key')
    .option('-n, --limit [limit]', 'limit number of results')
    .action(async (key, options) => {
      try {
        await ensureAuth()

        const project = await getProject(options)

        const parameters = { project: project.name }
        if (key || options.key) parameters.key = key || options.key
        if (options.language) parameters.language = options.language

        let phrases = await getPhrases(parameters)

        if (options.limit) {
          phrases = phrases.slice(0, parseInt(options.limit, 10))
        }

        if (options.json) {
          printJson(phrases)
        } else {
          console.log(inspect(phrases, { colors: true, depth: null }))
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    })

  return command
}

export default phrasesCommand
