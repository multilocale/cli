/* Copyright 2013 - 2024 Waiterio LLC */

const getFiles = require('./getFiles.js')

module.exports = function getAndroidManifest() {
  let files = getFiles()
  files = files.filter(file => file.endsWith('gatsby-config.js'))

  return files.length > 0
}
