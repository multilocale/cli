/* Copyright 2013 - 2026 Waiterio LLC */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expectConsoleError } from '@monorepool/root/vitest.strict.js'
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
  getPhrases: vi.fn(),
  getProject: vi.fn(),
  isAndroid: false,
  isJavascript: true,
  printJson: vi.fn(),
  translateToAllLanguages: vi.fn(),
  translateToAllLanguagesLocal: vi.fn(),
  updateProject: vi.fn(),
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
vi.mock('@monorepool/shared/languages.js', () => ({
  default: { en: 'English', es: 'Spanish', fr: 'French' },
}))
vi.mock('@multilocale/client/addPhrases.js', () => ({
  default: (...args) => mocks.addPhrases(...args),
}))
vi.mock('@multilocale/client/getPhrases.js', () => ({
  default: (...args) => mocks.getPhrases(...args),
}))
vi.mock('@multilocale/client/translateToAllLanguages.js', () => ({
  default: (...args) => mocks.translateToAllLanguages(...args),
}))
vi.mock('@multilocale/client/translateToAllLanguagesLocal.js', () => ({
  default: (...args) => mocks.translateToAllLanguagesLocal(...args),
}))
vi.mock('@multilocale/client/updateProject.js', () => ({
  default: (...args) => mocks.updateProject(...args),
}))
vi.mock('@multilocale/client/uuid.js', () => ({
  default: (...args) => mocks.uuid(...args),
}))
vi.mock('../ensureAuth.js', () => ({
  default: (...args) => mocks.ensureAuth(...args),
}))
vi.mock('../getFiles.js', () => ({ default: () => mocks.files }))
vi.mock('../getProject.js', () => ({
  default: (...args) => mocks.getProject(...args),
}))
vi.mock('../isAndroid.js', () => ({ default: () => mocks.isAndroid }))
vi.mock('../isJavascript.js', () => ({ default: () => mocks.isJavascript }))

const localizeCommand = (await import('../localizeCommand.js')).default

const localTranslationError = new Error('local translation disabled in tests')

const baseProject = {
  _id: 'project-1',
  defaultLocale: 'en',
  locales: ['en'],
  name: 'website',
  organizationId: 'organization-1',
  paths: [],
}

const invoke = async (argv = []) => {
  const command = localizeCommand()
  await command.parseAsync(argv, { from: 'user' })
}

