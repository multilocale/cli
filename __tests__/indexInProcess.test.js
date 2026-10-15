/* Copyright 2013 - 2026 Waiterio LLC */

import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, expect, it, vi } from 'vitest' // eslint-disable-line import-js/no-extraneous-dependencies

const mocks = vi.hoisted(() => ({ parse: vi.fn() }))

vi.mock('../program.js', () => ({
  default: { parse: (...args) => mocks.parse(...args) },
}))

const entryPath = fileURLToPath(new URL('../index.js', import.meta.url))
const otherPath = fileURLToPath(new URL('../program.js', import.meta.url))
const originalArgv = process.argv
const originalEnvironment = process.env.WAITERIO_ENV

async function loadEntry() {
  vi.resetModules()
  await import('../index.js')
}

beforeEach(() => {
  mocks.parse.mockClear()
  delete process.env.WAITERIO_ENV
})

afterEach(() => {
  process.argv = originalArgv
  if (originalEnvironment === undefined) {
    delete process.env.WAITERIO_ENV
  } else {
    process.env.WAITERIO_ENV = originalEnvironment
  }
})

it('defaults direct CLI execution to production before parsing commands', async () => {
  process.argv = ['node', entryPath, '--version']

  await loadEntry()

  expect(process.env.WAITERIO_ENV).toBe('production')
  expect(mocks.parse).toHaveBeenCalledWith(process.argv)
})

it('honors both supported environment flag spellings before parsing', async () => {
  process.argv = ['node', entryPath, '-e', 'staging', '--version']
  await loadEntry()
  expect(process.env.WAITERIO_ENV).toBe('staging')

  mocks.parse.mockClear()
  process.argv = ['node', entryPath, '--env', 'development', '--version']
  await loadEntry()
  expect(process.env.WAITERIO_ENV).toBe('development')
  expect(mocks.parse).toHaveBeenCalledWith(process.argv)
})

it('does not parse when imported, pointed at another file, or given a missing entry', async () => {
  process.argv = ['node']
  await loadEntry()

  process.argv = ['node', '/path/that/does/not/exist']
  await loadEntry()

  process.argv = ['node', otherPath]
  await loadEntry()

  expect(mocks.parse).not.toHaveBeenCalled()
  expect(process.env.WAITERIO_ENV).toBeUndefined()
})
