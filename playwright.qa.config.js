import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/qa', workers: 1, timeout: 90000,
  outputDir: 'artifacts/qa/browser',
  reporter: [['list'], ['json', {outputFile: 'artifacts/qa/browser-results.json'}]],
  use: {baseURL:'http://127.0.0.1:3108',headless:true, screenshot:'only-on-failure',trace:'retain-on-failure',
    launchOptions:{...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{channel:'msedge'}),args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}},
  webServer:{command:'node scripts/qa/browser-server.js',url:'http://127.0.0.1:3108/health',reuseExistingServer:false},
});
