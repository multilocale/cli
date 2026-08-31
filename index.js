#!/usr/bin/env node
/* Copyright 2013 - 2024 Waiterio LLC */
import { existsSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  // Set WAITERIO_ENV before importing the command tree so env/ENVIRONMENT.js
  // evaluates with the correct value. Default to production.
  const envIndex = process.argv.findIndex(
    arg => arg === '-e' || arg === '--env',
  )
  const envValue = envIndex !== -1 ? process.argv[envIndex + 1] : undefined
  process.env.WAITERIO_ENV = envValue || 'production'

  const { default: program } = await import('./program.js')

  program.parse(process.argv)
}
