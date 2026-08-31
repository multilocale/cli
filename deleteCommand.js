/* Copyright 2013 - 2024 Waiterio LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import deletePhrasesModule from '@multilocale/client/deletePhrases.js'
import commander from 'commander'

import ensureAuth from './ensureAuth.js'
import getProject from './getProject.js'

const deletePhrases = deletePhrasesModule.default || deletePhrasesModule

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

export default deleteCommand