describe('localize workflow in process', () => {
  const originalDirectory = process.cwd()
  let directory

  beforeAll(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'multilocale-localize-unit-'),
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
    mocks.addPhrases.mockResolvedValue(undefined)
    mocks.ensureAuth.mockResolvedValue({ mode: 'key' })
    mocks.fail.mockImplementation(error => {
      throw error
    })
    mocks.files = []
    mocks.getPhrases.mockResolvedValue([])
    mocks.getProject.mockResolvedValue({ ...baseProject })
    mocks.isAndroid = false
    mocks.isJavascript = true
    mocks.translateToAllLanguages.mockImplementation(
      async ({ languages, value }) =>
        Object.fromEntries(
          languages.map(locale => [locale, `${value} (${locale})`]),
        ),
    )
    mocks.translateToAllLanguagesLocal.mockRejectedValue(localTranslationError)
    mocks.updateProject.mockImplementation(async value => value)
    let uuid = 0
    mocks.uuid.mockImplementation(() => {
      uuid += 1
      return `phrase-${uuid}`
    })
    process.exitCode = undefined
  })

  it('widens a server-backed project and translates only missing locale rows', async () => {
    mocks.getPhrases.mockImplementation(async ({ language }) => {
      if (language === 'en') {
        return [
          {
            _id: 'greeting-en',
            key: 'greeting',
            language: 'en',
            organizationId: 'organization-source',
            projects: ['website', 'shared-library'],
            projectsIds: ['project-1', 'shared-project'],
            value: 'Hello',
          },
          {
            _id: 'technical-en',
            key: 'technical',
            language: 'en',
            value: 'PC123 - HIRAGANA',
          },
        ]
      }
      if (language === 'es') {
        return [
          {
            _id: 'greeting-es',
            key: 'greeting',
            language: 'es',
            value: 'Hola',
          },
        ]
      }
      return []
    })
    expectConsoleError('localize')
    expectConsoleError('Locales to add: es, fr')
    expectConsoleError('Javascript project detected')
    expectConsoleError('Project website now lists 3 locales (2 added)')
    expectConsoleError(
      'No local translation files matched — reading existing phrases from multilocale.com',
    )
    expectConsoleError('Read 3/3 locales')
    expectConsoleError('Found 3 phrase rows across 2 keys')
    expectConsoleError('Translating key "greeting" to 1 locales...')
    expectConsoleError(
      '  local translation unavailable: local translation disabled in tests',
    )
    expectConsoleError('  falling back to multilocale API...')
    expectConsoleError('fr: translated key greeting to Hello (fr)')
    expectConsoleError('Translating key "technical" to 2 locales...')
    expectConsoleError(
      'Keeping technical label "PC123 - HIRAGANA" unchanged in every locale',
    )
    expectConsoleError('es: translated key technical to PC123 - HIRAGANA')
    expectConsoleError('fr: translated key technical to PC123 - HIRAGANA')

    await invoke(['es, fr', '--model', 'gpt-5-mini', '--json'])

    expect(mocks.updateProject).toHaveBeenCalledWith(
      expect.objectContaining({ locales: ['en', 'es', 'fr'] }),
    )
    expect(mocks.getPhrases).toHaveBeenCalledTimes(3)
    expect(mocks.translateToAllLanguages).toHaveBeenCalledWith({
      from: 'en',
      languages: ['fr'],
      model: 'gpt-5-mini',
      projectId: 'project-1',
      value: 'Hello',
    })
    const saved = mocks.addPhrases.mock.calls[0][0]
    expect(saved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'greeting',
          language: 'fr',
          organizationId: 'organization-source',
          projects: ['website', 'shared-library'],
          projectsIds: ['project-1', 'shared-project'],
          value: 'Hello (fr)',
        }),
        expect.objectContaining({
          key: 'technical',
          language: 'es',
          value: 'PC123 - HIRAGANA',
        }),
        expect.objectContaining({
          key: 'technical',
          language: 'fr',
          value: 'PC123 - HIRAGANA',
        }),
      ]),
    )
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ added: 3, failedKeys: [], ok: true }),
    )
  })

  it('reconciles an already-listed locale without adding it again', async () => {
    const existing = { ...baseProject, locales: ['en', 'es'] }
    mocks.getProject.mockResolvedValue(existing)
    mocks.getPhrases.mockImplementation(async ({ language }) =>
      language === 'en'
        ? [{ key: 'greeting', language: 'en', value: 'Hello' }]
        : [],
    )
    expectConsoleError('localize')
    expectConsoleError(
      'Already on the project: 1 locales — will still reconcile their phrases',
    )
    expectConsoleError('Javascript project detected')
    expectConsoleError('Project website now lists 2 locales (0 added)')
    expectConsoleError(
      'No local translation files matched — reading existing phrases from multilocale.com',
    )
    expectConsoleError('Read 2/2 locales')
    expectConsoleError('Found 1 phrase rows across 1 keys')
    expectConsoleError('Translating key "greeting" to 1 locales...')
    expectConsoleError(
      '  local translation unavailable: local translation disabled in tests',
    )
    expectConsoleError('  falling back to multilocale API...')
    expectConsoleError('es: translated key greeting to Hello (es)')

    await invoke(['es', '--json'])

    expect(mocks.updateProject).toHaveBeenCalledWith(existing)
    expect(mocks.addPhrases).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'greeting', language: 'es' }),
    ])
  })

  it('uses local translation files when project paths match', async () => {
    const project = {
      ...baseProject,
      paths: ['translations/%lang%.json'],
    }
    mocks.getProject.mockResolvedValue(project)
    fs.mkdirSync(path.join(directory, 'translations'), { recursive: true })
    fs.writeFileSync(
      path.join(directory, 'translations', 'en.json'),
      JSON.stringify({ empty: '', greeting: 'Hello' }),
    )
    mocks.files = ['/translations/en.json']
    expectConsoleError('localize')
    expectConsoleError('Locales to add: es')
    expectConsoleError('Javascript project detected')
    expectConsoleError('Project website now lists 2 locales (1 added)')
    expectConsoleError(
      'No matching files for path translations/%lang%.json and locale es',
    )
    expectConsoleError('Found 1 files in 1 locales:')
    expectConsoleError('  /translations/en.json')
    expectConsoleError('en: Found 2 phrases')
    expectConsoleError('Translating key "empty" to 1 locales...')
    expectConsoleError(
      '  local translation unavailable: local translation disabled in tests',
    )
    expectConsoleError('  falling back to multilocale API...')
    expectConsoleError('es: translated key empty to empty (es)')
    expectConsoleError('Translating key "greeting" to 1 locales...')
    expectConsoleError(
      '  local translation unavailable: local translation disabled in tests',
    )
    expectConsoleError('  falling back to multilocale API...')
    expectConsoleError('es: translated key greeting to Hello (es)')

    await invoke(['es', '--json'])

    expect(mocks.getPhrases).not.toHaveBeenCalled()
    expect(mocks.addPhrases).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'empty',
          language: 'es',
          value: 'empty (es)',
        }),
        expect.objectContaining({ key: 'greeting', language: 'es' }),
      ]),
    )
  })

  it('supports all known locales and rejects Android or unknown roots', async () => {
    expectConsoleError('localize')
    expectConsoleError(
      'Already on the project: 1 locales — will still reconcile their phrases',
    )
    expectConsoleError('Locales to add: es, fr')
    expectConsoleError('Javascript project detected')
    expectConsoleError('Project website now lists 3 locales (2 added)')
    expectConsoleError(
      'No local translation files matched — reading existing phrases from multilocale.com',
    )
    expectConsoleError('Read 3/3 locales')
    expectConsoleError('Found 0 phrase rows across 0 keys')
    await invoke(['all', '--json'])
    expect(mocks.updateProject).toHaveBeenCalledWith(
      expect.objectContaining({ locales: ['en', 'es', 'fr'] }),
    )

    mocks.isAndroid = true
    await expect(invoke(['es'])).rejects.toThrow('Not implemented yet')

    mocks.isAndroid = false
    mocks.isJavascript = false
    await expect(invoke(['es'])).rejects.toThrow(
      'Could not detect project type',
    )
  })

  it('retries transient translation failures and marks exhausted keys incomplete', async () => {
    vi.useFakeTimers()
    try {
      mocks.getPhrases.mockImplementation(async ({ language }) =>
        language === 'en'
          ? [{ key: 'greeting', language: 'en', value: 'Hello' }]
          : [],
      )
      mocks.translateToAllLanguages.mockRejectedValue(
        Object.assign(new Error('unavailable'), { status: 503 }),
      )
      expectConsoleError('localize')
      expectConsoleError('Locales to add: es')
      expectConsoleError('Javascript project detected')
      expectConsoleError('Project website now lists 2 locales (1 added)')
      expectConsoleError(
        'No local translation files matched — reading existing phrases from multilocale.com',
      )
      expectConsoleError('Read 2/2 locales')
      expectConsoleError('Found 1 phrase rows across 1 keys')
      expectConsoleError('Translating key "greeting" to 1 locales...')
      expectConsoleError(
        '  local translation unavailable: local translation disabled in tests',
      )
      expectConsoleError('  falling back to multilocale API...')
      expectConsoleError(
        '  translate failed for "greeting" (status 503), retry 1/5 in 5s',
      )
      expectConsoleError(
        '  translate failed for "greeting" (status 503), retry 2/5 in 10s',
      )
      expectConsoleError(
        '  translate failed for "greeting" (status 503), retry 3/5 in 15s',
      )
      expectConsoleError(
        '  translate failed for "greeting" (status 503), retry 4/5 in 20s',
      )
      expectConsoleError(
        '  translate failed for "greeting" (status 503), retry 5/5 in 25s',
      )
      expectConsoleError(
        'Giving up on key "greeting" after 6 attempts (last status 503) — skipping',
      )
      expectConsoleError(
        'INCOMPLETE: 1 key(s) could not be translated and were skipped: greeting',
      )
      const invocation = invoke(['es', '--json'])
      await vi.runAllTimersAsync()
      await invocation

      expect(mocks.translateToAllLanguages).toHaveBeenCalledTimes(6)
      expect(mocks.addPhrases).not.toHaveBeenCalled()
      expect(mocks.printJson).toHaveBeenCalledWith(
        expect.objectContaining({
          added: 0,
          failedKeys: ['greeting'],
          ok: false,
        }),
      )
      expect(process.exitCode).toBe(1)
    } finally {
      process.exitCode = undefined
      vi.useRealTimers()
    }
  })
})
