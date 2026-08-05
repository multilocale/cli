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

  it('escapes dots and backslashes inside key segments', () => {
    const { translations } = flattenTranslations({
      'checkout.failed': { label: 'Nested under a dotted key' },
      'back\\slash': 'Backslash',
    })

    expect(translations).toEqual({
      'checkout\\.failed.label': 'Nested under a dotted key',
      'back\\\\slash': 'Backslash',
    })
  })

  it('does not collide a dotted flat key with a real nesting', () => {
    const dotted = flattenTranslations({ 'checkout.failed': 'A' })
    const structured = flattenTranslations({ checkout: { failed: 'B' } })

    expect(Object.keys(dotted.translations)).not.toEqual(
      Object.keys(structured.translations),
    )
    expect(dotted.translations['checkout\\.failed']).toBe('A')
    expect(structured.translations['checkout.failed']).toBe('B')
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
