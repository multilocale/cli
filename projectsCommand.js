/* Copyright 2013 - 2024 Waiterio LLC */
const { inspect } = require('node:util')
const commander = require('commander')
const rehydrateSession = require('./session/rehydrateSession.js')
const isLoggedInSession = require('./session/isLoggedInSession.js')
const login = require('./login.js')
const getProjects = require('@multilocale/client/getProjects.js').default
const getProject = require('@multilocale/client/getProject.js').default
const addProject = require('@multilocale/client/addProject.js').default

async function ensureLoggedIn() {
  await rehydrateSession()

  if (!isLoggedInSession()) {
    console.log('Please login first')
    await login()
    await rehydrateSession()
  }
}

function projectsCommand() {
  const command = new commander.Command('projects')
  command.description('manage projects')

  // multilocale projects list
  command
    .command('list')
    .description('list projects')
    .action(async () => {
      try {
        await ensureLoggedIn()

        const projects = await getProjects()

        if (projects.length === 0) {
          console.log('No projects found')
        } else {
          console.log(`Found ${projects.length} project(s):`)
          projects.forEach((project, index) => {
            const name = project.name || project._id
            console.log(`${index + 1}. ${name} (${project._id})`)
          })
        }
      } catch (error) {
        console.log('error', error)
      }
    })

  // multilocale projects get [projectIdOrName]
  command
    .command('get [projectIdOrName]')
    .description('get projects (raw JSON), or a single project by id or name')
    .action(async projectIdOrName => {
      try {
        await ensureLoggedIn()

        if (projectIdOrName) {
          const project = await getProject(projectIdOrName)

          if (project) {
            console.log(inspect(project, { colors: true, depth: null }))
          } else {
            console.log('Project not found')
          }
        } else {
          const projects = await getProjects()
          console.log(inspect(projects, { colors: true, depth: null }))
        }
      } catch (error) {
        console.log('error', error)
      }
    })

  // multilocale projects read <projectIdOrName>
  command
    .command('read <projectIdOrName>')
    .description('read a project formatted for the terminal')
    .action(async projectIdOrName => {
      try {
        await ensureLoggedIn()

        const project = await getProject(projectIdOrName)

        if (!project) {
          console.log('Project not found')

          return
        }

        const dim = text => `\x1b[2m${text}\x1b[0m`
        const bold = text => `\x1b[1m${text}\x1b[0m`
        const cyan = text => `\x1b[36m${text}\x1b[0m`

        console.log()
        const name = project.name || project._id
        console.log(bold(name))
        console.log(dim(project._id))
        console.log()

        const fields = []
        if (project.organizationId) fields.push(`${cyan('organizationId')}  ${project.organizationId}`)
        if (project.name) fields.push(`${cyan('name')}  ${project.name}`)
        if (project.creationTime) fields.push(`${cyan('created')}  ${project.creationTime}`)
        if (project.lastEditTime) fields.push(`${cyan('edited')}   ${project.lastEditTime}`)

        if (fields.length > 0) {
          fields.forEach(line => console.log(line))
        }

        console.log()
      } catch (error) {
        console.log('error', error)
      }
    })

  // multilocale projects create <name> [--locales en,es,fr] [--default-locale en]
  command
    .command('create <name>')
    .description('create a new project')
    .option('--locales <locales>', 'comma-separated list of locales (default: en)')
    .option('--default-locale <locale>', 'default locale (default: en)')
    .action(async (name, options) => {
      try {
        await ensureLoggedIn()

        const defaultLocale = options.defaultLocale || 'en'
        const locales = options.locales
          ? options.locales.split(',').map(l => l.trim())
          : [defaultLocale]

        if (!locales.includes(defaultLocale)) {
          locales.unshift(defaultLocale)
        }

        const project = await addProject({
          name,
          defaultLocale,
          locales,
        })

        console.log(`Created project: ${project.name} (${project._id})`)
        console.log(`Default locale: ${project.defaultLocale}`)
        console.log(`Locales (${project.locales.length}): ${project.locales.join(', ')}`)
      } catch (error) {
        console.log('error', error)
      }
    })

  return command
}

module.exports = projectsCommand
