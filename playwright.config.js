import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/qa/**',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:3107',
    headless: true,
    launchOptions: {
      ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: 'msedge' }),
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
    trace: 'retain-on-failure',
  },
  webServer: { command: 'node scripts/e2e-server.js', url: 'http://127.0.0.1:3107/health', reuseExistingServer: false },
});
