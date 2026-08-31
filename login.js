/* Copyright 2013 - 2024 Waiterio LLC */
import loginWithBrowser from '@monorepool/agentfirst/loginWithBrowser.js'

import __module1 from './cliConfig.js'
import session from './sessionStore.js'

const { getAppUrl } = __module1

export default async function login() {
  await loginWithBrowser({ appUrl: getAppUrl(), session })
}
