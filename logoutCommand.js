/* Copyright 2013 - 2024 Waiterio LLC */
const agentfirstLogoutCommand = require('@monorepool/agentfirst/logoutCommand.js')
const { BINARY_NAME, ENV_KEY_NAME } = require('./cliConfig.js')
const session = require('./sessionStore.js')

function logoutCommand() {
  return agentfirstLogoutCommand({
    binaryName: BINARY_NAME,
    session,
    envKeyName: ENV_KEY_NAME,
  })
}

module.exports = logoutCommand
