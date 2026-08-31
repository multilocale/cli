/* Copyright 2013 - 2024 Waiterio LLC */

import path from 'node:path'

import fs from 'fs-extra'

function getFiles_(dir) {
  let subdirs = fs.readdirSync(dir)
  subdirs = subdirs.filter(file => !file.startsWith('node_modules'))
  const files = subdirs.map(subdir => {
    const resource = path.resolve(dir, subdir)

    // statSync follows symlinks and throws ENOENT on a dangling one, so a
    // single broken link anywhere under the cwd used to abort the whole CLI —
    // for every product, on commands that never touch local files. macOS
    // framework bundles are full of these (Sentry -> Versions/Current/Sentry
    // in a partially removed build directory). A path we cannot stat is a
    // path we cannot read phrases out of, so skip it.
    let stats
    try {
      stats = fs.statSync(resource)
    } catch (error) {
      if (
        error.code === 'ENOENT' ||
        error.code === 'ELOOP' ||
        error.code === 'EACCES'
      ) {
        return []
      }
      throw error
    }

    return stats.isDirectory() ? getFiles(resource) : resource
  })
  return files.reduce((a, f) => a.concat(f), [])
}

function getFiles(dir) {
  dir = dir || '.'
  let files = getFiles_(dir)

  files = files
    .map(file => file.replace(path.resolve('.'), ''))
    .filter(file => !file.startsWith('/.'))

  return files
}

export default getFiles
