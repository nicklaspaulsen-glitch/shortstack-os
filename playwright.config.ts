import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Load E2E credentials from gitignored .env.test.local (set E2E_TEST_EMAIL + E2E_TEST_PASSWORD there)
loadEnv({ path: ".env.test.local" });

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
    "e2e/setup/*.setup.ts",
  ],
  timeout: 60_000,
  // Cap all page.goto() / page.waitForNavigation() calls at 30 s regardless
  // of individual test.setTimeout() overrides. Without this, raising a test's
  // timeout via test.setTimeout(200_000) propagates to the page's navigation
  // timeout, causing page.goto() to hang the full 200 s on a stalled Vercel
  // connection instead of throwing quickly and letting the auth recovery path
  // start. 30 s is generous for any production Next.js page load.
  navigationTimeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || "https://app.shortstack.work",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Sign in once, save storageState (cookies + localStorage) to disk.
    // Runs before any journey test so auth tokens are ready on first use.
    {
      name: "setup",
      testMatch: /e2e\/setup\/auth\.setup\.ts/,
    },
    // All journey/smoke tests start with a pre-authenticated browser context.
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
