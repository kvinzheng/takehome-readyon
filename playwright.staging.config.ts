import { defineConfig, devices } from '@playwright/test';

/**
 * Staging-environment e2e config.
 *
 * Runs the same specs in src/tests/e2e against a deployed staging URL
 * instead of a locally-booted dev server. Used by CI after a deploy to
 * staging completes, before promoting the build to production.
 *
 * Differences from the default config:
 *  - baseURL points at the deployed staging app (override via STAGING_URL).
 *  - No webServer block — the app is already running remotely.
 *  - Retries bumped, since network adds flakiness vs localhost.
 *  - Trace captured on every retry, since debugging a CI-only failure is
 *    harder than a local one.
 *
 * Usage:
 *   STAGING_URL=https://staging.readyon.com \
 *     npx playwright test --config=playwright.staging.config.ts
 *
 * Note: the e2e specs assume the staging env is seeded with the same
 * demo accounts used locally (alice@readyon.com, carol@readyon.com).
 * In a real deployment the seed step runs as part of the staging deploy
 * pipeline, not as part of the test run.
 */

const STAGING_URL = process.env.STAGING_URL ?? 'https://staging.readyon.com';

export default defineConfig({
  testDir: './src/tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: STAGING_URL,
    trace: 'retain-on-failure',
    // Slightly longer timeouts — real network is not localhost.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Intentionally NO webServer — staging is already deployed.
});
