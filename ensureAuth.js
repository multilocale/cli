/* Copyright 2013 - 2024 Waiterio LLC */

import { loginInstructions } from '@monorepool/agentfirst/loginHint.js'
import resolveCredential from '@monorepool/agentfirst/resolveCredential.js'
import {
  setAccessTokenCallbackForMultilocaleClient,
  setAccessTokenForMultilocaleClient,
} from '@multilocale/client/accessToken.js'
import { setApiKeyForMultilocaleClient } from '@multilocale/client/apiKey.js'
import {
  isRefreshTokenExpired,
  setRefreshTokenForMultilocaleClient,
} from '@multilocale/client/refreshToken.js'

import __module1 from './cliConfig.js'
import login from './login.js'
import session from './sessionStore.js'

const { BINARY_NAME, ENV_KEY_NAME, getAppUrl } = __module1

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

function rehydrateClientSession() {
  setAccessTokenForMultilocaleClient(session.getAccessToken())
  setRefreshTokenForMultilocaleClient(session.getRefreshToken())
  setAccessTokenCallbackForMultilocaleClient(accessToken =>
    session.setAccessToken(accessToken),
  )
}

// Resolves how this invocation authenticates and feeds the bundled
// @multilocale/client accordingly. Precedence is the fleet rule from
// agentfirst's resolveCredential.js — stored browser session > stored API key
// secret > MULTILOCALE_API_KEY environment variable — so an exported key can
// never silently hijack an interactive session (the wapiworld rationale). The
// client's api key is therefore set only when there is no session.
//
// With nothing stored: on a TTY the historical auto browser login stays;
// headless it throws immediately with instructions naming both ways in,
// instead of opening a browser and blocking for five minutes.
export default async function ensureAuth() {
  let resolved = resolveCredential({ session, envKeyName: ENV_KEY_NAME })

  if (resolved.mode === 'token') {
    rehydrateClientSession()

    if (!isRefreshTokenExpired()) {
      return resolved
    }

    // The browser session is dead — no request can refresh it. Drop only its
    // tokens: a stored API key secret alongside it is still valid, and the
    // resolve below falls through to it (or to the environment key).
    session.remove('accessToken')
    session.remove('refreshToken')
    setAccessTokenForMultilocaleClient(null)
    setRefreshTokenForMultilocaleClient(null)
    setAccessTokenCallbackForMultilocaleClient(null)

    resolved = resolveCredential({ session, envKeyName: ENV_KEY_NAME })
  }

  if (resolved.mode === 'key') {
    setApiKeyForMultilocaleClient(resolved.credential)

    return resolved
  }

  if (!isInteractive()) {
    throw new Error(
      loginInstructions({
        binaryName: BINARY_NAME,
        envKeyName: ENV_KEY_NAME,
        appUrl: getAppUrl(),
        device: true,
        headline: 'Not logged in, and no terminal to log in from.',
      }),
    )
  }

  console.error('Please login first')
  await login()
  rehydrateClientSession()

  return resolveCredential({ session, envKeyName: ENV_KEY_NAME })
}
