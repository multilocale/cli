/* Copyright 2013 - 2024 Waiterio LLC */
const localStorage = require('./localStorage.js')

module.exports = function getAccessToken() {
  return localStorage.getItem('accessToken')
}
