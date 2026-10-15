/* Copyright 2013 - 2026 Waiterio LLC */

import { expectConsoleError } from '@monorepool/root/vitest.strict.js'
import { beforeEach, describe, expect, it, vi } from 'vitest' // eslint-disable-line import-js/no-extraneous-dependencies

const mocks = vi.hoisted(() => ({
  addPhrases: vi.fn(),
  deletePhrases: vi.fn(),
  ensureAuth: vi.fn(),
  fail: vi.fn(),
  getPhrases: vi.fn(),
  getProject: vi.fn(),
  getProjectByIdOrName: vi.fn(),
  printJson: vi.fn(),
  translateToAllLanguages: vi.fn(),
  translateToAllLanguagesLocal: vi.fn(),
  updatePhrase: vi.fn(),
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
vi.mock('@multilocale/client/deletePhrases.js', () => ({
  default: (...args) => mocks.deletePhrases(...args),
}))
vi.mock('@multilocale/client/getPhrases.js', () => ({
  default: (...args) => mocks.getPhrases(...args),
}))
vi.mock('@multilocale/client/getProject.js', () => ({
  default: (...args) => mocks.getProjectByIdOrName(...args),
}))
vi.mock('@multilocale/client/translateToAllLanguages.js', () => ({
  default: (...args) => mocks.translateToAllLanguages(...args),
}))
vi.mock('@multilocale/client/translateToAllLanguagesLocal.js', () => ({
  default: (...args) => mocks.translateToAllLanguagesLocal(...args),
}))
vi.mock('@multilocale/client/updatePhrase.js', () => ({
  default: (...args) => mocks.updatePhrase(...args),
}))
vi.mock('@multilocale/client/uuid.js', () => ({
  default: (...args) => mocks.uuid(...args),
}))
vi.mock('../ensureAuth.js', () => ({
  default: (...args) => mocks.ensureAuth(...args),
}))
vi.mock('../getProject.js', () => ({
  default: (...args) => mocks.getProject(...args),
}))

const addCommand = (await import('../addCommand.js')).default
const deleteCommand = (await import('../deleteCommand.js')).default
const duplicatesCommand = (await import('../duplicatesCommand.js')).default
const phrasesCommand = (await import('../phrasesCommand.js')).default
const shareCommand = (await import('../shareCommand.js')).default
const unshareCommand = (await import('../unshareCommand.js')).default
const updateCommand = (await import('../updateCommand.js')).default

const localTranslationError = new Error('local translation disabled in tests')

const project = {
  _id: 'project-1',
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
  name: 'website',
  organizationId: 'organization-1',
}

const invoke = async (factory, argv) => {
  const command = factory()
  await command.parseAsync(argv, { from: 'user' })
  return command
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.addPhrases.mockResolvedValue(undefined)
  mocks.deletePhrases.mockResolvedValue([])
  mocks.ensureAuth.mockResolvedValue({ mode: 'key' })
  mocks.fail.mockImplementation(error => {
    throw error
  })
  mocks.getPhrases.mockResolvedValue([])
  mocks.getProject.mockResolvedValue(project)
  mocks.getProjectByIdOrName.mockImplementation(async name => ({
    _id: `${name}-id`,
    name,
  }))
  mocks.translateToAllLanguages.mockResolvedValue({ es: 'Hola', fr: 'Bonjour' })
  mocks.translateToAllLanguagesLocal.mockRejectedValue(localTranslationError)
  mocks.updatePhrase.mockResolvedValue(undefined)
  let uuid = 0
  mocks.uuid.mockImplementation(() => {
    uuid += 1
    return `phrase-${uuid}`
  })
})

describe('adding and deleting phrase sets', () => {
  it('creates an original phrase and one machine translation per target locale', async () => {
    expectConsoleError('add string')
    expectConsoleError('en: Hello')
    expectConsoleError('attempting local LLM translation...')
    expectConsoleError(
      'local translation unavailable: local translation disabled in tests',
    )
    expectConsoleError('falling back to multilocale API...')
    expectConsoleError('es: Hola')
    expectConsoleError('fr: Bonjour')

    await invoke(addCommand, [
      'greeting',
      'Hello',
      '--context',
      'Home-page salutation',
      '--model',
      'gpt-5-mini',
      '--json',
    ])

    expect(mocks.getPhrases).toHaveBeenCalledWith({
      key: 'greeting',
      language: 'en',
      project: 'website',
    })
    expect(mocks.translateToAllLanguages).toHaveBeenCalledWith({
      context: 'Home-page salutation',
      from: 'en',
      languages: ['es', 'fr'],
      model: 'gpt-5-mini',
      projectId: 'project-1',
      value: 'Hello',
    })
    expect(mocks.addPhrases).toHaveBeenCalledWith([
      expect.objectContaining({
        context: 'Home-page salutation',
        googleTranslate: false,
        key: 'greeting',
        language: 'en',
        machineTranslated: false,
        projectsIds: ['project-1'],
        value: 'Hello',
      }),
      expect.objectContaining({
        context: null,
        googleTranslate: true,
        language: 'es',
        machineTranslated: true,
        model: 'gpt-5-mini',
        value: 'Hola',
      }),
      expect.objectContaining({ language: 'fr', value: 'Bonjour' }),
    ])
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'greeting', ok: true, phrases: 3 }),
    )
  })

  it('uses the key as the default value and refuses a duplicate', async () => {
    mocks.getPhrases.mockResolvedValueOnce([])
    expectConsoleError('add string')
    expectConsoleError('value not provided, using key as value')
    expectConsoleError('en: settings')
    expectConsoleError('attempting local LLM translation...')
    expectConsoleError(
      'local translation unavailable: local translation disabled in tests',
    )
    expectConsoleError('falling back to multilocale API...')
    expectConsoleError('es: Hola')
    expectConsoleError('fr: Bonjour')
    await invoke(addCommand, ['settings', '--json'])
    expect(mocks.addPhrases).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'settings', value: 'settings' }),
      expect.anything(),
      expect.anything(),
    ])

    mocks.getPhrases.mockResolvedValueOnce([
      { key: 'settings', language: 'en', value: 'Settings' },
    ])
    await expect(invoke(addCommand, ['settings'])).rejects.toThrow(
      'already exists in project',
    )
    expect(mocks.addPhrases).toHaveBeenCalledTimes(1)
  })

  it('uses English safely when a legacy project has no default locale', async () => {
    mocks.getProject.mockResolvedValueOnce({
      ...project,
      defaultLocale: undefined,
      locales: ['en'],
    })
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(addCommand, ['health.check', 'Healthy'])

    expect(mocks.addPhrases).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'health.check',
        language: 'en',
        value: 'Healthy',
      }),
    ])
    expect(mocks.translateToAllLanguages).not.toHaveBeenCalled()
    expect(mocks.translateToAllLanguagesLocal).not.toHaveBeenCalled()
    expect(consoleLog.mock.calls.flat().join('\n')).toContain('Added 1 phrases')
  })

  it('deletes every locale row and reports a null result as zero', async () => {
    mocks.deletePhrases.mockResolvedValue(undefined)
    await invoke(deleteCommand, ['obsolete.key', '--json'])

    expect(mocks.deletePhrases).toHaveBeenCalledWith({
      key: 'obsolete.key',
      projectName: 'website',
    })
    expect(mocks.printJson).toHaveBeenCalledWith({
      deleted: 0,
      key: 'obsolete.key',
      ok: true,
      project: 'website',
    })
  })

  it('reports the number of deleted locale rows to a terminal user', async () => {
    mocks.deletePhrases.mockResolvedValue([
      { language: 'en' },
      { language: 'es' },
    ])
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(deleteCommand, ['obsolete.key'])

    expect(consoleLog).toHaveBeenCalledWith(
      'Deleted phrases for key "obsolete.key" from project "website" (2 entries)',
    )
  })

  it('reports zero when a legacy delete response has no row list', async () => {
    mocks.deletePhrases.mockResolvedValue(undefined)
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(deleteCommand, ['obsolete.key'])

    expect(consoleLog).toHaveBeenCalledWith(
      'Deleted phrases for key "obsolete.key" from project "website" (0 entries)',
    )
  })
})

