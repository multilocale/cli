/* Copyright 2013 - 2026 Waiterio LLC */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// eslint-disable-next-line import-js/no-extraneous-dependencies
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureAuth: vi.fn(),
  fail: vi.fn(),
  files: [],
  getProject: vi.fn(),
  isAndroid: false,
  isJavascript: true,
  paths: ['translations/%lang%.json'],
  printJson: vi.fn(),
}))

vi.mock('@monorepool/agentfirst/output.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    fail: (...args) => mocks.fail(...args),
    printJson: (...args) => mocks.printJson(...args),
  }
})
vi.mock('../ensureAuth.js', () => ({
  default: (...args) => mocks.ensureAuth(...args),
}))
vi.mock('../getFiles.js', () => ({ default: () => [...mocks.files] }))
vi.mock('../getPaths.js', () => ({ default: () => mocks.paths }))
vi.mock('../getProject.js', () => ({
  default: (...args) => mocks.getProject(...args),
}))
vi.mock('../isAndroid.js', () => ({ default: () => mocks.isAndroid }))
vi.mock('../isJavascript.js', () => ({ default: () => mocks.isJavascript }))

const unusedCommand = (await import('../unusedCommand.js')).default

const project = {
  _id: 'project-1',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  name: 'website',
}

const invoke = async (argv = []) => {
  const command = unusedCommand()
  await command.parseAsync(argv, { from: 'user' })
}

describe('unused-key scanning in process', () => {
  const originalDirectory = process.cwd()
  let directory

  beforeAll(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'multilocale-unused-unit-'),
    )
    process.chdir(directory)
  })

  afterAll(() => {
    process.chdir(originalDirectory)
    fs.rmSync(directory, { force: true, recursive: true })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    fs.rmSync(path.join(directory, 'translations'), {
      force: true,
      recursive: true,
    })
    fs.rmSync(path.join(directory, 'src'), { force: true, recursive: true })
    mocks.ensureAuth.mockResolvedValue({ mode: 'key' })
    mocks.fail.mockImplementation(error => {
      throw error
    })
    mocks.files = []
    mocks.getProject.mockResolvedValue(project)
    mocks.isAndroid = false
    mocks.isJavascript = true
    mocks.paths = ['translations/%lang%.json']
  })

  it('returns only keys absent from every source file', async () => {
    fs.mkdirSync(path.join(directory, 'translations'), { recursive: true })
    fs.mkdirSync(path.join(directory, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(directory, 'translations', 'en.json'),
      JSON.stringify({ checkout: 'Checkout', greeting: 'Hello' }),
    )
    fs.writeFileSync(
      path.join(directory, 'translations', 'es.json'),
      JSON.stringify({ checkout: 'Pagar', greeting: 'Hola' }),
    )
    fs.writeFileSync(
      path.join(directory, 'src', 'Home.jsx'),
      "export default () => t('greeting')",
    )
    mocks.files = [
      '/translations/en.json',
      '/translations/es.json',
      '/src/Home.jsx',
    ]

    await invoke(['--json'])

    expect(mocks.printJson).toHaveBeenCalledWith(['checkout'])
  })

  it('scans TypeScript and CommonJS source extensions too', async () => {
    fs.mkdirSync(path.join(directory, 'translations'), { recursive: true })
    fs.mkdirSync(path.join(directory, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(directory, 'translations', 'en.json'),
      JSON.stringify({ checkout: 'Checkout', greeting: 'Hello' }),
    )
    fs.writeFileSync(
      path.join(directory, 'src', 'checkout.ts'),
      "t('checkout')",
    )
    fs.writeFileSync(
      path.join(directory, 'src', 'greeting.cjs'),
      "t('greeting')",
    )
    mocks.files = [
      '/translations/en.json',
      '/src/checkout.ts',
      '/src/greeting.cjs',
    ]

    await invoke(['--json'])
    expect(mocks.printJson).toHaveBeenCalledWith([])
  })

  it('fails loudly when no catalogue matches or the project type is unknown', async () => {
    await expect(invoke()).rejects.toThrow(
      'Could not find any file matching paths in project',
    )

    mocks.isJavascript = false
    await expect(invoke()).rejects.toThrow('Could not detect project type')
  })

  it('reports Android as explicitly unsupported', async () => {
    mocks.isAndroid = true
    await expect(invoke()).rejects.toThrow('Not implemented yet')
  })

  it('rejects unsupported translation file formats instead of misreading them', async () => {
    fs.mkdirSync(path.join(directory, 'translations'), { recursive: true })
    fs.writeFileSync(
      path.join(directory, 'translations', 'en.yaml'),
      'greeting: Hello',
    )
    mocks.paths = ['translations/%lang%.yaml']
    mocks.files = ['/translations/en.yaml']

    await expect(invoke()).rejects.toThrow('Unsupported file extension .yaml')
  })
})
