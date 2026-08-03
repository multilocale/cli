/* Copyright 2013 - 2024 Waiterio LLC */
const http = require('http')
const url = require('url')
const openBrowser = require('./openBrowser.js')
const storeNewSession = require('./session/storeNewSession.js')

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

module.exports = function loginWithBrowser() {
  return new Promise((resolve, reject) => {
    const sockets = new Set()

    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true)

      if (parsedUrl.pathname !== '/callback') {
        res.writeHead(404)
        res.end('Not found')

        return
      }

      const { accessToken, refreshToken, error } = parsedUrl.query

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
        res.end(
          `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui,sans-serif"><div style="text-align:center"><h1>Login failed</h1><p>${error}</p></div></body></html>`,
        )
        server.close()
        sockets.forEach(socket => socket.destroy())
        reject(new Error(error))

        return
      }

      if (!accessToken || !refreshToken) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
        res.end(
          '<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui,sans-serif"><div style="text-align:center"><h1>Login failed</h1><p>Missing tokens in callback</p></div></body></html>',
        )
        server.close()
        sockets.forEach(socket => socket.destroy())
        reject(new Error('Missing tokens in callback'))

        return
      }

      storeNewSession({ accessToken, refreshToken })

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
      res.end(
        '<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui,sans-serif"><div style="text-align:center"><h1>Login successful</h1><p>You can close this window and return to the terminal.</p></div></body></html>',
      )
      server.close()
      sockets.forEach(socket => socket.destroy())
      resolve()
    })

    server.on('connection', socket => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })

    server.listen(0, async () => {
      const port = server.address().port
      const loginUrl = `https://app.multilocale.com/cli?callback=http://localhost:${port}/callback`

      console.log('Opening browser to log in...')
      console.log(`If the browser doesn't open, visit: ${loginUrl}`)

      try {
        await openBrowser(loginUrl)
      } catch {
        // Browser failed to open, user can use the printed URL
      }
    })

    const timeout = setTimeout(() => {
      server.close()
      reject(new Error('Login timed out. Please try again.'))
    }, LOGIN_TIMEOUT_MS)

    server.on('close', () => {
      clearTimeout(timeout)
    })
  })
}
