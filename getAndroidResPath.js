/* Copyright 2013 - 2024 Waiterio LLC */
import path from 'node:path'

import getAndroidManifest from './getAndroidManifest.js'

export default function getAndroidResPath() {
  const androidManifestPath = getAndroidManifest()
  // console.log({ androidManifestPath })
  let resPath = path.resolve(
    androidManifestPath.replace('AndroidManifest.xml', 'res'),
  )

  if (resPath.startsWith('/')) {
    resPath = resPath.slice(1)
  }

  return resPath
}
