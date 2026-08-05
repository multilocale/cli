/* Copyright 2013 - 2026 Waiterio LLC */

// Preload for the `download` integration test: runs the real command in a real
// directory with only the network replaced.
//
// It patches `Module._load` rather than using vi.mock because the CLI is
// CommonJS — vitest's mock registry is keyed on the ESM graph and never sees a
// `require()`, so a vi.mock of `./getProject.js` silently does nothing and the
// command reaches the real api.multilocale.com with whatever session
// ~/.multilocale holds. The test also runs with HOME pointed at a scratch
// directory, so if this interception ever stops working the command fails
// unauthenticated instead of quietly talking to production.
//
// Usage: node --require <this file> ../index.js download [flags]
// with MULTILOCALE_TEST_FIXTURE=<path to a JSON { project, phrases }>.

const Module = require('node:module')
const fs = require('node:fs')

const fixture = JSON.parse(
  fs.readFileSync(process.env.MULTILOCALE_TEST_FIXTURE, 'utf8'),
)

const stubs = {
  '@multilocale/client/getPhrases.js': async () => fixture.phrases,
  './ensureAuth.js': async () => {},
  './getProject.js': async () => fixture.project,
}

const load = Module._load

Module._load = function _load(request, parent, isMain) {
  if (Object.hasOwn(stubs, request)) {
    return stubs[request]
  }

  return load.call(this, request, parent, isMain)
}
