/**
 * Usage E2E — /dashboard/usage
 *
 * Tests the Token Usage page, which surfaces API token consumption stats,
 * plan limits, and optionally charts of usage over time.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "USAGE & LIMITS" + h1 "Token Usage"
 *   • Usage stats or limits are visible
 *   • Usage data area renders content or an empty state — never blank
 *   • No 404 or generic error state
 *
 * No settings are changed and no data is exported in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Usage — Token Usage & Limits", () => {
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
    await page.goto("/dashboard/usage");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("usage page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/usage");
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
  test("renders editorial header with USAGE & LIMITS eyebrow and Token Usage h1", async ({ page }) => {
    const eyebrow = page.getByText(/USAGE & LIMITS/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Token Usage/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Usage stats or limits are visible ─────────────────────────────────
  test("usage stats or limits are visible", async ({ page }) => {
    const hasTokens = await page
      .getByText(/token|tokens|usage/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasLimits = await page
      .getByText(/limit|quota|plan|remaining/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasStats = await page
      .locator('[class*="stat"], [class*="card"], [class*="metric"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasTokens || hasLimits || hasStats).toBe(true);
  });

  // ── 4. Usage data area renders content or empty state — never blank ───────
  test("usage data area renders content or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty / zero-usage message
    const hasEmptyState = await page
      .getByText(/no.*usage|no.*data|get.*started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: chart or data values
    const hasChartOrData =
      (await page
        .locator("canvas, svg, [class*='chart']")
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)) ||
      (await page
        .getByText(/k tokens|\d+%|calls|requests/i)
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    // Valid state 4: any glass/card container with child content
    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
      .filter({ has: page.locator("h2, h3, p, span, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasChartOrData || hasContainer).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("usage page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Token Usage/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
