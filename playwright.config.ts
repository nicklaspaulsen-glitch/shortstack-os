import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E config. Run with: `npm run e2e`
 *
 * By default points at production. Override with PLAYWRIGHT_BASE_URL
 * for local dev (e.g. `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e`).
 */
export default defineConfig({
  testDir: "./playwright",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "https://shortstack-os.vercel.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
