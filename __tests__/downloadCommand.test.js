/* Copyright 2013 - 2026 Waiterio LLC */

// What the unit tests cannot prove: that `download` writes that shape to disk,
// and that the flat default is still byte-for-byte what it always was.
//
// The command runs for real, in a real directory, as a child process — see
// downloadFixture.cjs for why it is a child process and not vi.mock. Only the
// three remote calls are stubbed, and HOME points at an empty directory so a
// stub that stops working fails unauthenticated rather than reaching
// production.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import flattenTranslations from '../flattenTranslations.js'

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const cli = path.resolve(testsDirectory, '../index.js')
const preload = path.resolve(testsDirectory, 'downloadFixture.cjs')

const nestedCatalogue = {
  checkout: {
    button: { label: 'Pay now' },
    failed: 'Payment failed',
  },
  'checkout.legacy': 'A key with a literal dot',
  hello: 'Hello',
}

const phrasesOf = key2value =>
  Object.entries(key2value).map(([key, value]) => ({
    key,
    language: 'en',
    value,
  }))

const project = {
  _id: 'project-id',
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  name: 'multilocale-cli-test',
  paths: ['translations/%lang%.json'],
}

let directory

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'multilocale-download-'))
  fs.mkdirSync(path.join(directory, 'home'))
  fs.mkdirSync(path.join(directory, 'work'))
})

afterEach(() => {
  fs.rmSync(directory, { force: true, recursive: true })
})

const download = (argv = [], { config, paths, phrases } = {}) => {
  // The fixture lives outside the working directory: everything inside it is
  // walked by getFiles, and a stray JSON file there would be one more thing
  // the command under test could trip over.
  fs.writeFileSync(
    path.join(directory, 'fixture.json'),
    JSON.stringify({
      phrases:
        phrases ?? phrasesOf(flattenTranslations(nestedCatalogue).translations),
      project: { ...project, paths: paths ?? project.paths },
    }),
  )

  if (config) {
    fs.writeFileSync(
      path.join(directory, 'work', 'multilocale.json'),
      JSON.stringify(config),
    )
  }

  return execFileSync(
    process.execPath,
    ['--require', preload, cli, 'download', ...argv],
    {
      cwd: path.join(directory, 'work'),
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: path.join(directory, 'home'),
        MULTILOCALE_TEST_FIXTURE: path.join(directory, 'fixture.json'),
      },
      // stderr piped rather than inherited: it is where `fail` reports, so it
      // belongs in the thrown error instead of in the test runner's output.
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

const read = file => fs.readFileSync(path.join(directory, 'work', file), 'utf8')

describe('downloadCommand', () => {
  it('writes flat dot-path keys by default', () => {
    download()

    expect(read('translations/en.json')).toBe(
      `${JSON.stringify(
        {
          'checkout.button.label': 'Pay now',
          'checkout.failed': 'Payment failed',
          'checkout\\.legacy': 'A key with a literal dot',
          hello: 'Hello',
          locale: 'en',
        },
        null,
        2,
      )}\n`,
    )
  })

  it('re-nests the catalogue with --nested', () => {
    download(['--nested'])

    expect(JSON.parse(read('translations/en.json'))).toEqual({
      checkout: {
        button: { label: 'Pay now' },
        failed: 'Payment failed',
      },
      'checkout.legacy': 'A key with a literal dot',
      hello: 'Hello',
      locale: 'en',
    })
  })

  it('closes the round trip: the file re-flattens to the phrase keys', () => {
    download(['--nested'])

    const { locale, ...written } = flattenTranslations(
      JSON.parse(read('translations/en.json')),
    ).translations

    expect(written).toEqual(flattenTranslations(nestedCatalogue).translations)
    expect(locale).toBe('en')
  })

  it('reads nested from multilocale.json when no flag is passed', () => {
    download([], { config: { nested: true, projectId: 'project-id' } })

    expect(JSON.parse(read('translations/en.json')).checkout.failed).toBe(
      'Payment failed',
    )
  })

  it('lets --no-nested win over multilocale.json', () => {
    download(['--no-nested'], { config: { nested: true } })

    expect(JSON.parse(read('translations/en.json'))['checkout.failed']).toBe(
      'Payment failed',
    )
  })

  it('refuses a non-boolean nested in multilocale.json', () => {
    expect(() => download([], { config: { nested: 'true' } })).toThrow(
      /must be true or false/,
    )
  })

  it('still writes an empty dictionary for a locale with no phrases', () => {
    download(['--nested'])

    expect(JSON.parse(read('translations/fr.json'))).toEqual({})
  })

  it('ignores --nested for the flat swift format', () => {
    const output = download(
      ['--nested', '--format', 'swift', '--extension', 'strings'],
      { paths: ['%lang%.lproj/Localizable.strings'] },
    )

    expect(output).toContain('Nested: ignored')
    expect(read('en.lproj/Localizable.strings')).toContain(
      '"checkout.failed" = "Payment failed";',
    )
  })

  it('keeps a conflicting key flat instead of losing it', () => {
    const output = download(['--nested'], {
      phrases: phrasesOf({
        'checkout.failed': 'Payment failed',
        settings: 'Settings',
        'settings.title': 'Settings title',
      }),
    })

    expect(output).toContain('kept settings flat')
    expect(JSON.parse(read('translations/en.json'))).toEqual({
      checkout: { failed: 'Payment failed' },
      locale: 'en',
      settings: 'Settings',
      'settings.title': 'Settings title',
    })
  })
})
