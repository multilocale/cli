/* Copyright 2013 - 2024 Waiterio LLC */
const getAndroidManifest = require('./getAndroidManifest.js')

module.exports = function isAndroid() {
  return !!getAndroidManifest()
}
