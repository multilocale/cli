/* Copyright 2013 - 2024 Waiterio LLC */
import { isRefreshTokenExpired } from '@multilocale/client/refreshToken.js'

import clearSession from './clearSession.js'

export default function isLoggedInSession() {
  let isLoggedIn = false

  if (!isRefreshTokenExpired()) {
    isLoggedIn = true
  }

  if (!isLoggedIn) {
    clearSession()
  }

  return isLoggedIn
}
