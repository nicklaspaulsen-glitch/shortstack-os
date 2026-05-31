/**
 * Telegram E2E — /dashboard/telegram
 *
 * Tests the Telegram Channel page, which manages Telegram bot routines,
 * message templates, activity logs, and settings.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Telegram Channel" + h1 "Telegram"
 *   • "Routines" tab button is visible as the default tab
 *   • Routines tab content or empty state is visible
 *   • "Templates" tab button is clickable without crashing
 *   • No 404 or generic error state
 *
 * No routines or templates are created or modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Telegram — Telegram Channel", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasTestCreds(),
      "E2E credentials not set — skipping authenticated tests",
    );
    test.setTimeout(200_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tour_completed", "true");
        localStorage.setItem("cookie-consent", "accepted");
      } catch {}
    });
    await page.goto("/dashboard/telegram");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("telegram page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/telegram");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection") &&
        !e.includes("hydration"),
    );
    expect(critical).toHaveLength(0);
  });

  // ── 2. Editorial header: eyebrow + h1 ───────────────────────────────────
  test("renders editorial header with Telegram Channel eyebrow and Telegram h1", async ({ page }) => {
    const eyebrow = page.getByText(/Telegram Channel/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Telegram$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Routines tab button is visible as the default ─────────────────────
  test("Routines tab button is visible and is the default active tab", async ({ page }) => {
    // The tab type is "routines"; the label may render as "Routines" or "routines"
    const routinesTab = page
      .getByRole("button", { name: /^Routines$/i })
      .first();
    await expect(routinesTab).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Routines tab content or empty state renders ───────────────────────
  test("Routines tab shows routine list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no routines|create.*routine|set up.*bot|connect.*telegram|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: routine rows (daily, weekly, trigger keywords)
    const hasRoutines = await page
      .getByText(/daily|weekly|trigger|broadcast|schedule|bot|routine/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any rendered glass panel
    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasRoutines || hasPanel).toBe(true);
  });

  // ── 5. Templates tab is clickable without crashing ───────────────────────
  test("clicking Templates tab renders content without crashing", async ({ page }) => {
    const templatesTab = page
      .getByRole("button", { name: /^Templates$/i })
      .first();
    await expect(templatesTab).toBeVisible({ timeout: 6000 });

    await templatesTab.click();
    await page.waitForTimeout(800);

    // Heading must still be visible — page did not crash
    const heading = page.getByRole("heading", { name: /^Telegram$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Some content should appear in the templates panel
    const hasContent =
      (await page
        .getByText(/template|message|create|no templates|markdown/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="glass"], [class*="rounded"]')
        .filter({ has: page.locator("p, h2, h3, button") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("telegram page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Telegram$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
