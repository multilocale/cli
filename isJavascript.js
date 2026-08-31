/* Copyright 2013 - 2024 Waiterio LLC */

import getFiles from './getFiles.js'

export default function getAndroidManifest() {
  let files = getFiles()
  files = files.filter(file => file.endsWith('package.json'))

  return files.length > 0
}
