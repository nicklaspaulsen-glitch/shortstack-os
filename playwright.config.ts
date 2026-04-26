import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config.
 *
 * Two test suites:
 *   playwright/   — public smoke tests (no auth required)
 *   e2e/journeys/ — full user-journey tests (require E2E_TEST_EMAIL + E2E_TEST_PASSWORD)
 *
 * Run commands:
 *   npm run test:e2e          — all suites, headless (default: production)
 *   npm run test:e2e:headed   — same, with browser window
 *   npm run test:e2e:ui       — interactive Playwright UI
 *   npm run record            — open codegen recorder on production
 *
 * Override base URL:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
 */
export default defineConfig({
  testDir: ".",
  testMatch: [
    "playwright/**/*.spec.ts",
    "e2e/journeys/**/*.spec.ts",
  ],
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || "https://app.shortstack.work",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
