/* Copyright 2013 - 2024 Waiterio LLC */
const loginWithBrowser = require('@monorepool/agentfirst/loginWithBrowser.js')
const { getAppUrl } = require('./cliConfig.js')
const session = require('./sessionStore.js')

module.exports = async function login() {
  await loginWithBrowser({ appUrl: getAppUrl(), session })
}
