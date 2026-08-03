/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const {
  withJson,
  printJson,
  fail,
} = require('@monorepool/agentfirst/output.js')
const getPhrasesModule = require('@multilocale/client/getPhrases.js')
const getProjectModule = require('@multilocale/client/getProject.js')
const updatePhraseModule = require('@multilocale/client/updatePhrase.js')

const getPhrases = getPhrasesModule.default || getPhrasesModule
const getProjectByIdOrName = getProjectModule.default || getProjectModule
const updatePhrase = updatePhraseModule.default || updatePhraseModule
const ensureAuth = require('./ensureAuth.js')
const getProject = require('./getProject.js')

function shareCommand() {
  const command = new commander.Command('share')
  command.description(
    'share an existing phrase (across all its locales) with one or more additional projects, by attaching them to the existing phrase documents.',
  )
  command.argument('<key>', 'key of the phrase to share')
  command.argument(
    '<targets...>',
    'one or more target projects (id or name) to attach to the existing phrase',
  )
  command.option(
    '--project [project]',
    'source project id or name (the project whose phrase set will be shared). Defaults to the project found in the local multilocale.json.',
  )
  withJson(command)
  command.action(async (key, targets, options) => {
    // Progress goes to stderr in json mode so stdout stays parseable.
    const print = options.json ? console.error : console.log

    try {
      await ensureAuth()

      const sourceProject = await getProject(options)

      // Resolve each target project (id or name) → { _id, name }.
      const targetProjects = await Promise.all(
        targets.map(async target => {
          const project = await getProjectByIdOrName(target)
          if (!project) {
            throw new Error(`Target project "${target}" not found`)
          }
          return project
        }),
      )

      // Block self-sharing and already-attached targets — surface them
      // explicitly rather than silently no-op.
      const skipped = []
      const toAttach = []
      for (const project of targetProjects) {
        if (project._id === sourceProject._id) {
          skipped.push({ project, reason: 'same as source' })
        } else {
          toAttach.push(project)
        }
      }

      skipped.forEach(({ project, reason }) => {
        print(`Skipping ${project.name} (${reason})`)
      })

      if (toAttach.length === 0) {
        if (options.json) {
          printJson({
            ok: true,
            key,
            source: sourceProject.name,
            targets: [],
            updated: 0,
          })
        } else {
          console.log('No targets to attach')
        }
        return
      }

      // Load every phrase document for this key under the source project
      // (one per locale).
      const phrases = await getPhrases({
        key,
        project: sourceProject.name,
      })

      if (!phrases || phrases.length === 0) {
        throw new Error(
          `no phrase found with key "${key}" in source project "${sourceProject.name}"`,
        )
      }

      print(
        `Sharing ${phrases.length} phrase(s) from "${sourceProject.name}" with ${toAttach
          .map(p => p.name)
          .join(', ')}`,
      )

      const BATCH_SIZE = 10
      const results = []
      for (let i = 0; i < phrases.length; i += BATCH_SIZE) {
        const batch = phrases.slice(i, i + BATCH_SIZE)
        // eslint-disable-next-line no-await-in-loop
        const batchResults = await Promise.all(
          batch.map(async phrase => {
            const newProjectNames = toAttach
              .map(p => p.name)
              .filter(name => !phrase.projects?.includes(name))
            const newProjectIds = toAttach
              .map(p => p._id)
              .filter(id => !phrase.projectsIds?.includes(id))

            if (newProjectNames.length === 0 && newProjectIds.length === 0) {
              return false
            }

            await updatePhrase({
              ...phrase,
              projects: [
                ...new Set([...(phrase.projects || []), ...newProjectNames]),
              ],
              projectsIds: [
                ...new Set([...(phrase.projectsIds || []), ...newProjectIds]),
              ],
              lastEditTime: new Date().toISOString(),
            })

            print(`  Shared ${phrase.language}: ${phrase.value}`)
            return true
          }),
        )
        results.push(...batchResults)
      }

      const updatedCount = results.filter(Boolean).length

      if (options.json) {
        printJson({
          ok: true,
          key,
          source: sourceProject.name,
          targets: toAttach.map(p => p.name),
          updated: updatedCount,
          total: phrases.length,
        })

        return
      }

      console.log(
        `Updated ${updatedCount}/${phrases.length} phrase(s) — added ${toAttach.length} project(s)`,
      )
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

module.exports = shareCommand
