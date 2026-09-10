import { defineConfig } from '@playwright/test'

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  retries: 1,
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
