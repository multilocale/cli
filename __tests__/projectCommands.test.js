/* Copyright 2013 - 2026 Waiterio LLC */

import { expectConsoleError } from '@monorepool/root/vitest.strict.js'
import { beforeEach, describe, expect, it, vi } from 'vitest' // eslint-disable-line import-js/no-extraneous-dependencies

const mocks = vi.hoisted(() => ({
  addProject: vi.fn(),
  buildProjectUpdate: vi.fn(),
  deleteProject: vi.fn(),
  ensureAuth: vi.fn(),
  fail: vi.fn(),
  getPhrases: vi.fn(),
  getProject: vi.fn(),
  getProjects: vi.fn(),
  isInteractive: vi.fn(),
  printJson: vi.fn(),
  prompt: vi.fn(),
  updateProject: vi.fn(),
}))

vi.mock('@monorepool/agentfirst/isInteractive.js', () => ({
  default: (...args) => mocks.isInteractive(...args),
}))
vi.mock('@monorepool/agentfirst/output.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    fail: (...args) => mocks.fail(...args),
    printJson: (...args) => mocks.printJson(...args),
  }
})
vi.mock('@multilocale/client/addProject.js', () => ({
  default: (...args) => mocks.addProject(...args),
}))
vi.mock('@multilocale/client/deleteProject.js', () => ({
  default: (...args) => mocks.deleteProject(...args),
}))
vi.mock('@multilocale/client/getPhrases.js', () => ({
  default: (...args) => mocks.getPhrases(...args),
}))
vi.mock('@multilocale/client/getProject.js', () => ({
  default: (...args) => mocks.getProject(...args),
}))
vi.mock('@multilocale/client/getProjects.js', () => ({
  default: (...args) => mocks.getProjects(...args),
}))
vi.mock('@multilocale/client/updateProject.js', () => ({
  default: (...args) => mocks.updateProject(...args),
}))
vi.mock('inquirer', () => ({
  default: { prompt: (...args) => mocks.prompt(...args) },
}))
vi.mock('../buildProjectUpdate.js', () => ({
  default: (...args) => mocks.buildProjectUpdate(...args),
}))
vi.mock('../ensureAuth.js', () => ({
  default: (...args) => mocks.ensureAuth(...args),
}))

const projectsCommand = (await import('../projectsCommand.js')).default

const project = {
  _id: 'project-1',
  context: 'Customer support dashboard',
  creationTime: '2026-01-01T00:00:00.000Z',
  defaultLocale: 'en',
  lastEditTime: '2026-01-02T00:00:00.000Z',
  locales: ['en', 'es'],
  logo: 'logo.png',
  name: 'website',
  organizationId: 'organization-1',
  paths: ['translations/%lang%.json'],
}

const invoke = async argv => {
  const command = projectsCommand()
  await command.parseAsync(argv, { from: 'user' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.addProject.mockImplementation(async value => ({
    _id: 'created-project',
    ...value,
  }))
  mocks.buildProjectUpdate.mockReturnValue({})
  mocks.deleteProject.mockResolvedValue({
    deletedPhrases: 3,
    detachedPhrases: 2,
  })
  mocks.ensureAuth.mockResolvedValue({ mode: 'key' })
  mocks.fail.mockImplementation(error => {
    throw error
  })
  mocks.getPhrases.mockResolvedValue([])
  mocks.getProject.mockResolvedValue(project)
  mocks.getProjects.mockResolvedValue([])
  mocks.isInteractive.mockReturnValue(false)
  mocks.prompt.mockResolvedValue({ confirmation: 'website' })
  mocks.updateProject.mockImplementation(async value => value)
})

describe('project discovery', () => {
  it('lists projects in human and machine-readable forms', async () => {
    mocks.getProjects.mockResolvedValue([
      project,
      { _id: 'project-2', name: '' },
    ])
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(['list'])
    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      '2. project-2 (project-2)',
    )

    await invoke(['list', '--json'])
    expect(mocks.printJson).toHaveBeenLastCalledWith([
      project,
      { _id: 'project-2', name: '' },
    ])
  })

  it('gets one project or the complete collection and reports missing ids', async () => {
    await invoke(['get', 'website', '--json'])
    expect(mocks.getProject).toHaveBeenCalledWith('website')
    expect(mocks.printJson).toHaveBeenLastCalledWith(project)

    mocks.getProjects.mockResolvedValue([project])
    await invoke(['get', '--json'])
    expect(mocks.printJson).toHaveBeenLastCalledWith([project])

    mocks.getProject.mockResolvedValueOnce(undefined)
    await expect(invoke(['get', 'missing'])).rejects.toThrow(
      'Project not found',
    )
  })

  it('makes empty and human-readable discovery useful without JSON tooling', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke(['list'])
    expect(consoleLog).toHaveBeenCalledWith('No projects found')

    await invoke(['get', 'website'])
    expect(consoleLog.mock.calls.flat().join('\n')).toContain('website')

    mocks.getProjects.mockResolvedValue([project])
    await invoke(['get'])
    expect(consoleLog.mock.calls.flat().join('\n')).toContain('project-1')
  })

  it('formats a readable project summary without omitting identity fields', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    await invoke(['read', 'website'])
    const output = consoleLog.mock.calls.flat().join('\n')
    expect(output).toContain('website')
    expect(output).toContain('project-1')
    expect(output).toContain('organization-1')
    expect(output).toContain('2026-01-01T00:00:00.000Z')
  })

  it('supports JSON reads and safely renders sparse legacy projects', async () => {
    await invoke(['read', 'website', '--json'])
    expect(mocks.printJson).toHaveBeenCalledWith(project)

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    mocks.getProject.mockResolvedValueOnce({ _id: 'legacy-project' })
    await invoke(['read', 'legacy-project'])
    expect(consoleLog.mock.calls.flat().join('\n')).toContain('legacy-project')

    mocks.getProject.mockResolvedValueOnce(undefined)
    await expect(invoke(['read', 'removed-project'])).rejects.toThrow(
      'Project not found',
    )
  })
})

