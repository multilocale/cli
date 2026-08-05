/* Copyright 2013 - 2026 Waiterio LLC */
import buildProjectUpdate from '../buildProjectUpdate.js'

// `projects update` is the only way to set `paths`, and the only way to repair
// the nameless projects older signups created. It talks to an endpoint where
// `locales` is a COMPLETE REPLACEMENT LIST, so the merge below is the whole
// safety of the command: get it wrong and a one-flag invocation silently drops
// locales that thousands of phrase rows hang off.
describe('buildProjectUpdate', () => {
  const existing = {
    _id: 'p1',
    name: 'my-app',
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
  }

  it('adds locales rather than replacing them', () => {
    // The bug this prevents: `--locales de` meaning "now it ships only de".
    const changes = buildProjectUpdate({
      existing,
      options: { locales: ['de'] },
    })

    expect(changes.locales).toEqual(['en', 'es', 'fr', 'de'])
  })

  it('replaces the whole list only when explicitly asked', () => {
    const changes = buildProjectUpdate({
      existing,
      options: { setLocales: ['en', 'it'] },
    })

    expect(changes.locales).toEqual(['en', 'it'])
  })

  it('removes only what was named', () => {
    const changes = buildProjectUpdate({
      existing,
      options: { removeLocales: ['fr'] },
    })

    expect(changes.locales).toEqual(['en', 'es'])
  })

  it('refuses to remove the default locale', () => {
    // Silently re-adding it would be worse: the user believes it is gone.
    expect(() =>
      buildProjectUpdate({ existing, options: { removeLocales: ['en'] } }),
    ).toThrow(/Cannot remove the default locale en/)
  })

  it('allows removing the old default when a new one is set in the same command', () => {
    const changes = buildProjectUpdate({
      existing,
      options: { defaultLocale: 'es', removeLocales: ['en'] },
    })

    expect(changes.defaultLocale).toBe('es')
    expect(changes.locales).not.toContain('en')
    expect(changes.locales).toContain('es')
  })

  it('keeps the default locale in the list even if a replacement omits it', () => {
    const changes = buildProjectUpdate({
      existing,
      options: { setLocales: ['de', 'it'] },
    })

    expect(changes.locales[0]).toBe('en')
  })

  it('deduplicates', () => {
    const changes = buildProjectUpdate({
      existing,
      options: { locales: ['es', 'es', 'de'] },
    })

    expect(changes.locales).toEqual(['en', 'es', 'fr', 'de'])
  })

  it('sets paths, deduplicated', () => {
    const changes = buildProjectUpdate({
      existing,
      options: { paths: ['messages/%lang%.json', 'messages/%lang%.json'] },
    })

    expect(changes.paths).toEqual(['messages/%lang%.json'])
  })

  it('does not touch locales when only paths change', () => {
    // A paths-only update must not rewrite the locale list at all — sending a
    // recomputed one back is how an unrelated flag ends up mutating it.
    const changes = buildProjectUpdate({
      existing,
      options: { paths: ['a/%lang%.json'] },
    })

    expect(changes).not.toHaveProperty('locales')
    expect(changes).not.toHaveProperty('defaultLocale')
  })

  it('refuses a no-op rather than PUTting the document back unchanged', () => {
    expect(() => buildProjectUpdate({ existing, options: {} })).toThrow(
      /Nothing to update/,
    )
  })

  it('repairs a ghost project that has no locales at all', () => {
    // Exactly the shape older signups created: no name, no locales, no paths.
    const ghost = { _id: 'ghost' }
    const changes = buildProjectUpdate({
      existing: ghost,
      options: { name: 'recovered', paths: ['translations/%lang%.json'] },
    })

    expect(changes.name).toBe('recovered')
    expect(changes.paths).toEqual(['translations/%lang%.json'])
    // defaultLocale was absent, so it is now set — and that pulls a locale
    // list into being, since a project with a default locale absent from its
    // locales is the state download/localize choke on.
    expect(changes.defaultLocale).toBe('en')
    expect(changes.locales).toEqual(['en'])
  })

  it('leaves an empty-string name settable but treats undefined as untouched', () => {
    expect(
      buildProjectUpdate({
        existing,
        options: { name: '', paths: ['x/%lang%.json'] },
      }),
    ).toHaveProperty('name', '')
    expect(
      buildProjectUpdate({ existing, options: { paths: ['x/%lang%.json'] } }),
    ).not.toHaveProperty('name')
  })
})
