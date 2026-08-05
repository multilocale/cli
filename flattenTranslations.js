/* Copyright 2013 - 2026 Waiterio LLC */

// Dot-path flattener for nested / namespaced translation dictionaries.
//
// The logic is copied — deliberately, not imported — from
// `multilocale/www/pages/JsonTranslationKeyCheckerPage/translationKeys.js`,
// which is ESM inside the marketing site and not something this CommonJS
// bundle can reach. The escaping rules are kept identical so the website's
// key checker and the CLI agree on what `{"checkout":{"failed":"…"}}` is
// called: `checkout.failed`. If you change one, change the other.
//
// Why it exists: `import` used to hand whatever `JSON.parse` returned straight
// to a phrase's `value`. Every nested dictionary — next-intl, react-i18next
// namespaces, Lingui catalogs, i.e. most real projects — was therefore stored
// as an OBJECT, and then machine-translated as one, spending credits to
// produce garbage. Flat key/value pairs are the only shape the rest of the
// pipeline (phrases, download, unused) has ever understood.

const isPlainObject = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// A literal dot in a key would be indistinguishable from the separator we just
// introduced, so it is escaped — and the escape character with it, or
// `a\` + `b` and `a` + `\b` would collide.
const escapeKeySegment = segment =>
  segment.replaceAll('\\', '\\\\').replaceAll('.', '\\.')

// Returns
//   translations — a flat { 'checkout.failed': 'string' } map, values always
//                  strings, so nothing object-shaped can reach the API
//   skipped      — [{ key, reason }] for leaves that cannot become a phrase
//   nested       — whether the dictionary had any nesting at all, so the
//                  caller can say so once instead of per key
function flattenTranslations(dictionary) {
  const translations = {}
  const skipped = []
  let nested = false

  const visit = (value, path) => {
    if (isPlainObject(value) && Object.keys(value).length > 0) {
      if (path.length > 0) {
        nested = true
      }

      Object.entries(value).forEach(([key, child]) => {
        visit(child, [...path, escapeKeySegment(key)])
      })

      return
    }

    if (path.length === 0) {
      return
    }

    const key = path.join('.')

    if (typeof value === 'string') {
      translations[key] = value
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      // Dictionaries occasionally carry a bare number or flag. A phrase value
      // is a string everywhere else in the product, so coerce rather than
      // drop the key.
      translations[key] = String(value)
    } else if (Array.isArray(value)) {
      // Arrays are a real shape in some catalogs (ordered variants). There is
      // no phrase that represents one, and silently joining them would invent
      // a translation, so they are reported and left behind.
      skipped.push({ key, reason: 'array' })
    } else if (isPlainObject(value)) {
      skipped.push({ key, reason: 'empty object' })
    } else if (value === null) {
      skipped.push({ key, reason: 'null' })
    } else {
      skipped.push({ key, reason: typeof value })
    }
  }

  visit(dictionary, [])

  return { nested, skipped, translations }
}

module.exports = flattenTranslations
module.exports.escapeKeySegment = escapeKeySegment
module.exports.flattenTranslations = flattenTranslations
module.exports.isPlainObject = isPlainObject
