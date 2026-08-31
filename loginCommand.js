/* Copyright 2013 - 2024 Waiterio LLC */
import agentfirstLoginCommand from '@monorepool/agentfirst/loginCommand.js'
import { setApiKeyForMultilocaleClient } from '@multilocale/client/apiKey.js'
import getProjectsModule from '@multilocale/client/getProjects.js'

import __module1 from './cliConfig.js'
import session from './sessionStore.js'

const { BINARY_NAME, ENV_KEY_NAME, getAppUrl } = __module1

const getProjects = getProjectsModule.default || getProjectsModule

// One cheap authenticated GET so a bad key fails at login instead of at the
// first real command. New keys default to read-only scopes, and
// `GET /api/projects` is within them.
async function verify() {
  setApiKeyForMultilocaleClient(session.getApiKeySecret())

  try {
    const projects = await getProjects()

    return `Logged in with an API key — ${projects?.length ?? 0} project(s) accessible.`
  } finally {
    setApiKeyForMultilocaleClient(null)
  }
}

function loginCommand() {
  return agentfirstLoginCommand({
    binaryName: BINARY_NAME,
    appUrl: getAppUrl(),
    session,
    verify,
    envKeyName: ENV_KEY_NAME,
  })
}

export default loginCommand
