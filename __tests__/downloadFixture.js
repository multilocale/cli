/* Copyright 2013 - 2026 Waiterio LLC */

// ESM preload for the `download` integration test: runs the real command in a
// real directory with only the network replaced.
//
// Node imports this file before the CLI entrypoint, so it can install
// synchronous loader hooks before the command graph loads. A vi.mock cannot
// cross into this child process; without the loader hook the command could
// reach api.multilocale.com with whatever session ~/.multilocale holds. The
// test also points HOME at a scratch directory, so a broken interception fails
// unauthenticated instead.
//
// Usage: node --import <this file> ../index.js download [flags]
// with MULTILOCALE_TEST_FIXTURE=<path to a JSON { project, phrases }>.

import fs from 'node:fs'
import { registerHooks } from 'node:module'

const fixture = JSON.parse(
  fs.readFileSync(process.env.MULTILOCALE_TEST_FIXTURE, 'utf8'),
)

const stubSources = {
  '@multilocale/client/getPhrases.js': `export default async function getPhrases() { return ${JSON.stringify(fixture.phrases)} }`,
  './ensureAuth.js': 'export default async function ensureAuth() {}',
  './getProject.js': `export default async function getProject() { return ${JSON.stringify(fixture.project)} }`,
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(stubSources, specifier)) {
      return {
        format: 'module',
        shortCircuit: true,
        url: `data:text/javascript;base64,${Buffer.from(
          stubSources[specifier],
        ).toString('base64')}`,
      }
    }

    return nextResolve(specifier, context)
  },
})
