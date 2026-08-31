/* Copyright 2013 - 2026 Waiterio LLC */

// The inverse of ./flattenTranslations.js: turns a flat dot-path phrase set
// back into the nested dictionary it was imported from.
//
// Why it exists: `import` flattens `{"checkout":{"failed":"…"}}` into the key
// `checkout.failed` — that is what stopped nested dictionaries being stored as
// objects and machine-translated as garbage. But `download` wrote those keys
// back out flat, so the round trip was one-way: import then download did not
// reproduce the input, a drift guard comparing the two always failed, and a
// runtime that expects nested messages (react-i18next namespaces, vue-i18n,
// Lingui nested ids) got keys it cannot resolve.
//
// The escaping rules here are the exact inverse of `escapeKeySegment` in
// flattenTranslations.js. Change one and you must change the other, plus the
// round-trip properties in __tests__/unflattenTranslations.test.js.

import { isPlainObject } from './flattenTranslations.js'

// `escapeKeySegment` only ever emits `\\` and `\.`, so those are the only two
// sequences consumed here. A backslash in front of anything else is kept
// verbatim, so a hand-written key like `dir\name` — added through the app or
// the API, never through the flattener — survives instead of silently losing
// its backslash.
function splitKeyPath(key) {
  const path = []
  let segment = ''

  for (let index = 0; index < key.length; index += 1) {
    const character = key[index]
    const next = key[index + 1]

    if (character === '\\' && (next === '\\' || next === '.')) {
      segment += next
      index += 1
    } else if (character === '.') {
      path.push(segment)
      segment = ''
    } else {
      segment += character
    }
  }

  path.push(segment)

  return path
}

// Paths are compared as JSON so no separator can be forged by a segment that
// happens to contain the separator.
const canonicalize = path => JSON.stringify(path)

const readOwn = (node, segment) =>
  Object.hasOwn(node, segment) ? node[segment] : undefined

// `__proto__` is an ordinary string in a translation catalogue but a setter on
// a plain object: `node.__proto__ = {}` replaces the prototype instead of
// adding a key, and JSON.stringify then omits it entirely. defineProperty
// writes the own enumerable property JSON expects, for every key alike.
const writeOwn = (node, segment, value) => {
  Object.defineProperty(node, segment, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

// Returns
//   translations — the dictionary to write: nested wherever the key set allows
//                  it, and byte-for-byte the flat input wherever it does not
//   conflicts    — [{ key, reason }] for every key that could not be nested,
//                  so the caller can say why a file is not the shape asked for
function unflattenTranslations(translations) {
  const conflicts = []
  const entries = Object.entries(translations).map(([key, value]) => ({
    key,
    path: splitKeyPath(key),
    value,
  }))

  // Occupancy of the tree the keys describe, computed before anything is
  // written. `leaves` holds every key's own position; `branches` every
  // position some other key nests under. A key in both — `settings` next to
  // `settings.title` — would have to be a string and an object at once.
  const branches = new Set()
  const duplicated = new Set()
  const leaves = new Set()

  entries.forEach(({ path }) => {
    const canonical = canonicalize(path)

    if (leaves.has(canonical)) {
      duplicated.add(canonical)
    }

    leaves.add(canonical)

    for (let depth = 1; depth < path.length; depth += 1) {
      branches.add(canonicalize(path.slice(0, depth)))
    }
  })

  const conflictReason = path => {
    const canonical = canonicalize(path)

    // Non-canonical escaping is the only way two distinct keys can land on the
    // same path (`a\b` and `a\\b` both read as the single segment `a\b`), and
    // nesting either one would drop the other.
    if (duplicated.has(canonical)) {
      return 'another key unflattens to the same path'
    }

    if (branches.has(canonical)) {
      return 'other keys nest underneath it'
    }

    for (let depth = 1; depth < path.length; depth += 1) {
      if (leaves.has(canonicalize(path.slice(0, depth)))) {
        return 'a shorter key already holds a value on that path'
      }
    }

    return undefined
  }

  const blocked = []
  const nestable = []

  entries.forEach(entry => {
    const reason = conflictReason(entry.path)

    if (reason) {
      conflicts.push({ key: entry.key, reason })
      blocked.push(entry)
    } else {
      nestable.push(entry)
    }
  })

  // A blocked key keeps exactly what the flat writer would have produced — its
  // own key, at the top level — so a conflict costs nesting, never a value.
  // The single shape that cannot hold both is a blocked key whose literal text
  // is also a top-level name the nested keys need (`a`, `a.b` and `a\.b` in
  // one dictionary). Rather than half-write that file, the whole dictionary
  // degrades to flat, which is always representable and always lossless.
  const nestedNames = new Set(nestable.map(({ path }) => path[0]))
  const colliding = blocked.filter(({ key }) => nestedNames.has(key))

  if (colliding.length > 0) {
    colliding.forEach(({ key }) => {
      conflicts.push({
        key,
        reason:
          'its flat key is also a nested namespace, so the whole dictionary was written flat',
      })
    })

    return { conflicts, translations: { ...translations } }
  }

  const result = {}

  blocked.forEach(({ key, value }) => {
    writeOwn(result, key, value)
  })

  nestable.forEach(({ path, value }) => {
    let node = result

    for (let depth = 0; depth < path.length - 1; depth += 1) {
      const segment = path[depth]

      if (!isPlainObject(readOwn(node, segment))) {
        writeOwn(node, segment, {})
      }

      node = readOwn(node, segment)
    }

    writeOwn(node, path[path.length - 1], value)
  })

  return { conflicts, translations: result }
}

export default unflattenTranslations
export { splitKeyPath }
