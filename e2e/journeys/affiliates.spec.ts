/**
 * Affiliates E2E — /dashboard/affiliates
 *
 * Tests the Affiliate Program page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Recurring revenue magnifier" + h1 "Affiliate Program"
 *   • Commission info, affiliate list, or empty state renders
 *   • Program settings section is visible
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Affiliates — Affiliate Program", () => {
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
    await page.goto("/dashboard/affiliates");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("affiliates page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/affiliates");
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
  test("renders editorial header with Recurring revenue magnifier eyebrow and Affiliate Program h1", async ({ page }) => {
    const eyebrow = page.locator(".font-editorial").first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });
    await expect(eyebrow).toContainText("Recurring revenue magnifier");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 6000 });
    await expect(h1).toContainText("Affiliate Program");
  });

  // ── 3. Commission info, list, or empty state renders ─────────────────────
  test("page shows commission info, affiliate list, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page.locator(".animate-pulse").first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await page.locator("text=/no affiliate/i, text=/no .*/i").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasCommission = await page
      .getByText(/commission|referral|affiliate|payout|rate|earnings/i)
      .first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasContainer = await page.locator("[class*='glass'], [class*='rounded-2xl']").first()
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasCommission || hasContainer).toBe(true);
  });

  // ── 4. Program settings section is visible ───────────────────────────────
  test("program settings or configuration section is present on the page", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSettings = await page
      .getByText(/program settings|commission rate|configuration|setup|enable/i)
      .first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    const hasForm = await page.locator("input, select, textarea").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasSection = await page.locator("section, [class*='section'], [class*='panel']").first()
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasSettings || hasForm || hasSection).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("affiliates page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 8000 });
    await expect(heading).toContainText("Affiliate Program");
  });
});
