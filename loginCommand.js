/* Copyright 2013 - 2024 Waiterio LLC */
const agentfirstLoginCommand = require('@monorepool/agentfirst/loginCommand.js')
const getProjectsModule = require('@multilocale/client/getProjects.js')
const {
  setApiKeyForMultilocaleClient,
} = require('@multilocale/client/apiKey.js')
const { BINARY_NAME, ENV_KEY_NAME, getAppUrl } = require('./cliConfig.js')
const session = require('./sessionStore.js')

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

module.exports = loginCommand
