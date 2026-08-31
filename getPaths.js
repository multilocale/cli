/* Copyright 2013 - 2024 Waiterio LLC */
import getConfig from './getConfig.js'

// Resolves where a project's translation files live, in the order the CLI has
// always intended: the project's own `paths` (set server-side) wins over the
// local multilocale.json, which wins over a format-appropriate default.
//
// This exists because `download` and `localize` had the fallback and `import`
// and `unused` did not — they destructured `const { paths } = project` and
// called `paths.forEach` directly. `paths` is undefined on every project the
// CLI itself can create (neither `signup`'s bootstrap project nor
// `projects create` sets it, and there is no `projects update` to add it), so
// two of the five file commands threw
//
//   TypeError: Cannot read properties of undefined (reading 'forEach')
//
// out of the box. That made `import` — the entry point for "I already have
// translation files" — unusable on a fresh account, which is the single most
// common way to start.
//
// Defaulting rather than throwing is the right call here: a wrong-but-sane
// default makes `import`/`unused` report "No matching files for path …", which
// tells the user exactly what to fix, where a TypeError tells them nothing.
export default function getPaths({ project, format, extension = 'json' }) {
  const config = getConfig()
  const paths = project?.paths?.length ? project.paths : config?.paths

  if (paths?.length) {
    return paths
  }

  if (format === 'swift') {
    return [`%lang%.lproj/Localizable.${extension}`]
  }

  return [`translations/%lang%.${extension}`]
}
