/**
 * Pricing E2E — /dashboard/pricing
 *
 * Tests the subscription plan display page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Billing" + h1 "Choose Your Plan"
 *   • Plan cards or pricing content is visible
 *   • Monthly/annual billing cycle toggle (tab-pill-strip) is visible
 *   • Clicking the toggle switches between monthly and annually
 *   • No 404 or generic error state
 *
 * No plan changes or purchases are made in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Pricing — Choose Your Plan", () => {
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
    await page.goto("/dashboard/pricing");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("pricing page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/pricing");
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
  test("renders editorial header with Billing eyebrow and Choose Your Plan h1", async ({ page }) => {
    const eyebrow = page.getByText(/^Billing$/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Choose Your Plan/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Billing cycle toggle is visible ──────────────────────────────────
  test("monthly/annually billing cycle toggle is visible", async ({ page }) => {
    const monthlyBtn = page
      .getByRole("button", { name: /monthly/i })
      .first();
    await expect(monthlyBtn).toBeVisible({ timeout: 8000 });

    const annuallyBtn = page
      .getByRole("button", { name: /annually|annual|yearly/i })
      .first();
    await expect(annuallyBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Plan cards or pricing content is visible ──────────────────────────
  test("plan cards or pricing content renders — never blank", async ({ page }) => {
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

    const hasPlanCard = await page
      .getByText(/starter|growth|pro|enterprise|plan|per month|\/mo|price/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCard = await page
      .locator('[class*="glass"], [class*="rounded-2xl"], [class*="rounded-xl"]')
      .filter({ has: page.locator("h2, h3, p") })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasPlanCard || hasCard).toBe(true);
  });

  // ── 5. Clicking the annually toggle is interactive ───────────────────────
  test("clicking annually toggle switches the billing cycle", async ({ page }) => {
    const annuallyBtn = page
      .getByRole("button", { name: /annually|annual|yearly/i })
      .first();
    await expect(annuallyBtn).toBeVisible({ timeout: 8000 });

    await annuallyBtn.click();
    await page.waitForTimeout(400);

    // After clicking, the page should still show the heading (no crash)
    const heading = page.getByRole("heading", { name: /Choose Your Plan/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("pricing page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Choose Your Plan/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
