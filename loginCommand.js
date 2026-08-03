/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const login = require('./login.js')

function loginCommand() {
  const command = new commander.Command('login')
  command.description('log in to your multilocale.com account via browser')
  command.action(async () => {
    try {
      console.log('login')

      await login()

      console.log('logged in')
    } catch (error) {
      console.error('error', error.message)
      process.exitCode = 1
    }
  })

  return command
}

module.exports = loginCommand
