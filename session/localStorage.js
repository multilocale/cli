/* Copyright 2013 - 2024 Waiterio LLC */
import os from 'node:os'
import path from 'node:path'

import __module1 from 'node-localstorage'

const { LocalStorage } = __module1

let localStorage

if (!localStorage) {
  const homeDir = os.homedir()
  localStorage = new LocalStorage(path.resolve(homeDir, '.multilocale'))
}

export default localStorage
