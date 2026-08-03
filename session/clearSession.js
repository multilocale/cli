/* Copyright 2013 - 2024 Waiterio LLC */

const {
  setAccessTokenForMultilocaleClient,
  setAccessTokenCallbackForMultilocaleClient,
} = require('@multilocale/client/accessToken.js')
const {
  setRefreshTokenForMultilocaleClient,
} = require('@multilocale/client/refreshToken.js')
const localStorage = require('./localStorage.js')

module.exports = function clearSession() {
  localStorage.clear()

  setAccessTokenCallbackForMultilocaleClient(null)

  setAccessTokenForMultilocaleClient(null)
  setRefreshTokenForMultilocaleClient(null)
}
