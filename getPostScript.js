/* Copyright 2013 - 2024 Waiterio LLC */
import getConfig from './getConfig.js'

export default async function getPostScript(options) {
  let postScript = options?.postScript || options?.['post-script']
  const config = getConfig()

  if (!postScript) {
    postScript = config?.postScript || config?.['post-script']
  }

  if (!postScript) {
    postScript = ''
  }

  return postScript
}
