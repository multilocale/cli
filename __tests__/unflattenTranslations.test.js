/* Copyright 2013 - 2026 Waiterio LLC */

// The gap this guards: `import` flattens a nested dictionary into dot paths,
// `download` wrote those keys back out flat, and so a nested catalogue could
// never be restored — import then download did not reproduce the input and a
// nested-message runtime got keys it cannot resolve.
//
// The load-bearing assertion is the round-trip property: for any nested
// dictionary of string leaves, unflatten(flatten(x)) deep-equals x.

import flattenTranslations from '../flattenTranslations.js'
import unflattenTranslations, {
  splitKeyPath,
} from '../unflattenTranslations.js'

const flatten = dictionary => flattenTranslations(dictionary).translations
const unflatten = translations => unflattenTranslations(translations)

// `{ __proto__: … }` in an object literal, and `object.__proto__ = …`, are
// both prototype assignments — the key never becomes an own property and
// Object.entries/JSON.stringify never see it. Every fixture and generator
// below therefore writes keys the way the unflattener does, or a key named
// `__proto__` would vanish from the test rather than be tested.
const setOwn = (object, key, value) => {
  Object.defineProperty(object, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })

  return object
}

describe('splitKeyPath', () => {
  it('splits on unescaped dots', () => {
    expect(splitKeyPath('checkout.button.label')).toEqual([
      'checkout',
      'button',
      'label',
    ])
  })

  it('keeps an escaped dot inside its segment', () => {
    expect(splitKeyPath('checkout\\.failed')).toEqual(['checkout.failed'])
    expect(splitKeyPath('checkout\\.failed.label')).toEqual([
      'checkout.failed',
      'label',
    ])
  })

  it('unescapes a doubled backslash, then splits on the dot after it', () => {
    expect(splitKeyPath('back\\\\slash')).toEqual(['back\\slash'])
    expect(splitKeyPath('back\\\\.slash')).toEqual(['back\\', 'slash'])
  })

  it('leaves a backslash that escapes nothing alone', () => {
    // Only the flattener's own two escapes are consumed, so a key typed by
    // hand keeps the backslash it was given.
    expect(splitKeyPath('dir\\name')).toEqual(['dir\\name'])
    expect(splitKeyPath('trailing\\')).toEqual(['trailing\\'])
  })

  it('keeps empty segments, which are real keys', () => {
    expect(splitKeyPath('')).toEqual([''])
    expect(splitKeyPath('.')).toEqual(['', ''])
    expect(splitKeyPath('a.')).toEqual(['a', ''])
  })
})

describe('unflattenTranslations', () => {
  it('re-nests dot paths', () => {
    const { conflicts, translations } = unflatten({
      'checkout.button.label': 'Pay now',
      'checkout.failed': 'Payment failed',
      hello: 'Hello',
    })

    expect(translations).toEqual({
      checkout: {
        button: { label: 'Pay now' },
        failed: 'Payment failed',
      },
      hello: 'Hello',
    })
    expect(conflicts).toEqual([])
  })

  it('leaves a dictionary without dots exactly as it was', () => {
    const flat = { bye: 'Bye', hello: 'Hello' }

    expect(unflatten(flat).translations).toEqual(flat)
  })

  it('leaves an empty dictionary empty', () => {
    expect(unflatten({}).translations).toEqual({})
  })

  it('restores a literal dot instead of nesting on it', () => {
    const { translations } = unflatten({
      'checkout\\.failed': 'Payment failed',
    })

    expect(translations).toEqual({ 'checkout.failed': 'Payment failed' })
    expect(translations.checkout).toBeUndefined()
  })

  it('writes __proto__ as an own key rather than a prototype', () => {
    // `node.__proto__ = {}` would replace the prototype and JSON.stringify
    // would then drop the key entirely, so the written file would be missing
    // a namespace that the project still has phrases for.
    const { translations } = unflatten({ '__proto__.title': 'Title' })

    expect(JSON.stringify(translations)).toBe('{"__proto__":{"title":"Title"}}')
    expect(Object.getPrototypeOf(translations)).toBe(Object.prototype)
  })
})

