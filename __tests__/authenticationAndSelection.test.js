/* Copyright 2013 - 2026 Waiterio LLC */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest' // eslint-disable-line import-js/no-extraneous-dependencies

const mocks = vi.hoisted(() => ({
  agentfirstLoginCommand: vi.fn(),
  agentfirstLogoutCommand: vi.fn(),
  agentfirstSchemaCommand: vi.fn(),
  agentfirstSignupCommand: vi.fn(),
  getConfig: vi.fn(),
  getProjectHttp: vi.fn(),
  getProjects: vi.fn(),
  isInteractive: vi.fn(),
  isRefreshTokenExpired: vi.fn(),
  login: vi.fn(),
  loginInstructions: vi.fn(
    () => 'Run multilocale login or set MULTILOCALE_API_KEY.',
  ),
  loginWithBrowser: vi.fn(),
  prompt: vi.fn(),
  resolveCredential: vi.fn(),
  session: {
    getAccessToken: vi.fn(),
    getApiKeySecret: vi.fn(),
    getRefreshToken: vi.fn(),
    remove: vi.fn(),
    setAccessToken: vi.fn(),
  },
  setAccessTokenCallback: vi.fn(),
  setAccessTokenForClient: vi.fn(),
  setApiKeyForClient: vi.fn(),
  setConfig: vi.fn(),
  setRefreshTokenForClient: vi.fn(),
}))

vi.mock('@monorepool/agentfirst/isInteractive.js', () => ({
  default: (...args) => mocks.isInteractive(...args),
}))
vi.mock('@monorepool/agentfirst/loginCommand.js', () => ({
  default: (...args) => mocks.agentfirstLoginCommand(...args),
}))
vi.mock('@monorepool/agentfirst/loginHint.js', () => ({
  loginInstructions: (...args) => mocks.loginInstructions(...args),
}))
vi.mock('@monorepool/agentfirst/loginWithBrowser.js', () => ({
  default: (...args) => mocks.loginWithBrowser(...args),
}))
vi.mock('@monorepool/agentfirst/logoutCommand.js', () => ({
  default: (...args) => mocks.agentfirstLogoutCommand(...args),
}))
vi.mock('@monorepool/agentfirst/resolveCredential.js', () => ({
  default: (...args) => mocks.resolveCredential(...args),
}))
vi.mock('@monorepool/agentfirst/schemaCommand.js', () => ({
  default: (...args) => mocks.agentfirstSchemaCommand(...args),
}))
vi.mock('@monorepool/agentfirst/signupCommand.js', () => ({
  default: (...args) => mocks.agentfirstSignupCommand(...args),
}))
vi.mock('@multilocale/client/accessToken.js', () => ({
  setAccessTokenCallbackForMultilocaleClient: (...args) =>
    mocks.setAccessTokenCallback(...args),
  setAccessTokenForMultilocaleClient: (...args) =>
    mocks.setAccessTokenForClient(...args),
}))
vi.mock('@multilocale/client/apiKey.js', () => ({
  setApiKeyForMultilocaleClient: (...args) => mocks.setApiKeyForClient(...args),
}))
vi.mock('@multilocale/client/getProject.js', () => ({
  default: (...args) => mocks.getProjectHttp(...args),
}))
vi.mock('@multilocale/client/getProjects.js', () => ({
  default: (...args) => mocks.getProjects(...args),
}))
vi.mock('@multilocale/client/refreshToken.js', () => ({
  isRefreshTokenExpired: (...args) => mocks.isRefreshTokenExpired(...args),
  setRefreshTokenForMultilocaleClient: (...args) =>
    mocks.setRefreshTokenForClient(...args),
}))
vi.mock('inquirer', () => ({
  default: { prompt: (...args) => mocks.prompt(...args) },
}))
vi.mock('../getConfig.js', () => ({
  default: (...args) => mocks.getConfig(...args),
}))
vi.mock('../login.js', () => ({
  default: (...args) => mocks.login(...args),
}))
vi.mock('../sessionStore.js', () => ({ default: mocks.session }))
vi.mock('../setConfig.js', () => ({
  default: (...args) => mocks.setConfig(...args),
}))

