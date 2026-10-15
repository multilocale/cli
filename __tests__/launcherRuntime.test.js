/* Copyright 2013 - 2026 Waiterio LLC */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest' // eslint-disable-line import-js/no-extraneous-dependencies

const imports = vi.hoisted(() => ({ source: vi.fn() }))

vi.mock('../index.js', () => {
  imports.source()
  return {}
})

const launcherPath = fileURLToPath(
  new URL('../bin/multilocale.js', import.meta.url),
)
const sourcePath = fileURLToPath(new URL('../index.js', import.meta.url))
const bundlePath = fileURLToPath(new URL('../dist/index.js', import.meta.url))
const bundleDirectory = path.dirname(bundlePath)
const backupPath = `${bundlePath}.${process.pid}.launcher-test-backup`
const originalArgv = process.argv
let removeBundleDirectory = false
let restoreBundle = false

beforeAll(() => {
  removeBundleDirectory = !fs.existsSync(bundleDirectory)

  if (fs.existsSync(bundlePath)) {
    fs.renameSync(bundlePath, backupPath)
    restoreBundle = true
  }
})

// The bundle test writes dist/index.js; every test starts from a checkout
// without one instead of from the bundle an earlier test left behind.
beforeEach(() => {
  fs.rmSync(bundlePath, { force: true })
  delete globalThis.__multilocaleBundleImports
})

afterAll(() => {
  process.argv = originalArgv
  fs.rmSync(bundlePath, { force: true })

  if (restoreBundle) {
    fs.renameSync(backupPath, bundlePath)
  } else if (removeBundleDirectory) {
    fs.rmdirSync(bundleDirectory)
  }

  delete globalThis.__multilocaleBundleImports
})

it('launches the source entrypoint from a clean monorepo checkout', async () => {
  process.argv = ['node', launcherPath, '--version']

  await import('../bin/multilocale.js?launcher=source')

  expect(process.argv[1]).toBe(sourcePath)
  expect(imports.source).toHaveBeenCalledOnce()
})

it('prefers the published bundle when the package contains one', async () => {
  fs.mkdirSync(bundleDirectory, { recursive: true })
  fs.writeFileSync(
    bundlePath,
    'globalThis.__multilocaleBundleImports = (globalThis.__multilocaleBundleImports || 0) + 1\n',
  )
  process.argv = ['node', launcherPath, '--version']

  await import('../bin/multilocale.js?launcher=bundle')

  expect(process.argv[1]).toBe(bundlePath)
  expect(globalThis.__multilocaleBundleImports).toBe(1)
})
