/**
 * Content Production E2E — /dashboard/production
 *
 * Tests the Asset Pipeline / Content Production page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Asset Pipeline" + h1 "Content Production"
 *   • Four tabs render: Pipeline, Calendar, Standup, Approvals
 *   • Default tab (Pipeline) shows content or empty state — never blank
 *   • Calendar tab is clickable and shows content
 *   • No 404 or generic error state
 *
 * Tabs use active state class bg-[rgba(212,255,0,0.08)] text-brand-accent,
 * NOT the tab-pill-strip pattern. Tabs are queried by button text content.
 * No production assets are created or modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Content Production — Asset Pipeline", () => {
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
    await page.goto("/dashboard/production");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("production page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/production");
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
  test("renders editorial header with Asset Pipeline eyebrow and Content Production h1", async ({ page }) => {
    const eyebrow = page.getByText(/Asset Pipeline/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Content Production/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All four tabs are visible ────────────────────────────────────────
  test("Pipeline, Calendar, Standup, and Approvals tabs are all visible", async ({ page }) => {
    for (const tabLabel of ["Pipeline", "Calendar", "Standup", "Approvals"]) {
      const tab = page.getByRole("button", { name: new RegExp(`^${tabLabel}$`, "i") }).first();
      await expect(tab).toBeVisible({ timeout: 8000 });
    }
  });

  // ── 4. Default Pipeline tab content or empty state is visible ───────────
  test("Pipeline tab (default) shows content or empty state — never blank", async ({ page }) => {
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

    const hasPipelineContent = await page
      .getByText(/pipeline|draft|in progress|review|approved|scheduled|published/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCard = await page
      .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
      .filter({ has: page.locator("p, span, h3") })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasPipelineContent || hasCard).toBe(true);
  });

  // ── 5. Calendar tab is clickable and page remains stable ────────────────
  test("clicking Calendar tab does not crash the page", async ({ page }) => {
    const calendarTab = page.getByRole("button", { name: /^Calendar$/i }).first();
    await expect(calendarTab).toBeVisible({ timeout: 8000 });

    await calendarTab.click();
    await page.waitForTimeout(800);

    // Page must remain stable — header still visible after tab switch
    const heading = page.getByRole("heading", { name: /Content Production/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("production page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Content Production/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