describe('querying and diagnosing phrases', () => {
  const phrases = [
    {
      key: 'greeting',
      language: 'en',
      projects: ['website', 'dashboard'],
      value: 'Hello',
    },
    {
      key: 'salutation',
      language: 'en',
      projects: ['website'],
      value: 'Hello',
    },
    { key: 'greeting', language: 'es', projects: ['website'], value: 'Hola' },
  ]

  it('lists languages or raw phrases using the same server filters', async () => {
    mocks.getPhrases.mockResolvedValue(phrases)

    await invoke(phrasesCommand, [
      'list',
      '--language',
      'en',
      '--key',
      'greeting',
      '--languages',
      '--json',
    ])
    expect(mocks.getPhrases).toHaveBeenCalledWith({
      key: 'greeting',
      language: 'en',
      project: 'website',
    })
    expect(mocks.printJson).toHaveBeenCalledWith(['en', 'es'])

    mocks.printJson.mockClear()
    await invoke(phrasesCommand, [
      'get',
      'greeting',
      '--language',
      'es',
      '--limit',
      '1',
      '--json',
    ])
    expect(mocks.getPhrases).toHaveBeenLastCalledWith({
      key: 'greeting',
      language: 'es',
      project: 'website',
    })
    expect(mocks.printJson).toHaveBeenCalledWith([phrases[0]])

    mocks.printJson.mockClear()
    await invoke(phrasesCommand, ['list', '--json'])
    expect(mocks.printJson).toHaveBeenCalledWith(phrases)

    mocks.printJson.mockClear()
    await invoke(phrasesCommand, ['get', '--json'])
    expect(mocks.getPhrases).toHaveBeenLastCalledWith({ project: 'website' })
    expect(mocks.printJson).toHaveBeenCalledWith(phrases)
  })

  it('groups duplicate values with their cross-project provenance', async () => {
    mocks.getPhrases.mockResolvedValue(phrases.slice(0, 2))
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(duplicatesCommand, [])

    expect(mocks.getPhrases).toHaveBeenCalledWith({
      language: 'en',
      project: 'website',
    })
    expect(consoleLog.mock.calls.flat().join('\n')).toContain('dashboard')

    mocks.getPhrases.mockResolvedValue([{ key: 'unique', value: 'Only once' }])
    expectConsoleError(
      'Fetching phrases for language "en" in project "website"...',
    )
    await invoke(duplicatesCommand, ['--json'])
    expect(mocks.printJson).toHaveBeenLastCalledWith([])
  })

  it('uses English for legacy projects and explains a clean duplicate scan', async () => {
    mocks.getProject.mockResolvedValueOnce({
      ...project,
      defaultLocale: undefined,
    })
    mocks.getPhrases.mockResolvedValue([
      { key: 'unique', value: 'Only once', projects: ['website'] },
    ])
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(duplicatesCommand, [])

    expect(mocks.getPhrases).toHaveBeenCalledWith({
      language: 'en',
      project: 'website',
    })
    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      'No duplicate values found.',
    )
  })

  it('distinguishes empty results, language summaries, and readable phrase output', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    mocks.getPhrases.mockResolvedValueOnce([])
    await invoke(phrasesCommand, ['list'])
    expect(consoleLog).toHaveBeenCalledWith('No phrases found')

    mocks.getPhrases.mockResolvedValueOnce(phrases)
    await invoke(phrasesCommand, ['list', '--languages'])
    expect(consoleLog).toHaveBeenCalledWith('2 language(s): en, es')

    mocks.getPhrases.mockResolvedValueOnce(phrases)
    await invoke(phrasesCommand, ['list'])
    expect(consoleLog.mock.calls.flat().join('\n')).toContain('greeting: Hello')

    await invoke(phrasesCommand, ['get', '--key', 'salutation'])
    expect(mocks.getPhrases).toHaveBeenLastCalledWith({
      key: 'salutation',
      project: 'website',
    })
  })
})

