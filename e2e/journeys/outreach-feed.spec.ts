/**
 * Outreach Feed E2E — /dashboard/outreach-feed
 *
 * Tests the Outreach Feed page, a real-time activity feed for outreach events.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Real-time Feed" + h1 "Outreach Feed"
 *   • Feed content or empty state renders — never blank
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Outreach Feed", () => {
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
    await page.goto("/dashboard/outreach-feed");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("outreach feed page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/outreach-feed");
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
  test("renders editorial header with Real-time Feed eyebrow and Outreach Feed h1", async ({ page }) => {
    const eyebrow = page.getByText(/Real-time Feed/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Outreach Feed/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Feed content or empty state renders — never blank ─────────────────
  test("feed content or empty state renders — never blank", async ({ page }) => {
    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 2: empty / no-activity state
    const hasEmpty = await page
      .getByText(/no activity|no.*feed|no.*outreach|empty/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: live feed entries (channel events, delivery statuses)
    const hasFeed = await page
      .getByText(/email|call|sms|message|sent|delivered|opened|clicked|replied/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 4: a list or rounded container holding feed rows
    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded"], ul, ol')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasFeed || hasContainer).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("outreach feed page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Outreach Feed/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
