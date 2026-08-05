/* Copyright 2013 - 2026 Waiterio LLC */

// `nested` decides the shape of every file `download` writes, so the order it
// is resolved in is the contract: the flag beats multilocale.json, and the
// default stays flat because every existing consumer writes flat files.

import { resolveNested } from '../getNested.js'

describe('resolveNested', () => {
  it('defaults to flat', () => {
    expect(resolveNested({})).toBe(false)
    expect(resolveNested({ configured: undefined, option: undefined })).toBe(
      false,
    )
  })

  it('reads multilocale.json when no flag is passed', () => {
    expect(resolveNested({ configured: true })).toBe(true)
    expect(resolveNested({ configured: false })).toBe(false)
  })

  it('lets --nested and --no-nested override multilocale.json', () => {
    expect(resolveNested({ configured: false, option: true })).toBe(true)
    expect(resolveNested({ configured: true, option: false })).toBe(false)
  })

  it('refuses a non-boolean nested in multilocale.json', () => {
    // A string "true" is the shape a hand-edited config lands in, and reading
    // it as truthy or falsy silently changes every file on disk.
    expect(() => resolveNested({ configured: 'true' })).toThrow(
      /must be true or false/,
    )
    expect(() => resolveNested({ configured: 1 })).toThrow(
      /must be true or false/,
    )
  })

  it('treats a null in multilocale.json as unset', () => {
    expect(resolveNested({ configured: null })).toBe(false)
  })
})
