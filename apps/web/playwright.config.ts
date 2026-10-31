import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the Vite dev server, which proxies /api to a
 * running API (pnpm --filter @moveo/api dev, or docker compose up api).
 * Set E2E_BASE_URL to test a deployed instance instead.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Both projects submit real requests against the same demo customer; run them one after the
  // other so the second run still finds selectable mortgages (one open request per mortgage).
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    locale: 'he-IL',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 720 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