describe('project mutation', () => {
  it('creates a project with a retained default locale and normalized paths', async () => {
    await invoke([
      'create',
      'mobile',
      '--default-locale',
      'en',
      '--locales',
      'es, fr',
      '--paths',
      'translations/%lang%.json,translations/%lang%.json',
      'locales/%lang%.json',
      '--json',
    ])

    expect(mocks.addProject).toHaveBeenCalledWith({
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr'],
      name: 'mobile',
      paths: ['translations/%lang%.json', 'locales/%lang%.json'],
    })
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLocale: 'en',
        id: 'created-project',
        locales: ['en', 'es', 'fr'],
      }),
    )
  })

  it('does not stamp JavaScript paths onto a project that omitted them', async () => {
    await invoke(['create', 'ios', '--json'])
    expect(mocks.addProject).toHaveBeenCalledWith({
      defaultLocale: 'en',
      locales: ['en'],
      name: 'ios',
    })
  })

  it('explains configured and default paths in human-readable create output', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await invoke([
      'create',
      'website-with-paths',
      '--paths',
      'translations/%lang%.json',
    ])
    expect(consoleLog.mock.calls.flat().join('\n')).toContain(
      'Paths (1): translations/%lang%.json',
    )

    await invoke(['create', 'website-with-defaults'])
    expect(consoleLog.mock.calls.flat().join('\n')).toContain('Paths: not set')
  })

  it('merges updates into the full project so omitted fields are preserved', async () => {
    mocks.buildProjectUpdate.mockReturnValue({
      locales: ['en', 'es', 'fr'],
      name: 'renamed',
    })
    await invoke([
      'update',
      'website',
      '--name',
      'renamed',
      '--locales',
      'fr',
      '--json',
    ])

    expect(mocks.buildProjectUpdate).toHaveBeenCalledWith({
      existing: project,
      options: expect.objectContaining({ locales: ['fr'], name: 'renamed' }),
    })
    expect(mocks.updateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'project-1',
        locales: ['en', 'es', 'fr'],
        logo: 'logo.png',
        name: 'renamed',
        organizationId: 'organization-1',
      }),
    )
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({ changed: ['locales', 'name'], ok: true }),
    )
  })

  it('falls back to the submitted update and formats array and scalar changes', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    mocks.buildProjectUpdate.mockReturnValue({
      context: 'Checkout labels',
      locales: ['en', 'it'],
    })
    mocks.updateProject.mockResolvedValueOnce(undefined)

    await invoke([
      'update',
      'website',
      '--context',
      'Checkout labels',
      '--locales',
      'it',
    ])

    const output = consoleLog.mock.calls.flat().join('\n')
    expect(output).toContain('context: Checkout labels')
    expect(output).toContain('locales: en, it')
    expect(output).toContain('Updated project: website (project-1)')
  })

  it('does not send an update when the selected project disappeared', async () => {
    mocks.getProject.mockResolvedValueOnce(undefined)

    await expect(
      invoke(['update', 'removed-project', '--name', 'new']),
    ).rejects.toThrow('Project removed-project not found')
    expect(mocks.updateProject).not.toHaveBeenCalled()
  })

  it('requires explicit non-interactive confirmation before deletion', async () => {
    mocks.getPhrases.mockResolvedValue([
      { key: 'greeting', language: 'en' },
      { key: 'greeting', language: 'es' },
      { key: 'checkout', language: 'en' },
    ])

    await expect(invoke(['delete', 'website'])).rejects.toThrow(
      'Refusing to delete without confirmation',
    )
    expect(mocks.deleteProject).not.toHaveBeenCalled()

    expectConsoleError('Project: website (project-1)')
    expectConsoleError('Phrases: 3 rows across 2 keys')
    await invoke(['delete', 'website', '--yes', '--json'])
    expect(mocks.deleteProject).toHaveBeenCalledWith('project-1')
    expect(mocks.printJson).toHaveBeenCalledWith({
      deletedPhrases: 3,
      detachedPhrases: 2,
      ok: true,
    })
  })

  it('requires the exact project name from interactive confirmation', async () => {
    mocks.isInteractive.mockReturnValue(true)
    mocks.prompt.mockResolvedValueOnce({ confirmation: 'wrong-name' })
    await expect(invoke(['delete', 'website'])).rejects.toThrow(
      'Name did not match',
    )

    mocks.prompt.mockResolvedValueOnce({ confirmation: 'website' })
    await invoke(['delete', 'website'])
    expect(mocks.deleteProject).toHaveBeenCalledWith('project-1')
  })

  it('does not delete a project that disappeared before confirmation', async () => {
    mocks.getProject.mockResolvedValueOnce(undefined)

    await expect(
      invoke(['delete', 'removed-project', '--yes']),
    ).rejects.toThrow('Project removed-project not found')
    expect(mocks.getPhrases).not.toHaveBeenCalled()
    expect(mocks.deleteProject).not.toHaveBeenCalled()
  })

  it('uses safe zero counts when legacy delete responses omit details', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    mocks.getPhrases.mockResolvedValueOnce(undefined)
    mocks.deleteProject.mockResolvedValueOnce(undefined)

    await invoke(['delete', 'website', '--yes'])

    const output = consoleLog.mock.calls.flat().join('\n')
    expect(output).toContain('Phrases: 0 rows across 0 keys')
    expect(output).toContain('0 phrases deleted, 0 detached')
  })
})
