/* Copyright 2013 - 2024 Waiterio LLC */
import agentfirstLogoutCommand from '@monorepool/agentfirst/logoutCommand.js'

import __module1 from './cliConfig.js'
import session from './sessionStore.js'

const { BINARY_NAME, ENV_KEY_NAME } = __module1

function logoutCommand() {
  return agentfirstLogoutCommand({
    binaryName: BINARY_NAME,
    session,
    envKeyName: ENV_KEY_NAME,
  })
}

export default logoutCommand
