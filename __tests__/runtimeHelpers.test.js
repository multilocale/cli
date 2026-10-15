/* Copyright 2013 - 2026 Waiterio LLC */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { format } from 'node:util'

import { expectConsoleError } from '@monorepool/root/vitest.strict.js'
// eslint-disable-next-line import-js/no-extraneous-dependencies
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  config: undefined,
  isRefreshTokenExpired: vi.fn(),
  localStorage: {
    clear: vi.fn(),
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
  setAccessTokenCallback: vi.fn(),
  setAccessTokenForClient: vi.fn(),
  setRefreshTokenForClient: vi.fn(),
}))

vi.mock('../getConfig.js', () => ({
  default: () => mocks.config,
}))
vi.mock('../session/localStorage.js', () => ({
  default: mocks.localStorage,
}))
vi.mock('@multilocale/client/accessToken.js', () => ({
  setAccessTokenCallbackForMultilocaleClient: (...args) =>
    mocks.setAccessTokenCallback(...args),
  setAccessTokenForMultilocaleClient: (...args) =>
    mocks.setAccessTokenForClient(...args),
}))
vi.mock('@multilocale/client/refreshToken.js', () => ({
  isRefreshTokenExpired: (...args) => mocks.isRefreshTokenExpired(...args),
  setRefreshTokenForMultilocaleClient: (...args) =>
    mocks.setRefreshTokenForClient(...args),
}))

const cliConfig = (await import('../cliConfig.js')).default
const cliGetUrl = (await import('../cliGetUrl.js')).default
const getExtension = (await import('../getExtension.js')).default
const getFormat = (await import('../getFormat.js')).default
const getHeader = (await import('../getHeader.js')).default
const getNested = (await import('../getNested.js')).default
const getPaths = (await import('../getPaths.js')).default
const getPostScript = (await import('../getPostScript.js')).default
const clearSession = (await import('../session/clearSession.js')).default
const getAccessToken = (await import('../session/getAccessToken.js')).default
const getRefreshToken = (await import('../session/getRefreshToken.js')).default
const isLoggedInSession = (await import('../session/isLoggedInSession.js'))
  .default
const rehydrateSession = (await import('../session/rehydrateSession.js'))
  .default
const setAccessToken = (await import('../session/setAccessToken.js')).default
const setRefreshToken = (await import('../session/setRefreshToken.js')).default
const storeNewSession = (await import('../session/storeNewSession.js')).default

