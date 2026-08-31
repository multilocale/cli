/* Copyright 2013 - 2026 Waiterio LLC */

// Works out what `projects update` should send, given the project as it is on
// the server and the flags the user passed. Pure on purpose: this is the part
// with the sharp edges, and it was previously inline in the command action
// where nothing could reach it.
//
// Two rules it exists to enforce:
//
//   1. `locales` is a COMPLETE REPLACEMENT LIST on the wire. So `--locales fr`
//      must not mean "the project now ships fr" — that would silently drop
//      every other locale, and with it the reason thousands of phrase rows
//      exist. Adding is the default; removal has to be spelled out with
//      `--remove-locales`, or `--set-locales` to replace wholesale.
//   2. The default locale is the language every translation is made FROM, so
//      it must always remain in the list. Removing it is refused rather than
//      silently re-added, because the user asking for it means one of us is
//      confused and guessing would destroy the source copy.
function unique(values) {
  return [...new Set(values)]
}

export default function buildProjectUpdate({ existing, options = {} }) {
  const changes = {}

  if (options.name !== undefined) {
    changes.name = options.name
  }

  if (options.context !== undefined) {
    changes.context = options.context
  }

  if (options.paths?.length) {
    changes.paths = unique(options.paths)
  }

  const defaultLocale = options.defaultLocale || existing.defaultLocale || 'en'

  if (defaultLocale !== existing.defaultLocale) {
    changes.defaultLocale = defaultLocale
  }

  const touchesLocales =
    options.locales?.length ||
    options.removeLocales?.length ||
    options.setLocales?.length ||
    changes.defaultLocale !== undefined

  if (touchesLocales) {
    let locales = options.setLocales?.length
      ? [...options.setLocales]
      : [...(existing.locales || [])]

    if (options.locales?.length) {
      locales = locales.concat(options.locales)
    }

    if (options.removeLocales?.length) {
      const removed = new Set(options.removeLocales)

      if (removed.has(defaultLocale)) {
        throw new Error(
          `Cannot remove the default locale ${defaultLocale}. Pass --default-locale <other> in the same command first.`,
        )
      }

      locales = locales.filter(locale => !removed.has(locale))
    }

    if (!locales.includes(defaultLocale)) {
      locales.unshift(defaultLocale)
    }

    changes.locales = unique(locales)
  }

  if (Object.keys(changes).length === 0) {
    throw new Error(
      'Nothing to update. Pass at least one of --name, --locales, --remove-locales, --set-locales, --default-locale, --paths, --context.',
    )
  }

  return changes
}
