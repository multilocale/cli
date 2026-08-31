/* Copyright 2013 - 2024 Waiterio LLC */

import isInteractive from '@monorepool/agentfirst/isInteractive.js'
import getProjectModule from '@multilocale/client/getProject.js'
import getProjectsModule from '@multilocale/client/getProjects.js'
import inquirer from 'inquirer'

import getConfig from './getConfig.js'
import setConfig from './setConfig.js'

const getProjectHttp = getProjectModule.default || getProjectModule
const getProjects = getProjectsModule.default || getProjectsModule

export default async function getProject(options) {
  let projectIdOrName = options?.project
  let project

  const config = getConfig()

  if (!projectIdOrName) {
    projectIdOrName = config?.projectId
  }

  if (!projectIdOrName) {
    const projects = await getProjects()

    if (projects.length === 0) {
      throw new Error(
        'There are no projects. Create one first at https://app.multilocale.com/projects/new',
      )
    } else if (projects.length === 1) {
      projectIdOrName = projects[0]._id
      project = projects[0] // eslint-disable-line prefer-destructuring
    } else {
      const choices = projects
        .map(project => ({
          name: project.name,
          value: project._id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      // Without a TTY nobody will ever answer this, and inquirer waits
      // forever — the command looks hung rather than failed, which is the
      // worst outcome for CI and for an agent. Two projects is the normal
      // state right after `signup` + `projects create`, so this was easy to
      // hit on a brand-new account.
      if (!isInteractive()) {
        // Only a sample of the names: this account can hold hundreds, and a
        // wall of them buries the one line that says what to do.
        const names = choices.map(choice => choice.name || choice.value)
        const sample = names.slice(0, 10).join(', ')
        const rest = names.length > 10 ? `, … (${names.length - 10} more)` : ''

        throw new Error(
          `This account has ${projects.length} projects and none was selected. ` +
            'Pass --project <idOrName>, or add a multilocale.json with a ' +
            '"projectId". Run `multilocale projects list` for the full list.\n' +
            `Projects: ${sample}${rest}`,
        )
      }

      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'projectId',
          message: 'Which project?',
          choices,
        },
      ])

      projectIdOrName = answers.projectId
      project = projects.find(project => project._id === projectIdOrName)
    }

    if (project && !config) {
      setConfig({
        organizationId: project.organizationId,
        projectId: project._id,
      })
      console.log('created multilocale.json with default projectId')
    }
  }

  if (!project && projectIdOrName) {
    project = await getProjectHttp(projectIdOrName)
  }

  return project
}