const ensureAuth = (await import('../ensureAuth.js')).default
const getProject = (await import('../getProject.js')).default
const login = (await vi.importActual('../login.js')).default
const loginCommand = (await import('../loginCommand.js')).default
const logoutCommand = (await import('../logoutCommand.js')).default
const schemaCommand = (await import('../schemaCommand.js')).default
const signupCommand = (await import('../signupCommand.js')).default

beforeEach(() => {
  vi.clearAllMocks()
  mocks.agentfirstLoginCommand.mockImplementation(options => ({ options }))
  mocks.agentfirstLogoutCommand.mockImplementation(options => ({ options }))
  mocks.agentfirstSchemaCommand.mockImplementation(options => ({ options }))
  mocks.agentfirstSignupCommand.mockImplementation(options => ({ options }))
  mocks.getConfig.mockReturnValue(undefined)
  mocks.getProjectHttp.mockResolvedValue(undefined)
  mocks.getProjects.mockResolvedValue([])
  mocks.isInteractive.mockReturnValue(false)
  mocks.isRefreshTokenExpired.mockReturnValue(false)
  mocks.login.mockResolvedValue(undefined)
  mocks.loginWithBrowser.mockResolvedValue(undefined)
  mocks.prompt.mockResolvedValue({ projectId: 'project-2' })
  mocks.session.getAccessToken.mockReturnValue('access-token')
  mocks.session.getApiKeySecret.mockReturnValue('stored-key')
  mocks.session.getRefreshToken.mockReturnValue('refresh-token')
  mocks.setConfig.mockReturnValue(undefined)
  delete process.env.MULTILOCALE_API_URL
  delete process.env.MULTILOCALE_APP_URL
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('credential resolution', () => {
  it('rehydrates a current browser session and preserves refresh callbacks', async () => {
    const token = { credential: 'access-token', mode: 'token' }
    mocks.resolveCredential.mockReturnValue(token)

    await expect(ensureAuth()).resolves.toBe(token)
    expect(mocks.setAccessTokenForClient).toHaveBeenCalledWith('access-token')
    expect(mocks.setRefreshTokenForClient).toHaveBeenCalledWith('refresh-token')
    const refreshCallback = mocks.setAccessTokenCallback.mock.calls[0][0]
    refreshCallback('rotated-token')
    expect(mocks.session.setAccessToken).toHaveBeenCalledWith('rotated-token')
    expect(mocks.setApiKeyForClient).not.toHaveBeenCalled()
  })

  it('drops an expired token session and falls back to a stored key', async () => {
    const key = { credential: 'api-key-secret', mode: 'key' }
    mocks.resolveCredential
      .mockReturnValueOnce({ credential: 'expired', mode: 'token' })
      .mockReturnValueOnce(key)
    mocks.isRefreshTokenExpired.mockReturnValue(true)

    await expect(ensureAuth()).resolves.toBe(key)
    expect(mocks.session.remove).toHaveBeenCalledWith('accessToken')
    expect(mocks.session.remove).toHaveBeenCalledWith('refreshToken')
    expect(mocks.setAccessTokenForClient).toHaveBeenLastCalledWith(null)
    expect(mocks.setRefreshTokenForClient).toHaveBeenLastCalledWith(null)
    expect(mocks.setAccessTokenCallback).toHaveBeenLastCalledWith(null)
    expect(mocks.setApiKeyForClient).toHaveBeenCalledWith('api-key-secret')
  })

  it('fails immediately with actionable instructions in headless use', async () => {
    mocks.resolveCredential.mockReturnValue({ mode: 'none' })
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    })
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    })

    await expect(ensureAuth()).rejects.toThrow(
      'Run multilocale login or set MULTILOCALE_API_KEY.',
    )
    expect(mocks.loginInstructions).toHaveBeenCalledWith(
      expect.objectContaining({
        appUrl: 'https://app.multilocale.com',
        binaryName: 'multilocale',
        envKeyName: 'MULTILOCALE_API_KEY',
      }),
    )
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('uses browser login on a terminal and then resolves the new session', async () => {
    const authenticated = { credential: 'fresh-token', mode: 'token' }
    mocks.resolveCredential
      .mockReturnValueOnce({ mode: 'none' })
      .mockReturnValueOnce(authenticated)
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(ensureAuth()).resolves.toBe(authenticated)
    expect(consoleError).toHaveBeenCalledWith('Please login first')
    expect(mocks.login).toHaveBeenCalledOnce()
    expect(mocks.setAccessTokenForClient).toHaveBeenCalledWith('access-token')
  })
})

