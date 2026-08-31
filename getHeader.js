/* Copyright 2013 - 2024 Waiterio LLC */
import getConfig from './getConfig.js'

export default async function getHeader(options) {
  let header = options?.header
  const config = getConfig()

  if (!header) {
    header = config?.header
  }

  if (!header) {
    header = ''
  }

  return header
}
