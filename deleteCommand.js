/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const {
  withJson,
  printJson,
  fail,
} = require('@monorepool/agentfirst/output.js')
const deletePhrasesModule = require('@multilocale/client/deletePhrases.js')

const deletePhrases = deletePhrasesModule.default || deletePhrasesModule
const ensureAuth = require('./ensureAuth.js')
const getProject = require('./getProject.js')

function deleteCommand() {
  const command = new commander.Command('delete')
  command.description(
    'delete all translations of a phrase key from the current project',
  )
  command.argument('<key>', 'key of the phrase to delete')
  command.option('--project [project]', 'project id or name')
  withJson(command)
  command.action(async (key, options) => {
    try {
      await ensureAuth()

      const project = await getProject(options)

      const deleted = await deletePhrases({ key, projectName: project.name })

      if (options.json) {
        printJson({
          ok: true,
          key,
          project: project.name,
          deleted: deleted?.length ?? 0,
        })

        return
      }

      console.log(
        `Deleted phrases for key "${key}" from project "${project.name}" (${deleted?.length ?? 0} entries)`,
      )
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

module.exports = deleteCommand
