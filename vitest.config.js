/* Copyright 2013 - 2024 Waiterio LLC */
import createVitestConfig from '@monorepool/root/vitest.createConfig.js' // eslint-disable-line import/extensions

export default createVitestConfig({
  include: ['**/__tests__/**/*.test.{js,jsx}'],
  exclude: ['**/node_modules/**', '**/dist/**'],
  coverage: {
    thresholds: {
      statements: 89,
      branches: 80,
      functions: 92,
      lines: 89,
    },
  },
})
