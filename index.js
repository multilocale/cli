#!/usr/bin/env node
/* Copyright 2013 - 2024 Waiterio LLC */

// Set WAITERIO_ENV before any require() to ensure env/ENVIRONMENT.js
// evaluates with the correct value. Default to production.
const envIndex = process.argv.findIndex(arg => arg === '-e' || arg === '--env')
const envValue = envIndex !== -1 ? process.argv[envIndex + 1] : undefined
process.env.WAITERIO_ENV = envValue || 'production'

const program = require('commander')
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
const shareCommand = require('./shareCommand.js')
const skillsCommand = require('./skillsCommand.js')
const unusedCommand = require('./unusedCommand.js')
const updateCommand = require('./updateCommand.js')
const packageJson = require('./package.json')

program
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
  .addCommand(shareCommand())
  .addCommand(skillsCommand())
  .addCommand(unusedCommand())
  .addCommand(updateCommand())
  .parse(process.argv)
