/* Copyright 2013 - 2026 Waiterio LLC */

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

  it('formats a readable project summary without omitting identity fields', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    await invoke(['read', 'website'])
    const output = consoleLog.mock.calls.flat().join('\n')
    expect(output).toContain('website')
    expect(output).toContain('project-1')
    expect(output).toContain('organization-1')
    expect(output).toContain('2026-01-01T00:00:00.000Z')
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
})
