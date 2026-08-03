#!/usr/bin/env node
/* Copyright 2013 - 2024 Waiterio LLC */

// Set WAITERIO_ENV before any require() to ensure env/ENVIRONMENT.js
// evaluates with the correct value. Default to production.
const envIndex = process.argv.findIndex(arg => arg === '-e' || arg === '--env')
const envValue = envIndex !== -1 ? process.argv[envIndex + 1] : undefined
process.env.WAITERIO_ENV = envValue || 'production'

const program = require('commander')
const skillsCommand = require('@monorepool/agentfirst/skillsCommand.js')
const addCommand = require('./addCommand.js')
const deleteCommand = require('./deleteCommand.js')
const downloadCommand = require('./downloadCommand.js')
const duplicatesCommand = require('./duplicatesCommand.js')
const importCommand = require('./importCommand.js')
const localizeCommand = require('./localizeCommand.js')
const loginCommand = require('./loginCommand.js')
const logoutCommand = require('./logoutCommand.js')
const phrasesCommand = require('./phrasesCommand.js')
const projectsCommand = require('./projectsCommand.js')
const schemaCommand = require('./schemaCommand.js')
const shareCommand = require('./shareCommand.js')
const signupCommand = require('./signupCommand.js')
const unusedCommand = require('./unusedCommand.js')
const updateCommand = require('./updateCommand.js')
const packageJson = require('./package.json')

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
  .addCommand(skillsCommand({ baseDirectory: __dirname }))
  .addCommand(unusedCommand())
  .addCommand(updateCommand())
  .parse(process.argv)
