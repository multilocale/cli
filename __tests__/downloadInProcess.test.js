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
  execSync: vi.fn(),
  fail: vi.fn(),
  format: 'json',
  getAndroidResPath: vi.fn(),
  getPhrases: vi.fn(),
  getProject: vi.fn(),
  header: '',
  isAndroid: false,
  nested: false,
  paths: ['translations/%lang%.json'],
  postScript: '',
  printJson: vi.fn(),
}))

vi.mock('child_process', () => ({
  execSync: (...args) => mocks.execSync(...args),
}))
vi.mock('@monorepool/agentfirst/output.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    fail: (...args) => mocks.fail(...args),
    printJson: (...args) => mocks.printJson(...args),
  }
})
vi.mock('@multilocale/client/getPhrases.js', () => ({
  default: (...args) => mocks.getPhrases(...args),
}))
vi.mock('../ensureAuth.js', () => ({
  default: (...args) => mocks.ensureAuth(...args),
}))
vi.mock('../getAndroidResPath.js', () => ({
  default: (...args) => mocks.getAndroidResPath(...args),
}))
vi.mock('../getExtension.js', () => ({
  default: async () =>
    ({ cjs: 'js', esm: 'js', js: 'js', json: 'json', swift: 'strings' })[
      mocks.format
    ],
}))
vi.mock('../getFormat.js', () => ({ default: async () => mocks.format }))
vi.mock('../getHeader.js', () => ({ default: async () => mocks.header }))
vi.mock('../getNested.js', () => ({ default: async () => mocks.nested }))
vi.mock('../getPaths.js', () => ({ default: () => mocks.paths }))
vi.mock('../getPostScript.js', () => ({
  default: async () => mocks.postScript,
}))
vi.mock('../getProject.js', () => ({
  default: (...args) => mocks.getProject(...args),
}))
vi.mock('../isAndroid.js', () => ({ default: () => mocks.isAndroid }))

const downloadCommand = (await import('../downloadCommand.js')).default

const project = {
  _id: 'project-1',
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  name: 'website',
}

const invoke = async (argv = []) => {
  const command = downloadCommand()
  await command.parseAsync(argv, { from: 'user' })
}

const read = relativePath => fs.readFileSync(path.resolve(relativePath), 'utf8')

describe('download workflow in process', () => {
  const originalDirectory = process.cwd()
  let directory

  beforeAll(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'multilocale-download-unit-'),
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
    fs.rmSync(path.join(directory, 'ios'), { force: true, recursive: true })
    fs.rmSync(path.join(directory, 'android'), { force: true, recursive: true })
    mocks.ensureAuth.mockResolvedValue({ mode: 'key' })
    mocks.fail.mockImplementation(error => {
      throw error
    })
    mocks.format = 'json'
    mocks.getAndroidResPath.mockReturnValue(
      path.join(directory, 'android', 'res'),
    )
    mocks.getPhrases.mockResolvedValue([
      { key: 'checkout.failed', language: 'en', value: 'Payment failed' },
      { key: 'greeting', language: 'en', value: 'Hello' },
    ])
    mocks.getProject.mockResolvedValue(project)
    mocks.header = ''
    mocks.isAndroid = false
    mocks.nested = false
    mocks.paths = ['translations/%lang%.json']
    mocks.postScript = ''
  })

  it('writes sorted nested dictionaries and an empty configured locale', async () => {
    mocks.nested = true
    mocks.header = '/* generated */\n'

    await invoke(['--json'])

    expect(read('translations/en.json')).toBe(
      `/* generated */\n${JSON.stringify(
        {
          checkout: { failed: 'Payment failed' },
          greeting: 'Hello',
          locale: 'en',
        },
        null,
        2,
      )}\n`,
    )
    expect(read('translations/fr.json')).toBe('/* generated */\n{}\n')
    expect(mocks.printJson).toHaveBeenCalledWith({
      files: ['/translations/en.json', '/translations/fr.json'],
      format: 'json',
      nested: true,
      ok: true,
      project: 'website',
    })
  })

  it.each([
    ['esm', 'export default {'],
    ['js', 'module.exports = {'],
    ['cjs', 'module.exports = {'],
  ])('renders the %s module format', async (format, prefix) => {
    mocks.format = format
    mocks.paths = [`translations/%lang%.${format}.js`]

    await invoke()

    expect(read(`translations/en.${format}.js`)).toContain(prefix)
  })

  it('escapes Swift strings and ignores nesting for the flat format', async () => {
    mocks.format = 'swift'
    mocks.nested = true
    mocks.paths = ['ios/%lang%.lproj/Localizable.strings']
    mocks.getPhrases.mockResolvedValue([
      {
        key: 'quote"key',
        language: 'en',
        value: 'Line 1\n"quoted"\\tail',
      },
    ])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await invoke(['--json'])

    expect(read('ios/en.lproj/Localizable.strings')).toContain(
      '"quote\\"key" = "Line 1\\n\\"quoted\\"\\\\tail";',
    )
    expect(consoleError.mock.calls.flat().join('\n')).toContain(
      'Nested: ignored',
    )
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'swift', nested: false }),
    )
  })

  it('writes valid Android resource XML with platform escaping', async () => {
    mocks.isAndroid = true
    mocks.nested = true
    fs.mkdirSync(path.join(directory, 'android', 'res'), { recursive: true })
    mocks.getPhrases.mockResolvedValue([
      {
        key: 'tips',
        language: 'en',
        value: 'Today\'s "tips" & <tricks>',
      },
      { key: 'hello', language: 'es', value: 'Hola' },
    ])

    await invoke(['--json'])

    expect(read('android/res/values/strings.xml')).toContain(
      'Today\\\'s \\"tips\\" &amp; &lt;tricks&gt;',
    )
    expect(read('android/res/values-es/strings.xml')).toContain(
      '<string name="hello">Hola</string>',
    )
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'android', nested: false }),
    )
  })

  it('runs the configured post-script after writing and tolerates literal paths', async () => {
    mocks.paths = ['translations/catalogue.json']
    mocks.postScript = 'pnpm format-translations'
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke()

    expect(mocks.execSync).toHaveBeenCalledWith('pnpm format-translations', {
      stdio: 'inherit',
    })
    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      'does not include %lang%',
    )
  })

  it('turns remote failures into command failures', async () => {
    mocks.getPhrases.mockRejectedValue(new Error('translation service offline'))
    await expect(invoke()).rejects.toThrow('translation service offline')
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ json: undefined }),
    )
  })
})