describe('format and path configuration', () => {
  beforeEach(() => {
    mocks.config = undefined
    delete process.env.MULTILOCALE_API_URL
    delete process.env.MULTILOCALE_APP_URL
  })

  afterAll(() => {
    delete process.env.MULTILOCALE_API_URL
    delete process.env.MULTILOCALE_APP_URL
  })

  it('resolves public URLs at call time and honors local overrides', () => {
    expect(cliConfig.BINARY_NAME).toBe('multilocale')
    expect(cliConfig.ENV_KEY_NAME).toBe('MULTILOCALE_API_KEY')
    expect(cliConfig.getApiUrl()).toBe('https://api.multilocale.com')
    expect(cliConfig.getAppUrl()).toBe('https://app.multilocale.com')
    expect(cliGetUrl({ service: 'api' })).toBe('https://api.multilocale.com')
    expect(cliGetUrl({ service: 'app' })).toBe('https://app.multilocale.com')
    expect(cliGetUrl()).toBe('https://www.multilocale.com')

    process.env.MULTILOCALE_API_URL = 'http://127.0.0.1:4500'
    process.env.MULTILOCALE_APP_URL = 'http://127.0.0.1:4501'
    expect(cliConfig.getApiUrl()).toBe('http://127.0.0.1:4500')
    expect(cliConfig.getAppUrl()).toBe('http://127.0.0.1:4501')
    expect(cliGetUrl({ service: 'api' })).toBe('http://127.0.0.1:4500')
    expect(cliGetUrl({ service: 'app' })).toBe('http://127.0.0.1:4501')
  })

  it('uses flags before configuration and chooses matching extensions', async () => {
    mocks.config = {
      extension: 'catalogue',
      format: 'esm',
      header: '// generated\n',
      nested: true,
      paths: ['i18n/%lang%.catalogue'],
      postScript: 'pnpm format',
    }

    await expect(getFormat({ format: 'swift' })).resolves.toBe('swift')
    await expect(
      getExtension({ extension: 'strings', format: 'swift' }),
    ).resolves.toBe('strings')
    await expect(getHeader({ header: '// explicit\n' })).resolves.toBe(
      '// explicit\n',
    )
    await expect(getPostScript({ postScript: 'pnpm lint' })).resolves.toBe(
      'pnpm lint',
    )
    expect(getPaths({ project: { paths: ['src/%lang%.json'] } })).toEqual([
      'src/%lang%.json',
    ])

    await expect(getFormat()).resolves.toBe('esm')
    await expect(getExtension()).resolves.toBe('catalogue')
    await expect(getHeader()).resolves.toBe('// generated\n')
    await expect(getNested()).resolves.toBe(true)
    await expect(getNested({ nested: false })).resolves.toBe(false)
    await expect(getPostScript()).resolves.toBe('pnpm format')
    expect(getPaths({ project: {} })).toEqual(['i18n/%lang%.catalogue'])
  })

  it('provides safe defaults and rejects unsupported formats', async () => {
    await expect(getFormat()).resolves.toBe('json')
    await expect(getHeader()).resolves.toBe('')
    await expect(getNested()).resolves.toBe(false)
    await expect(getPostScript()).resolves.toBe('')
    await expect(
      getPostScript({ 'post-script': 'node verify.js' }),
    ).resolves.toBe('node verify.js')
    expect(
      getPaths({ project: {}, format: 'swift', extension: 'strings' }),
    ).toEqual(['%lang%.lproj/Localizable.strings'])
    expect(getPaths({ project: {} })).toEqual(['translations/%lang%.json'])

    for (const [format, extension] of [
      ['json', 'json'],
      ['esm', 'js'],
      ['js', 'js'],
      ['cjs', 'js'],
      ['swift', 'strings'],
    ]) {
      await expect(getExtension({ format })).resolves.toBe(extension)
    }

    mocks.config = { format: 'yaml' }
    await expect(getFormat()).rejects.toThrow('Invalid format: yaml')
  })
})

describe('filesystem discovery and local configuration', () => {
  const originalDirectory = process.cwd()
  let directory

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'multilocale-files-'))
    fs.mkdirSync(path.join(directory, 'app', 'src'), { recursive: true })
    fs.mkdirSync(path.join(directory, 'app', 'build'), { recursive: true })
    fs.mkdirSync(path.join(directory, 'node_modules', 'ignored'), {
      recursive: true,
    })
    fs.writeFileSync(path.join(directory, 'package.json'), '{}')
    fs.writeFileSync(
      path.join(directory, 'gatsby-config.js'),
      'export default {}',
    )
    fs.writeFileSync(
      path.join(directory, 'app', 'src', 'AndroidManifest.xml'),
      '<manifest />',
    )
    fs.writeFileSync(
      path.join(directory, 'app', 'build', 'AndroidManifest.xml'),
      '<manifest />',
    )
    fs.writeFileSync(
      path.join(directory, 'node_modules', 'ignored', 'bad.json'),
      '{}',
    )
    process.chdir(directory)
  })

  afterAll(() => {
    process.chdir(originalDirectory)
    fs.rmSync(directory, { force: true, recursive: true })
  })

  it('finds project markers while ignoring builds and dependency trees', async () => {
    const getFiles = (await import('../getFiles.js')).default
    const getAndroidManifest = (await import('../getAndroidManifest.js'))
      .default
    const getAndroidResPath = (await import('../getAndroidResPath.js')).default
    const isAndroid = (await import('../isAndroid.js')).default
    const isGatsby = (await import('../isGatsby.js')).default
    const isJavascript = (await import('../isJavascript.js')).default

    expect(getFiles()).toEqual(
      expect.arrayContaining([
        '/app/src/AndroidManifest.xml',
        '/gatsby-config.js',
        '/package.json',
      ]),
    )
    expect(getFiles()).not.toEqual(
      expect.arrayContaining(['/node_modules/ignored/bad.json']),
    )
    expect(getAndroidManifest()).toBe('/app/src/AndroidManifest.xml')
    expect(getAndroidResPath()).toBe(path.join('app', 'src', 'res'))
    expect(isAndroid()).toBe(true)
    expect(isGatsby()).toBe(true)
    expect(isJavascript()).toBe(true)
  })

  it('round-trips multilocale.json and leaves an empty file when cleared', async () => {
    vi.doUnmock('../getConfig.js')
    vi.resetModules()
    const getConfig = (await import('../getConfig.js')).default
    const getConfigPath = (await import('../getConfigPath.js')).default
    const setConfig = (await import('../setConfig.js')).default

    expect(getConfigPath()).toBeUndefined()
    expect(getConfig()).toBeUndefined()

    setConfig({ nested: true, projectId: 'project-1' })
    expect(getConfigPath()).toBe('multilocale.json')
    expect(getConfig()).toEqual({ nested: true, projectId: 'project-1' })

    setConfig()
    expect(
      fs.readFileSync(path.join(directory, 'multilocale.json'), 'utf8'),
    ).toBe('')
    expect(getConfig()).toBe('')
  })

  it('skips dangling filesystem entries instead of aborting discovery', async () => {
    const dangling = path.join(directory, 'dangling-link')
    fs.symlinkSync(path.join(directory, 'missing-target'), dangling)
    const getFiles = (await import('../getFiles.js')).default

    expect(() => getFiles()).not.toThrow()
    expect(getFiles()).not.toEqual(expect.arrayContaining(['/dangling-link']))
  })
})

