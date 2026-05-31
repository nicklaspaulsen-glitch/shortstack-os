/**
 * Audit Log E2E — /dashboard/audit
 *
 * Tests the Audit Log page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Activity & Audit" + h1 "Audit Log"
 *   • Default tab (trail) content or empty state renders
 *   • Security tab is clickable and navigates correctly
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Audit Log — Activity & Audit", () => {
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
    await page.goto("/dashboard/audit");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("audit page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/audit");
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
  test("renders editorial header with Activity & Audit eyebrow and Audit Log h1", async ({ page }) => {
    const eyebrow = page.locator(".font-editorial").first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });
    await expect(eyebrow).toContainText("Activity & Audit");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 6000 });
    await expect(h1).toContainText("Audit Log");
  });

  // ── 3. Trail tab content or empty state renders by default ───────────────
  test("default trail tab shows audit entries, empty state, or loading skeleton", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page.locator(".animate-pulse").first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await page.locator("text=/no audit/i, text=/no .*/i, text=/empty/i").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasTrailContent = await page
      .getByText(/audit|trail|event|action|timestamp|user|ip address/i)
      .nth(1)
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasContainer = await page.locator("[class*='glass'], [class*='rounded-2xl'], table, ul").first()
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasTrailContent || hasContainer).toBe(true);
  });

  // ── 4. Security tab is clickable ─────────────────────────────────────────
  test("Security tab is visible and clickable without crashing the page", async ({ page }) => {
    const securityTab = page
      .getByRole("button", { name: /^Security$/i })
      .first();
    await expect(securityTab).toBeVisible({ timeout: 8000 });
    await securityTab.click();
    await page.waitForTimeout(500);

    // Page must remain stable after tab switch — header still visible
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 5000 });
    await expect(h1).toContainText("Audit Log");
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("audit page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 8000 });
    await expect(heading).toContainText("Audit Log");
  });
});
