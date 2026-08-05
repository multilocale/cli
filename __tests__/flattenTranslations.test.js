/* Copyright 2013 - 2026 Waiterio LLC */

// The regression this guards: `import` sent whatever JSON.parse produced into
// a phrase's `value`, so a nested dictionary became a phrase whose value was
// an object — and the machine translator was then paid to translate it.
// Every assertion below ultimately checks the same invariant: no value that
// leaves the flattener is anything but a string.

import flattenTranslations from '../flattenTranslations.js'

describe('flattenTranslations', () => {
  it('leaves a flat dictionary alone', () => {
    const { nested, skipped, translations } = flattenTranslations({
      hello: 'Hello',
      bye: 'Bye',
    })

    expect(translations).toEqual({ hello: 'Hello', bye: 'Bye' })
    expect(nested).toBe(false)
    expect(skipped).toEqual([])
  })

  it('flattens namespaced dictionaries into dot paths', () => {
    const { nested, translations } = flattenTranslations({
      checkout: {
        failed: 'Payment failed',
        button: { label: 'Pay now' },
      },
      hello: 'Hello',
    })

    expect(translations).toEqual({
      'checkout.failed': 'Payment failed',
      'checkout.button.label': 'Pay now',
      hello: 'Hello',
    })
    expect(nested).toBe(true)
  })

  it('never yields an object or an array as a value', () => {
    const { translations } = flattenTranslations({
      checkout: { failed: 'Payment failed' },
      variants: ['one', 'two'],
      empty: {},
      missing: null,
    })

    Object.values(translations).forEach(value => {
      expect(typeof value).toBe('string')
    })
  })

  // THE key property, and the one 1.3.0 got wrong. Most catalogues are already
  // flat and keyed with dots — `home.title`, `footer.cta`. Those keys are not
  // paths this function assembled; they are the key. Uploading them as
  // `home\.title` corrupted three example projects, two of which needed direct
  // API repairs because no CLI command can rename a phrase.
  it('passes an already-flat dotted key through untouched', () => {
    const { translations, nested } = flattenTranslations({
      'home.title': 'Welcome',
      'footer.built-with': 'Built with',
      'back\\slash': 'Backslash',
    })

    expect(Object.keys(translations)).toEqual([
      'home.title',
      'footer.built-with',
      'back\\slash',
    ])
    expect(nested).toBe(false)
  })

  // Escaping still applies where the key really is assembled from segments,
  // so `unflattenTranslations` can split it back at the right dots.
  it('escapes dots and backslashes inside assembled segments', () => {
    const { translations } = flattenTranslations({
      'checkout.failed': { label: 'Nested under a dotted key' },
    })

    expect(translations).toEqual({
      'checkout\\.failed.label': 'Nested under a dotted key',
    })
  })

  // Accepted collapse, documented rather than defended against: a flat
  // `checkout.failed` and a nested `{checkout: {failed}}` now produce the same
  // key. They denote the same path in every i18n runtime we target, and the
  // only way to keep them distinct was to mangle the flat one — which is the
  // bug above. `download --nested` decides which shape is written back out.
  it('treats a dotted flat key and the equivalent nesting as the same key', () => {
    const dotted = flattenTranslations({ 'checkout.failed': 'A' })
    const structured = flattenTranslations({ checkout: { failed: 'B' } })

    expect(Object.keys(dotted.translations)).toEqual(['checkout.failed'])
    expect(Object.keys(structured.translations)).toEqual(['checkout.failed'])
  })

  it('coerces numbers and booleans, which JSON dictionaries do carry', () => {
    const { skipped, translations } = flattenTranslations({
      count: 3,
      enabled: true,
    })

    expect(translations).toEqual({ count: '3', enabled: 'true' })
    expect(skipped).toEqual([])
  })

  it('reports arrays, nulls and empty objects instead of importing them', () => {
    const { skipped, translations } = flattenTranslations({
      variants: ['one', 'two'],
      missing: null,
      empty: {},
      kept: 'Kept',
    })

    expect(translations).toEqual({ kept: 'Kept' })
    expect(skipped).toEqual([
      { key: 'variants', reason: 'array' },
      { key: 'missing', reason: 'null' },
      { key: 'empty', reason: 'empty object' },
    ])
  })

  it('treats an empty object at the root as an empty dictionary', () => {
    const { nested, skipped, translations } = flattenTranslations({})

    expect(translations).toEqual({})
    expect(skipped).toEqual([])
    expect(nested).toBe(false)
  })

  it('does not report nesting for a dictionary of empty objects', () => {
    const { nested } = flattenTranslations({ empty: {} })

    expect(nested).toBe(false)
  })
})
