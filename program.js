/* Copyright 2013 - 2024 Waiterio LLC */

import { fileURLToPath } from 'node:url'

import skillsCommand from '@monorepool/agentfirst/skillsCommand.js'
import program from 'commander'

import addCommand from './addCommand.js'
import deleteCommand from './deleteCommand.js'
import downloadCommand from './downloadCommand.js'
import duplicatesCommand from './duplicatesCommand.js'
import importCommand from './importCommand.js'
import localizeCommand from './localizeCommand.js'
import loginCommand from './loginCommand.js'
import logoutCommand from './logoutCommand.js'
import packageJson from './package.json' with { type: 'json' }
import phrasesCommand from './phrasesCommand.js'
import projectsCommand from './projectsCommand.js'
import schemaCommand from './schemaCommand.js'
import shareCommand from './shareCommand.js'
import signupCommand from './signupCommand.js'
import unshareCommand from './unshareCommand.js'
import unusedCommand from './unusedCommand.js'
import updateCommand from './updateCommand.js'

program
  .name('multilocale')
  .description('manage phrases')
  .version(packageJson.version)
  .option('-e, --env <environment>', 'environment (default: production)')
  .addCommand(addCommand())
  .addCommand(deleteCommand())
  .addCommand(downloadCommand())
  .addCommand(duplicatesCommand())
  .addCommand(importCommand())
  .addCommand(localizeCommand())
  .addCommand(loginCommand())
  .addCommand(logoutCommand())
  .addCommand(phrasesCommand())
  .addCommand(projectsCommand())
  // `schema` receives the composed program so it describes the CLI exactly as
  // it runs; `skills` reads the guides copied next to the bundle by
  // scripts/build.js (baseDirectory anchors the lookup after esbuild inlines
  // the shared factory).
  .addCommand(schemaCommand(program))
  .addCommand(shareCommand())
  .addCommand(signupCommand())
  .addCommand(
    skillsCommand({
      baseDirectory: fileURLToPath(new URL('.', import.meta.url)),
    }),
  )
  .addCommand(unshareCommand())
  .addCommand(unusedCommand())
  .addCommand(updateCommand())

export default program
