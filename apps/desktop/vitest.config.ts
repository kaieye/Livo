import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace packages to source so tests run without a build step.
      '@livo/utils': resolve(__dirname, '../../packages/utils/src/index.ts'),
      '@livo/models': resolve(__dirname, '../../packages/models/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
