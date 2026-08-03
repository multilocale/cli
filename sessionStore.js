/* Copyright 2013 - 2024 Waiterio LLC */
const createSessionStore = require('@monorepool/agentfirst/sessionStore.js')

// The single session store for the CLI, backed by ~/.multilocale — the same
// directory and key names (accessToken, refreshToken) the CLI has always
// written, so existing sessions keep working, plus the apiKeySecret slot used
// by `multilocale login --with-key`. The legacy session/ helpers keep their
// own node-localstorage instance for the dev scripts under scripts/; the CLI
// commands themselves must go through THIS store only, because two instances
// on the same directory do not see each other's in-process writes.
module.exports = createSessionStore({ productDirName: 'multilocale' })