describe('legacy session compatibility helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.localStorage.getItem.mockImplementation(key => `${key}-value`)
    mocks.localStorage.setItem.mockImplementation(
      (key, value) => `${key}:${value}`,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads, writes, rehydrates, and clears the same token slots', async () => {
    expect(getAccessToken()).toBe('accessToken-value')
    expect(getRefreshToken()).toBe('refreshToken-value')
    expect(setAccessToken('access-1')).toBe('accessToken:access-1')
    expect(setRefreshToken('refresh-1')).toBe('refreshToken:refresh-1')

    await rehydrateSession()
    expect(mocks.setAccessTokenForClient).toHaveBeenCalledWith(
      'accessToken-value',
    )
    expect(mocks.setRefreshTokenForClient).toHaveBeenCalledWith(
      'refreshToken-value',
    )
    expect(mocks.setAccessTokenCallback).toHaveBeenCalledWith(setAccessToken)

    clearSession()
    expect(mocks.localStorage.clear).toHaveBeenCalledOnce()
    expect(mocks.setAccessTokenForClient).toHaveBeenLastCalledWith(null)
    expect(mocks.setRefreshTokenForClient).toHaveBeenLastCalledWith(null)
    expect(mocks.setAccessTokenCallback).toHaveBeenLastCalledWith(null)
  })

  it('clears expired sessions but keeps current sessions intact', () => {
    mocks.isRefreshTokenExpired.mockReturnValue(false)
    expect(isLoggedInSession()).toBe(true)
    expect(mocks.localStorage.clear).not.toHaveBeenCalled()

    mocks.isRefreshTokenExpired.mockReturnValue(true)
    expect(isLoggedInSession()).toBe(false)
    expect(mocks.localStorage.clear).toHaveBeenCalledOnce()
  })

  it('stores new sessions in both durable storage and the live client', async () => {
    await expect(
      storeNewSession({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
    ).resolves.toBe(true)
    expect(mocks.localStorage.setItem).toHaveBeenCalledWith(
      'accessToken',
      'access-2',
    )
    expect(mocks.localStorage.setItem).toHaveBeenCalledWith(
      'refreshToken',
      'refresh-2',
    )
    expect(mocks.setAccessTokenForClient).toHaveBeenCalledWith(
      'access-2',
      setAccessToken,
    )
    expect(mocks.setRefreshTokenForClient).toHaveBeenCalledWith(
      'refresh-2',
      setRefreshToken,
    )
  })

  it('surfaces storage failures without claiming a session was saved', async () => {
    const error = new Error('read-only home')
    mocks.localStorage.setItem.mockImplementationOnce(() => {
      throw error
    })
    expectConsoleError(format('error', error))

    await expect(
      storeNewSession({ accessToken: 'access-3', refreshToken: 'refresh-3' }),
    ).rejects.toBe(error)
  })
})