describe('project selection', () => {
  const projects = [
    { _id: 'project-2', name: 'Zulu', organizationId: 'organization-1' },
    { _id: 'project-1', name: 'Alpha', organizationId: 'organization-1' },
  ]

  it('uses an explicit flag or saved default without listing projects', async () => {
    mocks.getProjectHttp.mockResolvedValue({ _id: 'project-explicit' })
    await expect(getProject({ project: 'project-explicit' })).resolves.toEqual({
      _id: 'project-explicit',
    })
    expect(mocks.getProjectHttp).toHaveBeenCalledWith('project-explicit')

    mocks.getConfig.mockReturnValue({ projectId: 'project-config' })
    mocks.getProjectHttp.mockResolvedValue({ _id: 'project-config' })
    await expect(getProject()).resolves.toEqual({ _id: 'project-config' })
    expect(mocks.getProjects).not.toHaveBeenCalled()
  })

  it('selects the only project and saves it as the local default', async () => {
    mocks.getProjects.mockResolvedValue([projects[0]])

    await expect(getProject()).resolves.toEqual(projects[0])
    expect(mocks.setConfig).toHaveBeenCalledWith({
      organizationId: 'organization-1',
      projectId: 'project-2',
    })
  })

  it('refuses to hang a headless caller when several projects need a choice', async () => {
    mocks.getProjects.mockResolvedValue(projects)

    await expect(getProject()).rejects.toThrow(
      'This account has 2 projects and none was selected.',
    )
    expect(mocks.prompt).not.toHaveBeenCalled()
  })

  it('sorts interactive choices and persists the selected project', async () => {
    mocks.getProjects.mockResolvedValue(projects)
    mocks.isInteractive.mockReturnValue(true)

    await expect(getProject()).resolves.toEqual(projects[0])
    expect(mocks.prompt).toHaveBeenCalledWith([
      expect.objectContaining({
        choices: [
          { name: 'Alpha', value: 'project-1' },
          { name: 'Zulu', value: 'project-2' },
        ],
      }),
    ])
    expect(mocks.setConfig).toHaveBeenCalledWith({
      organizationId: 'organization-1',
      projectId: 'project-2',
    })
  })

  it('explains when an account has no project yet', async () => {
    await expect(getProject()).rejects.toThrow(
      'There are no projects. Create one first',
    )
  })
})

describe('agent-first command adapters', () => {
  it('opens the current app URL with the shared session store', async () => {
    process.env.MULTILOCALE_APP_URL = 'http://localhost:4173'
    await login()
    expect(mocks.loginWithBrowser).toHaveBeenCalledWith({
      appUrl: 'http://localhost:4173',
      session: mocks.session,
    })
  })

  it('wires signup, logout, and schema commands to the product contract', () => {
    process.env.MULTILOCALE_API_URL = 'http://localhost:4500'
    process.env.MULTILOCALE_APP_URL = 'http://localhost:4173'
    const signup = signupCommand()
    const logout = logoutCommand()
    const program = { name: 'program' }
    const schema = schemaCommand(program)

    expect(signup.options).toEqual(
      expect.objectContaining({
        appUrl: 'http://localhost:4173',
        binaryName: 'multilocale',
        session: mocks.session,
      }),
    )
    expect(signup.options.getApiUrl()).toBe('http://localhost:4500')
    expect(logout.options).toEqual({
      binaryName: 'multilocale',
      envKeyName: 'MULTILOCALE_API_KEY',
      session: mocks.session,
    })
    expect(schema.options).toEqual({ program })
  })

  it('verifies API keys and always clears them from the client', async () => {
    mocks.getProjects.mockResolvedValue([{ _id: 'project-1' }])
    const command = loginCommand()

    await expect(command.options.verify()).resolves.toBe(
      'Logged in with an API key — 1 project(s) accessible.',
    )
    expect(mocks.setApiKeyForClient).toHaveBeenNthCalledWith(1, 'stored-key')
    expect(mocks.setApiKeyForClient).toHaveBeenLastCalledWith(null)

    mocks.getProjects.mockRejectedValueOnce(new Error('unauthorized'))
    await expect(command.options.verify()).rejects.toThrow('unauthorized')
    expect(mocks.setApiKeyForClient).toHaveBeenLastCalledWith(null)
  })
})
