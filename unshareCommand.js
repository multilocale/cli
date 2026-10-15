/* Copyright 2013 - 2026 Waiterio LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import getPhrasesModule from '@multilocale/client/getPhrases.js'
import updatePhraseModule from '@multilocale/client/updatePhrase.js'
import commander from 'commander'

import ensureAuth from './ensureAuth.js'
import getProject from './getProject.js'

const getPhrases = getPhrasesModule.default || getPhrasesModule
const updatePhrase = updatePhraseModule.default || updatePhraseModule

// The inverse of `share`: detach one project from a phrase that other projects
// still use. `delete` cannot do this — it removes every document that lists the
// project, including the ones shared with other products.
function unshareCommand() {
  const command = new commander.Command('unshare')
  command.description(
    'detach the current project from a shared phrase (across all its locales) without deleting the phrase for the other projects that use it.',
  )
  command.argument('<key>', 'key of the phrase to detach from')
  command.option(
    '--project [project]',
    'project id or name to detach. Defaults to the project found in the local multilocale.json.',
  )
  withJson(command)
  command.action(async (key, options) => {
    const print = options.json ? console.error : console.log

    try {
      await ensureAuth()

      const project = await getProject(options)
      const phrases = await getPhrases({ key, project: project.name })

      if (!phrases || phrases.length === 0) {
        throw new Error(
          `no phrase found with key "${key}" in project "${project.name}"`,
        )
      }

      // A phrase only this project uses has nobody to be left with: detaching
      // would orphan the document, so that case stays `delete`'s.
      const exclusive = phrases.filter(
        phrase =>
          !(phrase.projectsIds || []).some(id => id !== project._id) &&
          !(phrase.projects || []).some(name => name !== project.name),
      )
      if (exclusive.length > 0) {
        throw new Error(
          `"${key}" is not shared: ${exclusive.length} of its ${phrases.length} phrase(s) belong only to "${project.name}". Use \`multilocale delete\` to remove it.`,
        )
      }

      print(`Detaching "${project.name}" from ${phrases.length} phrase(s)`)

      const BATCH_SIZE = 10
      for (let i = 0; i < phrases.length; i += BATCH_SIZE) {
        const batch = phrases.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(async phrase => {
            await updatePhrase({
              ...phrase,
              projects: (phrase.projects || []).filter(
                name => name !== project.name,
              ),
              projectsIds: (phrase.projectsIds || []).filter(
                id => id !== project._id,
              ),
              lastEditTime: new Date().toISOString(),
            })
            print(`  Detached ${phrase.language}: ${phrase.value}`)
          }),
        )
      }

      if (options.json) {
        printJson({
          ok: true,
          key,
          project: project.name,
          updated: phrases.length,
        })
        return
      }

      console.log(
        `Updated ${phrases.length} phrase(s) — removed project "${project.name}"`,
      )
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

export default unshareCommand
