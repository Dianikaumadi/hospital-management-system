import { defineConfig, devices } from '@playwright/test';
import { env } from './config/env';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 2 : 0,
  workers: env.isCI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
    ...(env.isCI ? ([['github']] as const) : [])
  ],

  use: {
    baseURL: env.baseUrl,
    locale: 'en-US',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    testIdAttribute: 'data-testid',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],

  webServer: env.startServers
    ? [
        {
          command: 'npx tsx src/server.ts',
          cwd: '../backend',
          url: `${env.apiUrl}/health`,
          reuseExistingServer: !env.isCI,
          timeout: 120_000
        },
        {
          command: 'npx vite --port 5173 --strictPort',
          cwd: '../frontend',
          url: env.baseUrl,
          reuseExistingServer: !env.isCI,
          timeout: 120_000
        }
      ]
    : undefined
});
