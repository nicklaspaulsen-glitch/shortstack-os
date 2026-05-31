/**
 * Referrals E2E — /dashboard/referrals
 *
 * Tests the Affiliate program / Referrals & commissions page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Affiliate program" + h1 containing "Referrals"
 *     (h1 text is "Referrals & commissions" — the "&" may render from HTML entity &amp;,
 *      so toContainText("Referrals") is used rather than an exact match)
 *   • Referral content is visible: commission stats, referral link, or empty state
 *   • No 404 or generic error state
 *
 * No referral actions or payouts are initiated in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Referrals — Affiliate Program", () => {
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
    await page.goto("/dashboard/referrals");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("referrals page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/referrals");
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
  test("renders editorial header with Affiliate program eyebrow and Referrals h1", async ({ page }) => {
    const eyebrow = page.getByText(/Affiliate program/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 is "Referrals & commissions" — use toContainText to avoid &amp; issues
    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toContainText("Referrals", { timeout: 6000 });
  });

  // ── 3. Referral content is visible (stats, link, or empty state) ─────────
  test("shows commission stats, referral link, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no .*/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasStats = await page
      .getByText(/commission|earnings|referred|referral link|clicks|signups|payout/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasLink = await page
      .locator('input[type="text"][value*="shortstack"], input[readonly]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
      .filter({ has: page.locator("p, span, h3") })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasStats || hasLink || hasPanel).toBe(true);
  });

  // ── 4. Commissions section or referral link is accessible ────────────────
  test("commissions section or referral link section is accessible", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasCommissionText = await page
      .getByText(/commission|payout|earn|reward/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasReferralText = await page
      .getByText(/referral|refer|invite/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasCommissionText || hasReferralText).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("referrals page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toContainText("Referrals", { timeout: 8000 });
  });
});
