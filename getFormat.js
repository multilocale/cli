/* Copyright 2013 - 2024 Waiterio LLC */
const getConfig = require('./getConfig.js')

const formats = [
  'cjs',
  'esm',
  'json',
  'js',
  'swift',
  // 'xml',
]

module.exports = async function getFormat(options) {
  let format = options?.format
  const config = getConfig()

  if (!format) {
    format = config?.format
  }

  if (!format) {
    format = 'json'
  }

  if (!formats.includes(format)) {
    throw new Error(`Invalid format: ${format}`)
  }

  return format
}
