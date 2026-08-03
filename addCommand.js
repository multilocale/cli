/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const {
  withJson,
  printJson,
  fail,
} = require('@monorepool/agentfirst/output.js')
const addPhrasesModule = require('@multilocale/client/addPhrases.js')
const getPhrasesModule = require('@multilocale/client/getPhrases.js')
const translateToAllLanguagesModule = require('@multilocale/client/translateToAllLanguages.js')
const uuidModule = require('@multilocale/client/uuid.js')

const addPhrases = addPhrasesModule.default || addPhrasesModule
const getPhrases = getPhrasesModule.default || getPhrasesModule
const translateToAllLanguages =
  translateToAllLanguagesModule.default || translateToAllLanguagesModule
const uuid = uuidModule.default || uuidModule
const ensureAuth = require('./ensureAuth.js')
const getProject = require('./getProject.js')

function addCommand() {
  const command = new commander.Command('add')
  command.description(
    'add a new phrase and auto-translate it to all project locales. The phrase is always created fresh for the target project — to attach an existing phrase from another project, use `multilocale share` instead.',
  )
  command.argument('<key>', 'key of string')
  command.argument(
    '[value]',
    'value of string. If not provided, will be equal to key.',
  )
  command.option('--project [project]', 'project id or name')
  command.option(
    '-m, --model <model>',
    'translation model: "gpt-5-nano" (default), "gpt-5-mini", "gemini-3.5-flash", or "claude-haiku-4-5"',
    'gpt-5-nano',
  )
  command.option(
    '-c, --context <context>',
    'context hint passed to the translation model to disambiguate meaning',
  )
  withJson(command)
  command.action(async (key, value, options) => {
    // Progress goes to stderr in json mode so stdout stays parseable.
    const print = options.json ? console.error : console.log

    try {
      print('add string')
      if (!value) {
        value = value || key
        print('value not provided, using key as value')
      }

      const { model, context } = options

      await ensureAuth()

      const project = await getProject(options)
      const language = project.defaultLocale || 'en'

      const existingPhrases = await getPhrases({
        key,
        language,
        project: project.name,
      })

      if (existingPhrases?.length > 0) {
        throw new Error(
          `a phrase with key "${key}" already exists in project "${project.name}"`,
        )
      }

      const phrases = []

      const phraseOriginal = {
        _id: uuid(),
        key,
        value,
        language,
        creationTime: new Date().toISOString(),
        lastEditTime: new Date().toISOString(),
        googleTranslate: false,
        machineTranslated: false,
        model: null,
        context: context || null,
        organizationId: project.organizationId,
        projects: [project.name],
        projectsIds: [project._id],
      }

      phrases.push(phraseOriginal)
      print(`${language}: ${value}`)

      const targetLocales = project.locales.filter(l => l !== language)

      if (targetLocales.length > 0) {
        const language2value = await translateToAllLanguages({
          value: phraseOriginal.value,
          languages: targetLocales,
          from: language,
          model,
          context,
          projectId: project._id,
        })

        targetLocales.forEach(locale => {
          const translation = language2value[locale]
          const phrase = {
            ...phraseOriginal,
            _id: uuid(),
            language: locale,
            googleTranslate: true,
            machineTranslated: true,
            model,
            context: null,
            value: translation,
          }

          phrases.push(phrase)
          print(`${locale}: ${translation}`)
        })
      }

      await addPhrases(phrases)

      if (options.json) {
        printJson({
          ok: true,
          key,
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
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

module.exports = addCommand
