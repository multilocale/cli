/* Copyright 2013 - 2024 Waiterio LLC */
const { isRefreshTokenExpired } = require('@multilocale/client/refreshToken.js')
const clearSession = require('./clearSession.js')

module.exports = function isLoggedInSession() {
  let isLoggedIn = false

  if (!isRefreshTokenExpired()) {
    isLoggedIn = true
  }

  if (!isLoggedIn) {
    clearSession()
  }

  return isLoggedIn
}
