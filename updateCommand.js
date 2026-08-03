/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const getPhrasesModule = require('@multilocale/client/getPhrases.js')
const updatePhraseModule = require('@multilocale/client/updatePhrase.js')

const getPhrases = getPhrasesModule.default || getPhrasesModule
const updatePhrase = updatePhraseModule.default || updatePhraseModule
const rehydrateSession = require('./session/rehydrateSession.js')
const isLoggedInSession = require('./session/isLoggedInSession.js')
const getProject = require('./getProject.js')
const login = require('./login.js')

function updateCommand() {
  const command = new commander.Command('update')
  command.description(
    'update an existing phrase value for a given language. Warning: phrases are shared across projects, so updating affects every project that shares the key.',
  )
  command.argument('<key>', 'key of the phrase')
  command.argument('<value>', 'new value for the phrase')
  command.option('-l, --language <language>', 'language code of the translation to update')
  command.option('--project [project]', 'project id or name')
  command.action(async (key, value, options) => {
    rehydrateSession()

    if (!isLoggedInSession()) {
      await login()
    }

    const project = await getProject(options)
    const language = options.language || project.defaultLocale || 'en'

    const phrases = await getPhrases({
      key,
      language,
      project: project.name,
    })

    if (!phrases || phrases.length === 0) {
      console.error(
        `Error: no phrase found with key "${key}" and language "${language}" in project "${project.name}"`,
      )
      process.exit(1)
    }

    if (phrases.length > 1) {
      console.error(
        `Error: expected 1 phrase but found ${phrases.length} for key "${key}" and language "${language}"`,
      )
      process.exit(1)
    }

    const phrase = phrases[0]

    if (phrase.value === value) {
      console.log(`No change: ${language} value is already "${value}"`)

      return
    }

    if (phrase.projects && phrase.projects.length > 1) {
      console.log(
        `Warning: this phrase is shared across ${phrase.projects.length} projects: ${phrase.projects.join(', ')}`,
      )
      console.log('Updating will change the value for all of them.')
    }

    const updated = {
      ...phrase,
      value,
      googleTranslate: false,
      machineTranslated: false,
      model: undefined,
      lastEditTime: new Date().toISOString(),
    }

    await updatePhrase(updated)

    console.log(`Updated ${language}: "${phrase.value}" → "${value}"`)
    console.log(`https://app.multilocale.com/projects/${project._id}`)
  })

  return command
}

module.exports = updateCommand
