/* Copyright 2013 - 2024 Waiterio LLC */
import {
  setAccessTokenCallbackForMultilocaleClient,
  setAccessTokenForMultilocaleClient,
} from '@multilocale/client/accessToken.js'
import { setRefreshTokenForMultilocaleClient } from '@multilocale/client/refreshToken.js'

import getAccessToken from './getAccessToken.js'
import getRefreshToken from './getRefreshToken.js'
import setAccessToken from './setAccessToken.js'

export default async function rehydrateSession() {
  const accessToken = getAccessToken()
  const refreshToken = getRefreshToken()

  setAccessTokenForMultilocaleClient(accessToken)
  setRefreshTokenForMultilocaleClient(refreshToken)
  setAccessTokenCallbackForMultilocaleClient(setAccessToken)
}
