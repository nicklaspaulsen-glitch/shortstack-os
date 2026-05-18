/**
 * Playwright auth setup — runs ONCE before the test suite.
 *
 * Signs in with E2E credentials and saves the full browser storage state
 * (cookies + localStorage) to e2e/.auth/user.json. The chromium project in
 * playwright.config.ts seeds every test context from that file, so each test
 * starts already authenticated — no per-test sign-in loop required.
 *
 * If credentials are not configured the file is still written (empty state)
 * so that tests relying on `test.skip(!hasTestCreds())` can skip cleanly
 * instead of crashing on a missing file.
 */

import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";
import { signIn, hasTestCreds } from "../helpers/auth";

export const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate once for the whole suite", async ({ page }) => {
  const authDir = path.dirname(AUTH_FILE);
  fs.mkdirSync(authDir, { recursive: true });

  if (!hasTestCreds()) {
    // Write empty state so tests can skip via hasTestCreds() check.
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  await signIn(page);

  // Capture cookies + localStorage in one shot.
  await page.context().storageState({ path: AUTH_FILE });
});
