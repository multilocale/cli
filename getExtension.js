/* Copyright 2013 - 2024 Waiterio LLC */
const getConfig = require('./getConfig.js')
const getFormat = require('./getFormat.js')

module.exports = async function getExtension(options) {
  let extension = options?.extension
  let format = await getFormat(options)

  const config = getConfig()

  if (!extension) {
    extension = config?.extension
  }

  if (!extension) {
    switch (format) {
      case 'json':
        extension = 'json'
        break
      case 'cjs':
      case 'esm':
      case 'js':
        extension = 'js'
        break
      case 'swift':
        extension = 'strings'
        break
      case 'xml':
        extension = 'xml'
        break
      default:
        extension = 'json'
        break
    }
  }

  return extension
}
