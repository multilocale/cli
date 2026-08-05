/* Copyright 2013 - 2024 Waiterio LLC */
// vitest is not in this package's devDependencies on purpose: `multilocale` is
// published to npm and its manifest stays as small as the published artifact
// needs. The suite runs from the monorepo's root workspace runner
// (vitest.workspace.js globs `*/*/vitest.config.js`), same arrangement as
// ag-ui/vitest.config.js.
// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/**/*.test.{js,jsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
