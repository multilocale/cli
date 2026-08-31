/* Copyright 2013 - 2026 Waiterio LLC */

// Dot-path flattener for nested / namespaced translation dictionaries.
//
// The logic is copied — deliberately, not imported — from
// `multilocale/www/pages/JsonTranslationKeyCheckerPage/translationKeys.js`,
// which belongs to the marketing-site package rather than this CLI bundle.
// The escaping rules are kept identical so the website's
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
// Does any value nest? Decided for the WHOLE dictionary before a single key is
// built, because whether a key needs escaping is a property of the file, not of
// the key — see the comment in flattenTranslations.
function hasNesting(value, depth = 0) {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    return false
  }

  if (depth > 0) {
    return true
  }

  return Object.values(value).some(child => hasNesting(child, depth + 1))
}

function flattenTranslations(dictionary) {
  const translations = {}
  const skipped = []

  // Escape segments only when this dictionary actually nests.
  //
  // 1.3.0 escaped unconditionally and corrupted the ordinary case: an
  // already-flat catalogue keyed `home.title` — how most i18n catalogues are
  // written — was uploaded as `home\.title`, with `nested: false` so nothing
  // warned. Three example projects hit it; two needed direct API repairs
  // because no CLI command renames a phrase, and one still carries a
  // post-script that unescapes on the way back out.
  //
  // The escape exists so `{a: {b: 1}}` and `{"a.b": 1}` stay distinct once both
  // are dot paths, and so `unflattenTranslations` splits at the right dots. Both
  // needs only arise once something nests. In a flat file the dots are part of
  // the key, there is nothing to split, and rewriting them is pure damage.
  const nested = hasNesting(dictionary)

  const visit = (value, path) => {
    if (isPlainObject(value) && Object.keys(value).length > 0) {
      Object.entries(value).forEach(([key, child]) => {
        visit(child, [...path, key])
      })

      return
    }

    if (path.length === 0) {
      return
    }

    const key = nested ? path.map(escapeKeySegment).join('.') : path.join('.')

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

export default flattenTranslations
export { escapeKeySegment, isPlainObject }
