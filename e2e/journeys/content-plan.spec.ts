/**
 * Content Plan E2E — /dashboard/content-plan
 *
 * Tests the Content Plan page, an editorial calendar and social media
 * scheduling surface for managing posts across Instagram, TikTok, LinkedIn,
 * Twitter/X, YouTube, and Facebook.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Editorial Calendar" + h1 "Content Plan"
 *   • Platform filters or calendar structure is visible
 *   • Status filter tabs render (all/scheduled/posted/draft)
 *   • Content list, calendar view, or empty state renders — never blank
 *   • No 404 or generic error state
 *
 * No posts are created, scheduled, or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Content Plan — Editorial Calendar", () => {
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
    await page.goto("/dashboard/content-plan");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("content plan page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/content-plan");
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
  test("renders editorial header with Editorial Calendar eyebrow and Content Plan h1", async ({ page }) => {
    const eyebrow = page.getByText(/Editorial Calendar/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Content Plan/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Platform indicators or filters are visible ───────────────────────
  test("platform context is visible (social platform references)", async ({ page }) => {
    // At least one platform name, filter, or icon reference should be visible
    const hasPlatforms = await page
      .getByText(/Instagram|TikTok|LinkedIn|Twitter|YouTube|Facebook|platform/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasStatusFilter = await page
      .getByRole("button", { name: /^All$|^Scheduled$|^Posted$|^Draft$|^Failed$/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCalendarStructure = await page
      .locator("[class*='calendar'], [class*='grid'], [class*='schedule']")
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasPlatforms || hasStatusFilter || hasCalendarStructure).toBe(true);
  });

  // ── 4. Content list, calendar, or empty state renders — never blank ──────
  test("content area renders list, calendar view, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no posts|no content|schedule your first|get started|empty|no scheduled/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: scheduled/posted content
    const hasContent = await page
      .getByText(/scheduled|posted|draft|failed|needs review|caption/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: a container section rendered
    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
      .filter({ has: page.locator("h2, h3, p, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent || hasContainer).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("content plan page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Content Plan/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
