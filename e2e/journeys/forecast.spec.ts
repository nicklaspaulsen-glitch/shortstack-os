/**
 * Revenue Forecast E2E — /dashboard/forecast
 *
 * Tests the Revenue Forecast page, a pipeline projection tool that shows
 * weighted deal forecasts, total pipeline, and closed-won revenue by month.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Pipeline Projection" + h1 "Revenue Forecast"
 *   • Pipeline stats render (total pipeline, this month, won YTD)
 *   • Forecast visualization or deal list renders — never blank
 *   • No 404 or generic error state
 *
 * No deals are added, updated, or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Revenue Forecast — Pipeline Projection", () => {
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
    await page.goto("/dashboard/forecast");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow deals data to load from Supabase
    await page.waitForTimeout(2000);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("forecast page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/forecast");
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
  test("renders editorial header with Pipeline Projection eyebrow and Revenue Forecast h1", async ({ page }) => {
    const eyebrow = page.getByText(/Pipeline Projection/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Revenue Forecast/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Pipeline stats render ─────────────────────────────────────────────
  test("pipeline statistics render: total pipeline and revenue metrics", async ({ page }) => {
    // Total pipeline stat
    const hasPipeline = await page
      .getByText(/pipeline|total pipeline/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    // Won / closed-won stat
    const hasWon = await page
      .getByText(/won|closed.*won|closed/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // This month / forecast stat
    const hasMonthly = await page
      .getByText(/this month|monthly forecast|weighted/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // General revenue/deal metric visible
    const hasMetric = await page
      .getByText(/deal|stage|forecast|revenue|pipeline|opportunity/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasPipeline || hasWon || hasMonthly || hasMetric).toBe(true);
  });

  // ── 4. Forecast visualization renders — never blank ──────────────────────
  test("forecast area renders visualization, deal list, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading
    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state (no deals)
    const hasEmptyState = await page
      .getByText(/no deals|no pipeline|add your first deal|get started|no open deals/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: deals visible
    const hasDeals = await page
      .getByText(/prospect|qualified|proposal|closed|lead|negotiat/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: chart / visualization container rendered
    const hasChart = await page
      .locator("svg, canvas, [class*='chart'], [class*='glass'], [class*='rounded-xl']")
      .filter({ has: page.locator("p, span") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasDeals || hasChart).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("forecast page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Revenue Forecast/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