describe('unflattenTranslations round trip', () => {
  const fixtures = {
    'a flat dictionary': { bye: 'Bye', hello: 'Hello' },
    'a namespaced dictionary': {
      checkout: { button: { label: 'Pay now' }, failed: 'Payment failed' },
      hello: 'Hello',
    },
    'deep nesting': { a: { b: { c: { d: { e: 'Deep' } } } } },
    'a key holding a literal dot': {
      'checkout.failed': { label: 'Nested under a dotted key' },
    },
    'a key holding a backslash': { 'back\\slash': { deep: 'Backslash' } },
    'a key holding a backslash before a dot': {
      'back\\.slash': { deep: 'Both' },
    },
    'an empty string as a key': { '': { '': 'Empty' } },
    'keys that look like array indexes': { items: { 0: 'One', 1: 'Two' } },
    'non-latin keys': { ключ: { подпись: 'Значение' }, '🔑': 'Emoji' },
    'a key named __proto__': setOwn({}, '__proto__', { title: 'Title' }),
    'a key named constructor': { constructor: { name: 'Name' } },
    'values that contain dots and backslashes': {
      paths: { windows: 'C:\\Users\\me', sentence: 'One. Two. Three.' },
    },
  }

  Object.entries(fixtures).forEach(([name, fixture]) => {
    it(`reproduces ${name}`, () => {
      const { conflicts, translations } = unflatten(flatten(fixture))

      expect(conflicts).toEqual([])
      // Compared as JSON text: that is the artifact `download` writes, and it
      // is the only comparison that notices a key that exists on the object
      // but never reaches the file.
      expect(JSON.stringify(translations)).toBe(JSON.stringify(fixture))
    })
  })

  // A deterministic generator beats hand-picked fixtures at finding escaping
  // bugs, and a fixed seed keeps a failure reproducible. String leaves only:
  // flatten deliberately drops arrays, nulls and empty objects and coerces
  // numbers to strings, so those shapes are lossy by design and cannot be part
  // of a round-trip property.
  const createRandom = seed => {
    let state = seed

    return () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    }
  }

  const segments = [
    'checkout',
    'a.b',
    'back\\slash',
    'back\\.slash',
    '',
    '.',
    '\\',
    'ключ',
    '🔑',
    // `__proto__` is deliberately absent here and covered by the two explicit
    // tests below instead: as a namespace it round-trips, and as a top-level
    // leaf it is dropped by the flat path before the unflattener ever sees it.
    'constructor',
    '0',
    'très.long',
  ]

  const createDictionary = (random, depth) => {
    const dictionary = {}
    const size = 1 + Math.floor(random() * 4)

    for (let index = 0; index < size; index += 1) {
      const segment = segments[Math.floor(random() * segments.length)]

      if (depth > 0 && random() < 0.5) {
        setOwn(dictionary, segment, createDictionary(random, depth - 1))
      } else {
        setOwn(dictionary, segment, `value ${Math.floor(random() * 1000)}`)
      }
    }

    return dictionary
  }

  // The generator sometimes produces a dictionary that does not nest at all —
  // e.g. `{".": "value"}`. The round-trip property does not hold for those, and
  // deliberately so: `flattenTranslations` escapes segments only when the
  // dictionary nests, because escaping a flat catalogue is what corrupted
  // `home.title` into `home\.title` on real projects. With nothing escaped
  // there is nothing to split back, so a flat dictionary stays flat.
  //
  // Asserting the right property for each shape rather than dropping the flat
  // ones, so both halves of the contract stay covered.
  const nests = value =>
    Object.values(value).some(
      child =>
        child !== null && typeof child === 'object' && !Array.isArray(child),
    )

  it('reproduces 200 generated dictionaries', () => {
    const random = createRandom(20260805)
    let nestedSeen = 0
    let flatSeen = 0

    for (let run = 0; run < 200; run += 1) {
      const fixture = createDictionary(random, 4)
      const flattened = flatten(fixture)
      const { conflicts, translations } = unflatten(flattened)

      if (nests(fixture)) {
        nestedSeen += 1
        // Escaped on the way out, so it splits back exactly and nothing is
        // ambiguous.
        expect(conflicts).toEqual([])
        expect(JSON.stringify(translations)).toBe(JSON.stringify(fixture))
      } else {
        flatSeen += 1
        // Flat in, keys untouched — the property that matters for real
        // catalogues, which are overwhelmingly flat and dotted.
        expect(Object.keys(flattened)).toEqual(Object.keys(fixture))
      }
    }

    // Both branches must actually be exercised, or this test silently stops
    // covering one of them if the generator drifts.
    expect(nestedSeen).toBeGreaterThan(0)
    expect(flatSeen).toBeGreaterThan(0)
  })

  it('cannot restore a top-level key named __proto__, which the flat map drops', () => {
    // Not the unflattener's doing, and asserted rather than fixed: the flat
    // path builds its maps with plain `map[key] = value`, and for the single
    // key `__proto__` that assignment is a prototype write that silently does
    // nothing — in flattenTranslations, in downloadCommand's phrase grouping,
    // and in sortObject alike. So the phrase never exists to be restored, and
    // a fix belongs to the flat path as a whole rather than here. Only the
    // exact top-level key is affected; `__proto__` as a namespace round-trips
    // (see the fixture above).
    const fixture = setOwn({}, '__proto__', 'Value')

    expect(flatten(fixture)).toEqual({})

    // Handed the key, the unflattener does keep it — this end is closed.
    expect(JSON.stringify(unflatten(fixture).translations)).toBe(
      '{"__proto__":"Value"}',
    )
  })

  it('reproduces the phrase keys, so a re-import is a no-op', () => {
    // The other direction, and the one the drift guard actually sees: the file
    // written by `download --nested` must flatten back to the same keys the
    // project holds.
    const flat = {
      'checkout.button.label': 'Pay now',
      'checkout.failed': 'Payment failed',
      'checkout\\.failed': 'Literal dot',
      'back\\\\slash.deep': 'Backslash',
      hello: 'Hello',
      locale: 'en',
    }

    expect(flatten(unflatten(flat).translations)).toEqual(flat)
  })
})

