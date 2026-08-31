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
  addPhrases: vi.fn(),
  ensureAuth: vi.fn(),
  fail: vi.fn(),
  files: [],
  getProject: vi.fn(),
  isAndroid: false,
  isJavascript: true,
  paths: ['translations/%lang%.json'],
  printJson: vi.fn(),
  translateString: vi.fn(),
  uuid: vi.fn(),
}))

vi.mock('@monorepool/agentfirst/output.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    fail: (...args) => mocks.fail(...args),
    printJson: (...args) => mocks.printJson(...args),
  }
})
vi.mock('@multilocale/client/addPhrases.js', () => ({
  default: (...args) => mocks.addPhrases(...args),
}))
vi.mock('@multilocale/client/translateString.js', () => ({
  default: (...args) => mocks.translateString(...args),
}))
vi.mock('@multilocale/client/uuid.js', () => ({
  default: (...args) => mocks.uuid(...args),
}))
vi.mock('../ensureAuth.js', () => ({
  default: (...args) => mocks.ensureAuth(...args),
}))
vi.mock('../getFiles.js', () => ({ default: () => mocks.files }))
vi.mock('../getPaths.js', () => ({ default: () => mocks.paths }))
vi.mock('../getProject.js', () => ({
  default: (...args) => mocks.getProject(...args),
}))
vi.mock('../isAndroid.js', () => ({ default: () => mocks.isAndroid }))
vi.mock('../isJavascript.js', () => ({ default: () => mocks.isJavascript }))

const importCommand = (await import('../importCommand.js')).default

const project = {
  _id: 'project-1',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
  name: 'website',
  organizationId: 'organization-1',
}

const invoke = async (argv = []) => {
  const command = importCommand()
  await command.parseAsync(argv, { from: 'user' })
}

describe('import workflow in process', () => {
  const originalDirectory = process.cwd()
  let directory

  beforeAll(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'multilocale-import-unit-'),
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
    fs.rmSync(path.join(directory, 'app'), { force: true, recursive: true })
    mocks.addPhrases.mockResolvedValue(undefined)
    mocks.ensureAuth.mockResolvedValue({ mode: 'key' })
    mocks.fail.mockImplementation(error => {
      throw error
    })
    mocks.files = []
    mocks.getProject.mockResolvedValue(project)
    mocks.isAndroid = false
    mocks.isJavascript = true
    mocks.paths = ['translations/%lang%.json']
    mocks.translateString.mockImplementation(async ({ string, to }) => ({
      translation: `${string} (${to})`,
    }))
    let uuid = 0
    mocks.uuid.mockImplementation(() => {
      uuid += 1
      return `phrase-${uuid}`
    })
  })

  it('flattens nested dictionaries, skips invalid values, and fills missing locales', async () => {
    fs.mkdirSync(path.join(directory, 'translations'), { recursive: true })
    fs.writeFileSync(
      path.join(directory, 'translations', 'en.json'),
      JSON.stringify({
        checkout: { failed: 'Payment failed' },
        count: 4,
        empty: '',
        greeting: 'Hello',
        variants: ['formal', 'casual'],
      }),
    )
    fs.writeFileSync(
      path.join(directory, 'translations', 'es.json'),
      JSON.stringify({ greeting: 'Hola' }),
    )
    mocks.files = ['/translations/en.json', '/translations/es.json']
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await invoke(['--json'])

    const phrases = mocks.addPhrases.mock.calls[0][0]
    expect(phrases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'checkout.failed',
          language: 'en',
          value: 'Payment failed',
        }),
        expect.objectContaining({
          key: 'checkout.failed',
          language: 'fr',
          value: 'Payment failed (fr)',
        }),
        expect.objectContaining({
          key: 'empty',
          language: 'en',
          value: 'empty',
        }),
        expect.objectContaining({
          key: 'greeting',
          language: 'es',
          value: 'Hola',
        }),
      ]),
    )
    expect(phrases.every(phrase => typeof phrase.value === 'string')).toBe(true)
    expect(mocks.translateString).toHaveBeenCalledWith({
      from: 'en',
      string: 'Payment failed',
      to: 'es',
    })
    expect(consoleError.mock.calls.flat().join('\n')).toContain(
      'nested dictionary flattened into dot paths',
    )
    expect(consoleError.mock.calls.flat().join('\n')).toContain(
      'skipped key variants',
    )
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, phrases: phrases.length }),
    )
  })

  it('refuses nested input when flattening was explicitly disabled', async () => {
    fs.mkdirSync(path.join(directory, 'translations'), { recursive: true })
    fs.writeFileSync(
      path.join(directory, 'translations', 'en.json'),
      JSON.stringify({ checkout: { failed: 'Payment failed' } }),
    )
    mocks.files = ['/translations/en.json']

    await expect(invoke(['--no-flatten'])).rejects.toThrow(
      'is a nested dictionary and --no-flatten was passed',
    )
    expect(mocks.addPhrases).not.toHaveBeenCalled()
  })

  it('imports Android resources using the default and qualifier locales', async () => {
    const defaultPath = path.join(
      directory,
      'app',
      'src',
      'main',
      'res',
      'values',
      'strings.xml',
    )
    const spanishPath = path.join(
      directory,
      'app',
      'src',
      'main',
      'res',
      'values-es',
      'strings.xml',
    )
    fs.mkdirSync(path.dirname(defaultPath), { recursive: true })
    fs.mkdirSync(path.dirname(spanishPath), { recursive: true })
    fs.writeFileSync(
      defaultPath,
      '<resources><string name="greeting">Hello</string></resources>',
    )
    fs.writeFileSync(
      spanishPath,
      '<resources><string name="greeting">Hola</string></resources>',
    )
    mocks.files = [
      '/app/src/main/res/values/strings.xml',
      '/app/src/main/res/values-es/strings.xml',
    ]
    mocks.isAndroid = true

    await invoke(['--json'])

    expect(mocks.addPhrases).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'greeting',
        language: 'en',
        value: 'Hello',
      }),
      expect.objectContaining({
        key: 'greeting',
        language: 'es',
        value: 'Hola',
      }),
    ])
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ phrases: 2, project: 'website' }),
    )
  })

  it('reports a clean zero result when configured files are not present', async () => {
    await invoke(['--json'])
    expect(mocks.addPhrases).not.toHaveBeenCalled()
    expect(mocks.printJson).toHaveBeenCalledWith({
      ok: true,
      phrases: 0,
      project: 'website',
    })
  })

  it('explains unsupported files, project roots, and translation failures', async () => {
    fs.mkdirSync(path.join(directory, 'translations'), { recursive: true })
    fs.writeFileSync(
      path.join(directory, 'translations', 'en.yaml'),
      'hello: Hello',
    )
    mocks.files = ['/translations/en.yaml']
    mocks.paths = ['translations/%lang%.yaml']
    await expect(invoke()).rejects.toThrow('Unsupported file extension .yaml')

    mocks.files = []
    mocks.isJavascript = false
    await expect(invoke()).rejects.toThrow('Could not detect project type')

    mocks.isJavascript = true
    mocks.paths = ['translations/%lang%.json']
    fs.writeFileSync(
      path.join(directory, 'translations', 'en.json'),
      JSON.stringify({ greeting: 'Hello' }),
    )
    mocks.files = ['/translations/en.json']
    mocks.translateString.mockRejectedValue(new Error('translator unavailable'))
    await expect(invoke()).rejects.toThrow(
      "Could not translate 'Hello' from en to es",
    )
  })
})
