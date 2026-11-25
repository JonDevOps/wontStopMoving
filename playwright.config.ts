import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke test: clicks through the main public pages of a production
 * build. CI runs it inside the Firebase emulators (npm run test:smoke).
 */
const PORT = 9020;
export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/terms`,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: { GCLOUD_PROJECT: 'demo-wsm', NEXT_TELEMETRY_DISABLED: '1', ZOHO_SMTP_PASS: 'test-placeholder', GEMINI_API_KEY: '' },
  },
});
