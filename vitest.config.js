/* Copyright 2013 - 2024 Waiterio LLC */
import createVitestConfig from '@monorepool/root/vitest.createConfig.js' // eslint-disable-line import/extensions

export default createVitestConfig({
  include: ['**/__tests__/**/*.test.{js,jsx}'],
  exclude: ['**/node_modules/**', '**/dist/**'],
  // downloadFixture is an ESM preload used only by a child-process test.
  coverageExclude: ['__tests__/downloadFixture.js'],
  coverage: {
    thresholds: {
      statements: 92,
      branches: 90,
      functions: 95,
      lines: 91,
    },
  },
})
