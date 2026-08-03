/* Copyright 2013 - 2024 Waiterio LLC */

// Per-product configuration for the @monorepool/agentfirst factories, in one
// place so loginCommand, logoutCommand, login and ensureAuth cannot drift.
const BINARY_NAME = 'multilocale'
const ENV_KEY_NAME = 'MULTILOCALE_API_KEY'

// Read at call time, not module load, so the MULTILOCALE_APP_URL override the
// published bundle documents (see cliGetUrl.js) also reaches the login flow.
function getAppUrl() {
  return process.env.MULTILOCALE_APP_URL || 'https://app.multilocale.com'
}

// `signup` posts straight to the product API rather than going through
// @multilocale/client: the client attaches whatever session it already has,
// and signup is the one call that must be made with no credential but the
// email and password being registered.
function getApiUrl() {
  return process.env.MULTILOCALE_API_URL || 'https://api.multilocale.com'
}

module.exports = { BINARY_NAME, ENV_KEY_NAME, getApiUrl, getAppUrl }