describe('unflattenTranslations conflicts', () => {
  it('keeps a key flat when other keys nest underneath it', () => {
    const { conflicts, translations } = unflatten({
      settings: 'Settings',
      'settings.title': 'Settings title',
    })

    // Nothing is lost: both keep the exact output the flat writer produces.
    expect(translations).toEqual({
      settings: 'Settings',
      'settings.title': 'Settings title',
    })
    expect(conflicts).toEqual([
      { key: 'settings', reason: 'other keys nest underneath it' },
      {
        key: 'settings.title',
        reason: 'a shorter key already holds a value on that path',
      },
    ])
  })

  it('nests everything that is not part of the conflict', () => {
    const { translations } = unflatten({
      settings: 'Settings',
      'settings.title': 'Settings title',
      'checkout.failed': 'Payment failed',
    })

    expect(translations).toEqual({
      checkout: { failed: 'Payment failed' },
      settings: 'Settings',
      'settings.title': 'Settings title',
    })
  })

  it('keeps both keys flat when two of them read as the same path', () => {
    // `a\b` and `a\\b` both unescape to the single segment `a\b`; nesting
    // either would drop the other.
    const { conflicts, translations } = unflatten({
      'a\\b': 'Lone backslash',
      'a\\\\b': 'Escaped backslash',
    })

    expect(translations).toEqual({
      'a\\b': 'Lone backslash',
      'a\\\\b': 'Escaped backslash',
    })
    // Both, not just the second one: neither key can claim the shared path.
    expect(conflicts).toEqual([
      { key: 'a\\b', reason: 'another key unflattens to the same path' },
      { key: 'a\\\\b', reason: 'another key unflattens to the same path' },
    ])
  })

  it('writes the whole dictionary flat when a conflict cannot sit beside it', () => {
    // `a` and `a.b` conflict, so both stay flat — but `a\.b` nests to the
    // top-level name `a.b`, which is the same slot the flat `a.b` needs. No
    // object holds both, so the file degrades to flat rather than half-written.
    const flat = {
      a: 'A',
      'a.b': 'A dot B',
      'a\\.b': 'Literal a dot b',
    }
    const { conflicts, translations } = unflatten(flat)

    expect(translations).toEqual(flat)
    expect(conflicts.at(-1).reason).toContain('written flat')
  })

  it('never drops a value, whatever the conflicts', () => {
    const flat = {
      a: 'A',
      'a.b': 'A dot B',
      'a.b.c': 'A dot B dot C',
      'z.y': 'Z dot Y',
    }
    const { translations } = unflatten(flat)
    const values = []
    const collect = node => {
      Object.values(node).forEach(value => {
        if (value !== null && typeof value === 'object') {
          collect(value)
        } else {
          values.push(value)
        }
      })
    }

    collect(translations)

    expect(values.sort()).toEqual(Object.values(flat).sort())
  })
})
