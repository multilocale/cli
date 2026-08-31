#!/usr/bin/env node
/* Copyright 2013 - 2024 Waiterio LLC */

// pnpm creates bin symlinks during the linking phase, before any build script
// can run, so a bin pointing straight at the gitignored dist/index.js cannot be
// linked in a fresh checkout. Every new git worktree logged
//   [WARN] Failed to create bin ... ENOENT ... multilocale/cli/dist/index.js
// and left `multilocale` unresolvable until the next install, because pnpm never
// revisits bins after a later build produces dist.
//
// This launcher is committed, so the symlink always resolves. It runs the
// bundle when one exists — published tarballs ship dist/ and nothing else — and
// otherwise falls back to the source entrypoint that a monorepo checkout has.
//
// process.argv[1] is repointed at the resolved target first: every CLI here
// gates `program.parse` behind a direct-run check that compares import.meta.url
// with realpathSync(process.argv[1]), so leaving argv[1] as this launcher would
// import the program and silently never parse it.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const bundle = new URL('../dist/index.js', import.meta.url)
const target = existsSync(fileURLToPath(bundle))
  ? bundle
  : new URL('../index.js', import.meta.url)

process.argv[1] = fileURLToPath(target)

await import(target.href)
