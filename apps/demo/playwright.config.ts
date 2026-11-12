import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 90000, expect: { timeout: 20000 }, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 1080 }, trace: 'retain-on-failure' },
  webServer: { command: 'node ../../scripts/serve-demo.mjs', url: 'http://localhost:4173/demos/orchestrator/', reuseExistingServer: false },
});
