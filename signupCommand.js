/* Copyright 2013 - 2024 Waiterio LLC */
const agentfirstSignupCommand = require('@monorepool/agentfirst/signupCommand.js')
const { BINARY_NAME, getApiUrl, getAppUrl } = require('./cliConfig.js')
const session = require('./sessionStore.js')

// The step that used to need a person. `login` assumes the account exists;
// an agent pointed at multilocale.com for the first time has no account to
// log into, and the browser flow it fell into blocked for up to five minutes
// with nobody there to complete it.
//
//   multilocale signup --email founder@example.com --json
//
// stores the session in the same ~/.multilocale the browser flow writes, so
// every other command works immediately afterwards.
function signupCommand() {
  return agentfirstSignupCommand({
    binaryName: BINARY_NAME,
    getApiUrl,
    appUrl: getAppUrl(),
    session,
  })
}

module.exports = signupCommand
