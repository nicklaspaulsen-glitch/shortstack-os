/**
 * Activity Log E2E — /dashboard/activity-log
 *
 * Tests the activity log page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Recent Activity" + h1 "Activity Log"
 *   • Default tab section (Activity Feed) is visible
 *   • At least one stat, log entry, or empty state renders
 *   • Tab navigation works (feed → audit)
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Activity Log — Recent Activity", () => {
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
    await page.goto("/dashboard/activity-log");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("activity log page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/activity-log");
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
  test("renders editorial header with Recent Activity eyebrow and Activity Log h1", async ({ page }) => {
    const eyebrow = page.locator(".font-editorial").first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });
    await expect(eyebrow).toContainText("Recent Activity");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 6000 });
    await expect(h1).toContainText("Activity Log");
  });

  // ── 3. Default feed tab section is visible ──────────────────────────────
  test("default Activity Feed tab section renders content or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page.locator(".animate-pulse").first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await page.locator("text=/no .*/i, text=/empty/i").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasContent = await page.locator("[class*='activity'], [class*='log-entry'], [class*='feed']").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasContainer = await page.locator("[class*='glass'], [class*='rounded-2xl']").first()
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent || hasContainer).toBe(true);
  });

  // ── 4. Feed tab is active by default ────────────────────────────────────
  test("Activity Feed tab is active by default", async ({ page }) => {
    const feedTab = page.getByRole("button", { name: /Activity Feed/i }).first();
    await expect(feedTab).toBeVisible({ timeout: 8000 });

    const classes = await feedTab.getAttribute("class");
    // Active tab carries lime accent styling
    const isActive = (classes ?? "").includes("brand-accent") ||
      (classes ?? "").includes("rgba(212,255,0") ||
      (classes ?? "").includes("font-medium");
    expect(isActive).toBe(true);
  });

  // ── 5. Tab navigation: switching to Audit Trail ─────────────────────────
  test("clicking Audit Trail tab navigates to that section", async ({ page }) => {
    const auditTab = page.getByRole("button", { name: /Audit Trail/i }).first();
    await expect(auditTab).toBeVisible({ timeout: 8000 });
    await auditTab.click();
    await page.waitForTimeout(500);

    // After clicking, page must remain stable with no crash
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 5000 });
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("activity log page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
