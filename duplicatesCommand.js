/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const getPhrasesModule = require('@multilocale/client/getPhrases.js')

const getPhrases = getPhrasesModule.default || getPhrasesModule
const rehydrateSession = require('./session/rehydrateSession.js')
const isLoggedInSession = require('./session/isLoggedInSession.js')
const getProject = require('./getProject.js')
const login = require('./login.js')

const bold = text => `\x1b[1m${text}\x1b[22m`
const cyan = text => `\x1b[36m${text}\x1b[39m`
const green = text => `\x1b[32m${text}\x1b[39m`
const yellow = text => `\x1b[33m${text}\x1b[39m`
const dim = text => `\x1b[2m${text}\x1b[22m`

function duplicatesCommand() {
  const command = new commander.Command('duplicates')
  command.description(
    'find phrase keys with duplicate values in the default language',
  )
  command.option('--project [project]', 'project id or name')
  command.action(async options => {
    try {
      rehydrateSession()

      if (!isLoggedInSession()) {
        await login()
      }

      const project = await getProject(options)
      const language = project.defaultLocale || 'en'

      console.log(
        `Fetching phrases for language "${language}" in project "${project.name}"...`,
      )

      const phrases = await getPhrases({
        language,
        project: project.name,
      })

      const projectName = project.name
      const valueToEntries = {}

      phrases.forEach(phrase => {
        const { key, value, projects } = phrase

        if (!valueToEntries[value]) {
          valueToEntries[value] = []
        }

        valueToEntries[value].push({ key, projects: projects || [] })
      })

      const duplicates = Object.entries(valueToEntries).filter(
        ([, entries]) => entries.length > 1,
      )

      if (duplicates.length === 0) {
        console.log(green('No duplicate values found.'))
      } else {
        console.log(
          bold(`Found ${yellow(duplicates.length)} duplicate values:\n`),
        )

        duplicates.forEach(([value, entries]) => {
          console.log(bold(cyan(`"${value}":`)))

          entries.forEach(entry => {
            const otherProjects = entry.projects.filter(
              p => p !== projectName,
            )

            if (otherProjects.length > 0) {
              console.log(
                `  - ${yellow(entry.key)}  ${dim(`(also in: ${otherProjects.join(', ')})`)}`,
              )
            } else {
              console.log(`  - ${yellow(entry.key)}`)
            }
          })

          console.log()
        })
      }
    } catch (error) {
      console.log(error)
    }
  })

  return command
}

module.exports = duplicatesCommand
