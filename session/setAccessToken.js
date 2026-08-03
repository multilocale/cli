/* Copyright 2013 - 2024 Waiterio LLC */
const localStorage = require('./localStorage.js')

module.exports = function setAccessToken(accessToken) {
  return localStorage.setItem('accessToken', accessToken)
}
