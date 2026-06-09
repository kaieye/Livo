import { defineConfig, devices } from '@playwright/test'

const WEB_PORT = Number(process.env['LIVO_E2E_WEB_PORT'] ?? 5433)
const WEB_BASE_URL = `http://127.0.0.1:${WEB_PORT}`
const DISABLE_WEB_SERVER = process.env['LIVO_E2E_DISABLE_WEB_SERVER'] === '1'

export default defineConfig({
  testDir: '../e2e/tests',
  outputDir: '../test-results/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  webServer: DISABLE_WEB_SERVER
    ? undefined
    : {
        command: `pnpm dev:web -- --host 127.0.0.1 --port ${WEB_PORT}`,
        url: WEB_BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env['CI'],
      },
  use: {
    baseURL: WEB_BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'web',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /web\.spec\.ts/,
    },
    {
      name: 'electron',
      testMatch: /electron\.spec\.ts/,
    },
  ],
})
