/* Copyright 2013 - 2024 Waiterio LLC */
const { exec } = require('child_process')

module.exports = function openBrowser(url) {
  const platform = process.platform
  let command

  if (platform === 'darwin') {
    command = `open "${url}"`
  } else if (platform === 'win32') {
    command = `start "" "${url}"`
  } else {
    command = `xdg-open "${url}"`
  }

  return new Promise((resolve, reject) => {
    exec(command, error => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
