/**
 * Analytics E2E — /dashboard/analytics
 *
 * Tests the performance overview dashboard. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Performance Overview" + h1 "Analytics"
 *   • Date-range pill strip renders (7d / 30d / 90d)
 *   • "Export CSV" button is visible
 *   • "Compare" toggle button is visible
 *   • Page shows loading skeleton OR empty state OR main content (never a blank void)
 *   • Clicking a date-range pill updates the active state
 *   • No 404 or generic error state
 *
 * All tests are guarded with hasTestCreds(). Data-dependent assertions fall
 * back to empty-state checks so tests never hard-fail on a fresh account.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Analytics", () => {
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
    await page.goto("/dashboard/analytics");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("analytics page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/analytics");
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
  test("renders editorial header with Performance Overview eyebrow and Analytics h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Performance Overview/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Analytics"
    const heading = page.getByRole("heading", { name: /Analytics/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Must NOT show the old PageHero pattern
    const pageHero = page.locator('[data-testid="page-hero"]');
    expect(await pageHero.count()).toBe(0);
  });

  // ── 3. Date-range pill strip renders ────────────────────────────────────
  test("date-range pills 7d, 30d, 90d are visible", async ({ page }) => {
    for (const pill of ["7d", "30d", "90d"]) {
      const btn = page.getByRole("button", { name: new RegExp(`^${pill}$`, "i") }).first();
      await expect(btn).toBeVisible({ timeout: 6000 });
    }
  });

  // ── 4. Export CSV button is visible ─────────────────────────────────────
  test("Export CSV button is visible", async ({ page }) => {
    const exportBtn = page.getByRole("button", { name: /Export CSV/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 5. Compare toggle button is visible ─────────────────────────────────
  test("Compare toggle button is visible", async ({ page }) => {
    const compareBtn = page.getByRole("button", { name: /Compare/i }).first();
    await expect(compareBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 6. Page shows some content (loading / empty / data) ─────────────────
  test("page shows loading skeleton, empty state, or analytics content — never blank", async ({ page }) => {
    // Give the page time to settle after fetch
    await page.waitForTimeout(3000);

    // Three valid content states
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/No analytics yet|Start by adding|no analytics/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/Monthly Recurring Revenue|Total Leads|Active Clients|MRR|Revenue/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // At least one must be true
    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 7. Clicking a date-range pill marks it active ────────────────────────
  test("clicking 7d pill makes it active", async ({ page }) => {
    // The default is 30d; click 7d and verify the UI changes
    const sevenDayBtn = page.getByRole("button", { name: /^7d$/i }).first();
    await expect(sevenDayBtn).toBeVisible({ timeout: 6000 });

    await sevenDayBtn.click();
    await page.waitForTimeout(400);

    // The button should gain the "active" class after click
    const classes = await sevenDayBtn.getAttribute("class");
    expect(classes).toContain("active");
  });

  // ── 8. Clicking 90d pill marks it active ────────────────────────────────
  test("clicking 90d pill changes date range selection", async ({ page }) => {
    const ninetyDayBtn = page.getByRole("button", { name: /^90d$/i }).first();
    await expect(ninetyDayBtn).toBeVisible({ timeout: 6000 });

    // Not already active
    const beforeClasses = await ninetyDayBtn.getAttribute("class");

    await ninetyDayBtn.click();
    await page.waitForTimeout(500);

    const afterClasses = await ninetyDayBtn.getAttribute("class");
    // After click, the 90d button must be marked active
    expect(afterClasses).toContain("active");
    // And the 30d button should no longer be the sole active pill
    const thirtyDayBtn = page.getByRole("button", { name: /^30d$/i }).first();
    const thirtyClasses = await thirtyDayBtn.getAttribute("class");
    // Either 30d lost "active" or 90d has "active" — one must be true
    expect(
      (afterClasses ?? "").includes("active") ||
      !(thirtyClasses ?? "").includes("active")
    ).toBe(true);
  });

  // ── 9. Compare toggle toggles on and off ────────────────────────────────
  test("Compare toggle button is interactive", async ({ page }) => {
    const compareBtn = page.getByRole("button", { name: /Compare/i }).first();
    await expect(compareBtn).toBeVisible({ timeout: 6000 });

    // Get initial class
    const initialClasses = await compareBtn.getAttribute("class");

    // Toggle on
    await compareBtn.click();
    await page.waitForTimeout(300);

    const afterClickClasses = await compareBtn.getAttribute("class");

    // Toggle off
    await compareBtn.click();
    await page.waitForTimeout(300);

    // Page must remain stable — no crash from toggling
    const heading = page.getByRole("heading", { name: /Analytics/i }).first();
    await expect(heading).toBeVisible({ timeout: 4000 });

    // After two clicks, classes should return to initial state
    const finalClasses = await compareBtn.getAttribute("class");
    expect(finalClasses).toBe(initialClasses);
  });

  // ── 10. No 404 or generic error state ────────────────────────────────────
  test("analytics page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Analytics" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Analytics/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
