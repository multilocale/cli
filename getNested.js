/* Copyright 2013 - 2026 Waiterio LLC */
const getConfig = require('./getConfig.js')

// How `download` decides whether to write a flat dot-path dictionary
// (`{"checkout.failed": "…"}`) or the nested one it was imported from
// (`{"checkout": {"failed": "…"}}`).
//
// Resolution order, the same one `getFormat` and `getExtension` already use:
//
//   --nested / --no-nested   →   multilocale.json "nested"   →   flat
//
// Flat is the default on purpose. Every existing consumer — all seven
// examples, every project created before 1.3.x — writes flat files, and this
// must not change their output by one byte.
//
// Inference was the tempting alternative: look at the file already on disk and
// keep its shape, so nobody has to configure anything. It is rejected because
// `download`'s whole job is to *create* those files, so the shape would depend
// on whether the file happens to exist yet:
//
//   - A project with 96 locales and phrases in `en` only — the normal state
//     right after `projects create` — has 95 missing files. One command would
//     write `en` nested and 95 locales flat.
//   - A fresh clone, or CI checking out a tree whose translations are
//     generated rather than committed, has no files at all, so everything
//     would come back flat and the drift guard would fail on a tree that is
//     not actually drifting.
//   - Deleting a file would silently change the shape of its replacement.
//
// In other words inference changes shape exactly when it is least observable.
// Infer once, by hand, when you set the repository up — then write the answer
// down here, where it applies to every locale and every run identically.
const resolveNested = ({ configured, option }) => {
  if (option !== undefined) {
    return option
  }

  if (configured === undefined || configured === null) {
    return false
  }

  // A string "true" in multilocale.json would otherwise be truthy-but-ignored
  // depending on how it is read, which is the same silent-shape-change this
  // command exists to avoid. Fail loudly instead, as `getFormat` does for an
  // unknown format.
  if (typeof configured !== 'boolean') {
    throw new Error(
      `Invalid nested: ${JSON.stringify(configured)} — "nested" in multilocale.json must be true or false`,
    )
  }

  return configured
}

module.exports = async function getNested(options) {
  return resolveNested({
    configured: getConfig()?.nested,
    option: options?.nested,
  })
}

module.exports.resolveNested = resolveNested
