/* Copyright 2013 - 2024 Waiterio LLC */

import {
  setAccessTokenCallbackForMultilocaleClient,
  setAccessTokenForMultilocaleClient,
} from '@multilocale/client/accessToken.js'
import { setRefreshTokenForMultilocaleClient } from '@multilocale/client/refreshToken.js'

import localStorage from './localStorage.js'

export default function clearSession() {
  localStorage.clear()

  setAccessTokenCallbackForMultilocaleClient(null)

  setAccessTokenForMultilocaleClient(null)
  setRefreshTokenForMultilocaleClient(null)
}
