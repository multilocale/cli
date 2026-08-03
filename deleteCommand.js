/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const deletePhrasesModule = require('@multilocale/client/deletePhrases.js')

const deletePhrases = deletePhrasesModule.default || deletePhrasesModule
const rehydrateSession = require('./session/rehydrateSession.js')
const isLoggedInSession = require('./session/isLoggedInSession.js')
const getProject = require('./getProject.js')
const login = require('./login.js')

function deleteCommand() {
  const command = new commander.Command('delete')
  command.description(
    'delete all translations of a phrase key from the current project',
  )
  command.argument('<key>', 'key of the phrase to delete')
  command.option('--project [project]', 'project id or name')
  command.action(async (key, options) => {
    rehydrateSession()

    if (!isLoggedInSession()) {
      await login()
    }

    const project = await getProject(options)

    const deleted = await deletePhrases({ key, projectName: project.name })

    console.log(
      `Deleted phrases for key "${key}" from project "${project.name}" (${deleted?.length ?? 0} entries)`,
    )
  })

  return command
}

module.exports = deleteCommand
