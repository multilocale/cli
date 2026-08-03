/* Copyright 2013 - 2024 Waiterio LLC */
const {
  setAccessTokenForMultilocaleClient,
  setAccessTokenCallbackForMultilocaleClient,
} = require('@multilocale/client/accessToken.js')
const {
  setRefreshTokenForMultilocaleClient,
} = require('@multilocale/client/refreshToken.js')
const setAccessToken = require('./setAccessToken.js')
const setRefreshToken = require('./setRefreshToken.js')

module.exports = async function storeNewSession({ accessToken, refreshToken }) {
  try {
    setAccessToken(accessToken)
    setRefreshToken(refreshToken)

    setAccessTokenForMultilocaleClient(accessToken, setAccessToken)
    setRefreshTokenForMultilocaleClient(refreshToken, setRefreshToken)
    setAccessTokenCallbackForMultilocaleClient(setAccessToken)

    return true
  } catch (error) {
    console.error('error', error)
    throw error
  }
}
