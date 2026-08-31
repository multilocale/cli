/* Copyright 2013 - 2024 Waiterio LLC */

import path from 'node:path'

import fs from 'fs-extra'

export default function setConfig(config) {
  const configPath = path.resolve('.', 'multilocale.json')

  let string = ''

  if (config) {
    string = JSON.stringify(config)
  }

  config = fs.writeFileSync(configPath, string)

  return config
}
