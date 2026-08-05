/* Copyright 2013 - 2024 Waiterio LLC */
const { inspect } = require('node:util')
const commander = require('commander')
const {
  withJson,
  printJson,
  fail,
} = require('@monorepool/agentfirst/output.js')
const ensureAuth = require('./ensureAuth.js')
const getProjects = require('@multilocale/client/getProjects.js').default
const getProject = require('@multilocale/client/getProject.js').default
const addProject = require('@multilocale/client/addProject.js').default
const updateProject = require('@multilocale/client/updateProject.js').default
const buildProjectUpdate = require('./buildProjectUpdate.js')

// One parser for every list-shaped option, so `--paths a,b`, `--paths a b` and
// `--paths a --paths b` all mean the same thing. Commander calls this once per
// value for a variadic option and once per occurrence otherwise, accumulating
// into `previous`.
function collectList(value, previous = []) {
  return previous.concat(
    String(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  )
}

function unique(values) {
  return [...new Set(values)]
}

function projectsCommand() {
  const command = new commander.Command('projects')
  command.description('manage projects')

  // multilocale projects list
  withJson(command.command('list').description('list projects')).action(
    async options => {
      try {
        await ensureAuth()

        const projects = await getProjects()

        if (options.json) {
          printJson(projects)

          return
        }

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
        fail(error, { json: options.json })
      }
    },
  )

  // multilocale projects get [projectIdOrName]
  withJson(
    command
      .command('get [projectIdOrName]')
      .description(
        'get projects (raw JSON), or a single project by id or name',
      ),
  ).action(async (projectIdOrName, options) => {
    try {
      await ensureAuth()

      if (projectIdOrName) {
        const project = await getProject(projectIdOrName)

        if (!project) {
          throw new Error('Project not found')
        }

        if (options.json) {
          printJson(project)
        } else {
          console.log(inspect(project, { colors: true, depth: null }))
        }
      } else {
        const projects = await getProjects()

        if (options.json) {
          printJson(projects)
        } else {
          console.log(inspect(projects, { colors: true, depth: null }))
        }
      }
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  // multilocale projects read <projectIdOrName>
  withJson(
    command
      .command('read <projectIdOrName>')
      .description('read a project formatted for the terminal'),
  ).action(async (projectIdOrName, options) => {
    try {
      await ensureAuth()

      const project = await getProject(projectIdOrName)

      if (!project) {
        throw new Error('Project not found')
      }

      if (options.json) {
        printJson(project)

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
      if (project.organizationId) {
        fields.push(`${cyan('organizationId')}  ${project.organizationId}`)
      }
      if (project.name) {
        fields.push(`${cyan('name')}  ${project.name}`)
      }
      if (project.creationTime) {
        fields.push(`${cyan('created')}  ${project.creationTime}`)
      }
      if (project.lastEditTime) {
        fields.push(`${cyan('edited')}   ${project.lastEditTime}`)
      }

      if (fields.length > 0) {
        fields.forEach(line => console.log(line))
      }

      console.log()
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  // multilocale projects create <name> [--locales en,es,fr] [--default-locale en] [--paths translations/%lang%.json]
  withJson(command.command('create <name>').description('create a new project'))
    .option(
      '--locales <locales>',
      'comma-separated list of locales (default: en)',
    )
    .option('--default-locale <locale>', 'default locale (default: en)')
    .option(
      '--paths <patterns...>',
      'where the translation files live, %lang% standing in for the locale ' +
        '(e.g. translations/%lang%.json). Comma-separated or repeatable. ' +
        '`import` and `unused` read this off the project, not off multilocale.json',
      collectList,
    )
    .action(async (name, options) => {
      try {
        await ensureAuth()

        const defaultLocale = options.defaultLocale || 'en'
        const locales = options.locales
          ? options.locales.split(',').map(l => l.trim())
          : [defaultLocale]

        if (!locales.includes(defaultLocale)) {
          locales.unshift(defaultLocale)
        }

        // Only sent when asked for. getPaths.js still falls back to a
        // format-appropriate default when a project carries none, and that
        // fallback is format-aware — stamping `translations/%lang%.json` onto
        // every project would override it and hand a Swift or Android project
        // a JavaScript layout it never asked for.
        const paths = options.paths?.length ? unique(options.paths) : undefined

        const project = await addProject({
          name,
          defaultLocale,
          locales,
          ...(paths ? { paths } : {}),
        })

        if (options.json) {
          printJson({
            ok: true,
            id: project._id,
            name: project.name,
            defaultLocale: project.defaultLocale,
            locales: project.locales,
            paths: project.paths,
          })

          return
        }

        console.log(`Created project: ${project.name} (${project._id})`)
        console.log(`Default locale: ${project.defaultLocale}`)
        console.log(
          `Locales (${project.locales.length}): ${project.locales.join(', ')}`,
        )

        if (project.paths?.length) {
          console.log(
            `Paths (${project.paths.length}): ${project.paths.join(', ')}`,
          )
        } else {
          console.log(
            'Paths: not set — `import` and `unused` fall back to translations/%lang%.json. Set them with `multilocale projects update <name> --paths …`',
          )
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    })

  // multilocale projects update <projectIdOrName> [--name …] [--paths …] …
  withJson(
    command
      .command('update <projectIdOrName>')
      .description(
        'update a project — the only way to set `paths`, which `import` and ' +
          '`unused` read off the project, and the way to repair the nameless ' +
          '"ghost" projects older signups created (give them a --name, ' +
          '--locales, --default-locale and --paths)',
      ),
  )
    .option('--name <name>', 'rename the project')
    .option(
      '--locales <locales>',
      'locales to add; locales already on the project are kept. ' +
        'Comma-separated or repeatable',
      collectList,
    )
    .option(
      '--remove-locales <locales>',
      'locales to remove (the default locale cannot be removed)',
      collectList,
    )
    .option(
      '--set-locales <locales>',
      'replace the locale list outright — destructive: every locale not ' +
        'listed is dropped from the project',
      collectList,
    )
    .option(
      '--default-locale <locale>',
      'default locale; it is always kept in the locale list',
    )
    .option(
      '--paths <patterns...>',
      'where the translation files live, %lang% standing in for the locale ' +
        '(e.g. translations/%lang%.json). Comma-separated or repeatable',
      collectList,
    )
    .option(
      '--context <context>',
      'project context handed to the machine translator',
    )
    .action(async (projectIdOrName, options) => {
      try {
        await ensureAuth()

        const existing = await getProject(projectIdOrName)

        if (!existing) {
          throw new Error(`Project ${projectIdOrName} not found`)
        }

        const changes = buildProjectUpdate({ existing, options })

        // Read-then-merge, not a bare patch. PUT /api/projects/:projectId
        // takes the whole document, and its logo bookkeeping compares the
        // body's `logo` with the stored one — a body without `logo` deletes
        // the stored logo image. Sending `existing` back underneath the
        // changes keeps every field the user did not name.
        const project = {
          ...existing,
          ...changes,
          _id: existing._id,
          lastEditTime: new Date().toISOString(),
        }

        const updated = (await updateProject(project)) || project

        if (options.json) {
          printJson({
            ok: true,
            id: updated._id,
            name: updated.name,
            defaultLocale: updated.defaultLocale,
            locales: updated.locales,
            paths: updated.paths,
            context: updated.context,
            changed: Object.keys(changes).sort(),
          })

          return
        }

        console.log(`Updated project: ${updated.name} (${updated._id})`)
        Object.keys(changes)
          .sort()
          .forEach(field => {
            const value = updated[field]
            console.log(
              `  ${field}: ${Array.isArray(value) ? value.join(', ') : value}`,
            )
          })
      } catch (error) {
        fail(error, { json: options.json })
      }
    })

  return command
}

module.exports = projectsCommand
