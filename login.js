/* Copyright 2013 - 2024 Waiterio LLC */
import loginWithBrowser from '@monorepool/agentfirst/loginWithBrowser.js'

import __module1 from './cliConfig.js'
import packageJson from './package.json' with { type: 'json' }
import session from './sessionStore.js'

const { BINARY_NAME, getApiUrl, getAppUrl } = __module1

// The terminal auto-login. Besides the browser callback it offers a one-time
// code, so a terminal on a remote desktop can be logged in from a phone.
export default async function login() {
  await loginWithBrowser({
    appUrl: getAppUrl(),
    getApiUrl,
    binaryName: BINARY_NAME,
    version: packageJson.version,
    session,
  })
}
