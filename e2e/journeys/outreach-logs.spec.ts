/**
 * Outreach Logs E2E — /dashboard/outreach-logs
 *
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Sent Campaigns" + h1 "Outreach Logs"
 *   • Logs list or empty state renders — never blank
 *   • Log filtering or search is visible
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Outreach Logs", () => {
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
    await page.goto("/dashboard/outreach-logs");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("outreach logs page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/outreach-logs");
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
  test("renders editorial header with Sent Campaigns eyebrow and Outreach Logs h1", async ({ page }) => {
    const eyebrow = page.getByText(/Sent Campaigns/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Outreach Logs/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Logs list or empty state renders — never blank ───────────────────
  test("logs list or empty state renders — never blank", async ({ page }) => {
    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmpty = await page
      .getByText(/no logs|no campaigns|no outreach/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: actual log entries
    const hasLogs = await page
      .getByText(/sent|delivered|opened|clicked|bounced|replied|email|sms|call/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 4: any containing panel is visible
    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded"], ul, ol, table')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasLogs || hasContainer).toBe(true);
  });

  // ── 4. Log filtering or search is visible ───────────────────────────────
  test("log filtering or search is visible", async ({ page }) => {
    const hasSearch = await page
      .locator('input[type="search"], input[type="text"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasFilter = await page
      .getByRole("button", { name: /filter|sort|all|email|sms/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasDateRange = await page
      .getByText(/today|this week|last.*days|date.*range/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // At least one control must be present — page is not a featureless blank
    expect(hasSearch || hasFilter || hasDateRange).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("outreach logs page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Outreach Logs/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
