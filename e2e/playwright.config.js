import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLIENT = fileURLToPath(new URL('../client', import.meta.url));

/**
 * End-to-end tests: a real browser against the production build of the client and the real API
 * server, with an in-memory MongoDB. Run them with `npm run test:e2e` (it builds the client first).
 *
 * Both servers use the ports the app is wired for (API 4000, web 5173), and an existing server on
 * either port is an error, never reused: a test run must not talk to a developer's own database.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  // One flow changes stock that the next one reads, and the database is shared.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // `channel: 'chromium'` runs the full Chromium build in its new headless mode (what real
      // Chrome uses), so only `playwright install chromium` is needed, not the separate
      // "headless shell" download.
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: [
    {
      // In-memory MongoDB, one admin, and the real API on :4000.
      command: 'node e2e/stack.mjs',
      cwd: ROOT,
      url: 'http://127.0.0.1:4000/api/health/ready',
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // The production build of the client (run `npm run build -w client` first), with /api
      // proxied to the API, so the browser sees one origin, as in production.
      command:
        'node ../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5173 --strictPort',
      cwd: CLIENT,
      url: 'http://127.0.0.1:5173',
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