describe('updating and sharing phrases', () => {
  it('updates one translation, removes machine metadata, and reports shared scope', async () => {
    mocks.getPhrases.mockResolvedValue([
      {
        _id: 'phrase-1',
        googleTranslate: true,
        key: 'greeting',
        language: 'es',
        machineTranslated: true,
        model: 'gpt-5-mini',
        projects: ['website', 'dashboard'],
        value: 'Buenas',
      },
    ])

    await invoke(updateCommand, [
      'greeting',
      'Hola',
      '--language',
      'es',
      '--json',
    ])

    expect(mocks.updatePhrase).toHaveBeenCalledWith(
      expect.objectContaining({
        googleTranslate: false,
        machineTranslated: false,
        model: undefined,
        value: 'Hola',
      }),
    )
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({
        changed: true,
        previousValue: 'Buenas',
        projects: ['website', 'dashboard'],
      }),
    )
  })

  it('does not write an unchanged phrase and rejects ambiguous matches', async () => {
    const phrase = { key: 'greeting', language: 'en', value: 'Hello' }
    mocks.getPhrases.mockResolvedValueOnce([phrase])
    await invoke(updateCommand, ['greeting', 'Hello', '--json'])
    expect(mocks.updatePhrase).not.toHaveBeenCalled()
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ changed: false }),
    )

    mocks.getPhrases.mockResolvedValueOnce([phrase, { ...phrase, _id: 'two' }])
    await expect(invoke(updateCommand, ['greeting', 'Hi'])).rejects.toThrow(
      'expected 1 phrase but found 2',
    )

    mocks.getPhrases.mockResolvedValueOnce([])
    await expect(invoke(updateCommand, ['missing', 'Hi'])).rejects.toThrow(
      'no phrase found with key "missing"',
    )
  })

  it('reports an unchanged legacy-project phrase to a terminal user', async () => {
    mocks.getProject.mockResolvedValueOnce({
      ...project,
      defaultLocale: undefined,
    })
    mocks.getPhrases.mockResolvedValueOnce([
      { key: 'greeting', language: 'en', value: 'Hello' },
    ])
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(updateCommand, ['greeting', 'Hello'])

    expect(mocks.getPhrases).toHaveBeenCalledWith({
      key: 'greeting',
      language: 'en',
      project: 'website',
    })
    expect(mocks.updatePhrase).not.toHaveBeenCalled()
    expect(consoleLog).toHaveBeenCalledWith(
      'No change: en value is already "Hello"',
    )
  })

  it('falls back to the current project when a legacy phrase has no memberships', async () => {
    mocks.getPhrases.mockResolvedValueOnce([
      { key: 'greeting', language: 'en', value: 'Hello' },
    ])

    await invoke(updateCommand, ['greeting', 'Hi', '--json'])

    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ projects: ['website'] }),
    )
  })

  it('warns a terminal user before changing a phrase shared by several projects', async () => {
    mocks.getPhrases.mockResolvedValue([
      {
        key: 'greeting',
        language: 'en',
        projects: ['website', 'dashboard'],
        value: 'Hello',
      },
    ])
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(updateCommand, ['greeting', 'Hi'])

    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      'shared across 2 projects',
    )
    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      'Updated en: "Hello" → "Hi"',
    )
  })

  it('attaches every locale row to target projects without duplicating memberships', async () => {
    mocks.getProjectByIdOrName
      .mockResolvedValueOnce({ _id: 'project-1', name: 'website' })
      .mockResolvedValueOnce({ _id: 'project-2', name: 'dashboard' })
    mocks.getPhrases.mockResolvedValue([
      {
        _id: 'phrase-en',
        key: 'greeting',
        language: 'en',
        projects: ['website'],
        projectsIds: ['project-1'],
        value: 'Hello',
      },
      {
        _id: 'phrase-es',
        key: 'greeting',
        language: 'es',
        projects: ['website', 'dashboard'],
        projectsIds: ['project-1', 'project-2'],
        value: 'Hola',
      },
    ])
    expectConsoleError('Skipping website (same as source)')
    expectConsoleError('Sharing 2 phrase(s) from "website" with dashboard')
    expectConsoleError('  Shared en: Hello')

    await invoke(shareCommand, ['greeting', 'website', 'dashboard', '--json'])

    expect(mocks.updatePhrase).toHaveBeenCalledOnce()
    expect(mocks.updatePhrase).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'phrase-en',
        projects: ['website', 'dashboard'],
        projectsIds: ['project-1', 'project-2'],
      }),
    )
    expect(mocks.printJson).toHaveBeenCalledWith({
      key: 'greeting',
      ok: true,
      source: 'website',
      targets: ['dashboard'],
      total: 2,
      updated: 1,
    })
  })

  it('returns cleanly when every requested target is the source project', async () => {
    mocks.getProjectByIdOrName.mockResolvedValue(project)
    expectConsoleError('Skipping website (same as source)')
    await invoke(shareCommand, ['greeting', 'website', '--json'])

    expect(mocks.getPhrases).not.toHaveBeenCalled()
    expect(mocks.updatePhrase).not.toHaveBeenCalled()
    expect(mocks.printJson).toHaveBeenCalledWith({
      key: 'greeting',
      ok: true,
      source: 'website',
      targets: [],
      updated: 0,
    })
  })

  it('explains a source-only share request to a terminal user', async () => {
    mocks.getProjectByIdOrName.mockResolvedValue(project)
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(shareCommand, ['greeting', 'website'])

    expect(mocks.getPhrases).not.toHaveBeenCalled()
    expect(mocks.updatePhrase).not.toHaveBeenCalled()
    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      'No targets to attach',
    )
  })

  it('repairs missing membership arrays on legacy phrase rows', async () => {
    mocks.getProjectByIdOrName.mockResolvedValueOnce({
      _id: 'project-2',
      name: 'dashboard',
    })
    mocks.getPhrases.mockResolvedValueOnce([
      {
        _id: 'phrase-en',
        key: 'greeting',
        language: 'en',
        value: 'Hello',
      },
    ])
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(shareCommand, ['greeting', 'dashboard'])

    expect(mocks.updatePhrase).toHaveBeenCalledWith(
      expect.objectContaining({
        projects: ['dashboard'],
        projectsIds: ['project-2'],
      }),
    )
    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      'Updated 1/1 phrase(s)',
    )
  })

  it('rejects a missing target or a key with no source phrase rows', async () => {
    mocks.getProjectByIdOrName.mockResolvedValueOnce(undefined)
    await expect(
      invoke(shareCommand, ['greeting', 'missing-project']),
    ).rejects.toThrow('Target project "missing-project" not found')

    mocks.getProjectByIdOrName.mockResolvedValueOnce({
      _id: 'project-2',
      name: 'dashboard',
    })
    mocks.getPhrases.mockResolvedValueOnce([])
    await expect(
      invoke(shareCommand, ['greeting', 'dashboard']),
    ).rejects.toThrow('no phrase found with key "greeting"')
  })

  it('detaches the current project from every locale row and keeps the other projects', async () => {
    mocks.getPhrases.mockResolvedValue([
      {
        _id: 'phrase-en',
        key: 'greeting',
        language: 'en',
        projects: ['website', 'dashboard'],
        projectsIds: ['project-1', 'project-2'],
        value: 'Hello',
      },
      {
        _id: 'phrase-es',
        key: 'greeting',
        language: 'es',
        projects: ['dashboard', 'website'],
        projectsIds: ['project-2', 'project-1'],
        value: 'Hola',
      },
    ])
    expectConsoleError('Detaching "website" from 2 phrase(s)')
    expectConsoleError('  Detached en: Hello')
    expectConsoleError('  Detached es: Hola')

    await invoke(unshareCommand, ['greeting', '--json'])

    expect(mocks.getPhrases).toHaveBeenCalledWith({
      key: 'greeting',
      project: 'website',
    })
    expect(mocks.deletePhrases).not.toHaveBeenCalled()
    expect(mocks.updatePhrase).toHaveBeenCalledTimes(2)
    for (const _id of ['phrase-en', 'phrase-es']) {
      expect(mocks.updatePhrase).toHaveBeenCalledWith(
        expect.objectContaining({
          _id,
          projects: ['dashboard'],
          projectsIds: ['project-2'],
        }),
      )
    }
    expect(mocks.printJson).toHaveBeenCalledWith({
      key: 'greeting',
      ok: true,
      project: 'website',
      updated: 2,
    })
  })

  it('reports a detach to a terminal user', async () => {
    mocks.getPhrases.mockResolvedValue([
      {
        _id: 'phrase-en',
        key: 'greeting',
        language: 'en',
        projects: ['website', 'dashboard'],
        projectsIds: ['project-1', 'project-2'],
        value: 'Hello',
      },
    ])
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(unshareCommand, ['greeting'])

    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      'Updated 1 phrase(s) — removed project "website"',
    )
  })

  it('refuses to orphan a phrase that only the current project uses', async () => {
    mocks.getPhrases.mockResolvedValueOnce([
      {
        _id: 'phrase-en',
        key: 'greeting',
        language: 'en',
        projects: ['website', 'dashboard'],
        projectsIds: ['project-1', 'project-2'],
        value: 'Hello',
      },
      {
        _id: 'phrase-es',
        key: 'greeting',
        language: 'es',
        projects: ['website'],
        projectsIds: ['project-1'],
        value: 'Hola',
      },
    ])
    await expect(invoke(unshareCommand, ['greeting'])).rejects.toThrow(
      '"greeting" is not shared: 1 of its 2 phrase(s) belong only to "website"',
    )

    // Legacy rows with no membership arrays are not shared with anyone either.
    mocks.getPhrases.mockResolvedValueOnce([
      { _id: 'phrase-en', key: 'greeting', language: 'en', value: 'Hello' },
    ])
    await expect(invoke(unshareCommand, ['greeting'])).rejects.toThrow(
      'is not shared',
    )

    mocks.getPhrases.mockResolvedValueOnce([])
    await expect(invoke(unshareCommand, ['greeting'])).rejects.toThrow(
      'no phrase found with key "greeting" in project "website"',
    )
    expect(mocks.updatePhrase).not.toHaveBeenCalled()
  })
})
