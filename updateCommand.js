/* Copyright 2013 - 2024 Waiterio LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import getPhrasesModule from '@multilocale/client/getPhrases.js'
import updatePhraseModule from '@multilocale/client/updatePhrase.js'
import commander from 'commander'

import ensureAuth from './ensureAuth.js'
import getProject from './getProject.js'

const getPhrases = getPhrasesModule.default || getPhrasesModule
const updatePhrase = updatePhraseModule.default || updatePhraseModule

function updateCommand() {
  const command = new commander.Command('update')
  command.description(
    'update an existing phrase value for a given language. Warning: phrases are shared across projects, so updating affects every project that shares the key.',
  )
  command.argument('<key>', 'key of the phrase')
  command.argument('<value>', 'new value for the phrase')
  command.option(
    '-l, --language <language>',
    'language code of the translation to update',
  )
  command.option('--project [project]', 'project id or name')
  withJson(command)
  command.action(async (key, value, options) => {
    try {
      await ensureAuth()

      const project = await getProject(options)
      const language = options.language || project.defaultLocale || 'en'

      const phrases = await getPhrases({
        key,
        language,
        project: project.name,
      })

      if (!phrases || phrases.length === 0) {
        throw new Error(
          `no phrase found with key "${key}" and language "${language}" in project "${project.name}"`,
        )
      }

      if (phrases.length > 1) {
        throw new Error(
          `expected 1 phrase but found ${phrases.length} for key "${key}" and language "${language}"`,
        )
      }

      const phrase = phrases[0]

      if (phrase.value === value) {
        if (options.json) {
          printJson({ ok: true, changed: false, key, language, value })
        } else {
          console.log(`No change: ${language} value is already "${value}"`)
        }

        return
      }

      if (phrase.projects && phrase.projects.length > 1 && !options.json) {
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

      if (options.json) {
        printJson({
          ok: true,
          changed: true,
          key,
          language,
          value,
          previousValue: phrase.value,
          projects: phrase.projects || [project.name],
        })

        return
      }

      console.log(`Updated ${language}: "${phrase.value}" → "${value}"`)
      console.log(`https://app.multilocale.com/projects/${project._id}`)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

export default updateCommand
