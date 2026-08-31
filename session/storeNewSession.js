/* Copyright 2013 - 2024 Waiterio LLC */
import {
  setAccessTokenCallbackForMultilocaleClient,
  setAccessTokenForMultilocaleClient,
} from '@multilocale/client/accessToken.js'
import { setRefreshTokenForMultilocaleClient } from '@multilocale/client/refreshToken.js'

import setAccessToken from './setAccessToken.js'
import setRefreshToken from './setRefreshToken.js'

export default async function storeNewSession({ accessToken, refreshToken }) {
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
