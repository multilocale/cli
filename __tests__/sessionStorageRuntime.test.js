/* Copyright 2013 - 2026 Waiterio LLC */

import path from 'node:path'

import { expect, it, vi } from 'vitest' // eslint-disable-line import-js/no-extraneous-dependencies

const runtime = vi.hoisted(() => ({
  homeDirectory: '/people/maria',
  storage: { getItem: vi.fn(), setItem: vi.fn() },
  storageConstructor: vi.fn(),
}))

vi.mock('node:os', () => ({
  default: { homedir: () => runtime.homeDirectory },
}))

vi.mock('node-localstorage', () => ({
  default: {
    LocalStorage: function LocalStorage(...args) {
      runtime.storageConstructor(...args)
      return runtime.storage
    },
  },
}))

it('stores CLI credentials under the current user home directory', async () => {
  const { default: localStorage } = await import('../session/localStorage.js')

  expect(localStorage).toBe(runtime.storage)
  expect(runtime.storageConstructor).toHaveBeenCalledWith(
    path.join(runtime.homeDirectory, '.multilocale'),
  )
})
