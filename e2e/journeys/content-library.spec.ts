/**
 * Content Library E2E — /dashboard/content-library
 *
 * Tests the Content Library page, a media asset management surface with
 * upload, search, category filtering, and collection management.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Media Asset Library" + h1 "Content Library"
 *   • Upload button is visible
 *   • Search input is visible
 *   • Asset grid, loading state, or empty state renders — never blank
 *   • No 404 or generic error state
 *
 * No files are uploaded, deleted, or moved in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Content Library — Media Asset Manager", () => {
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
    await page.goto("/dashboard/content-library");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow asset list to load from storage
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("content library page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/content-library");
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
  test("renders editorial header with Media Asset Library eyebrow and Content Library h1", async ({ page }) => {
    const eyebrow = page.getByText(/Media Asset Library/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Content Library/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Upload button is visible ──────────────────────────────────────────
  test("Upload button is visible in the header action area", async ({ page }) => {
    const uploadBtn = page.getByRole("button", { name: /Upload/i }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Search input is visible ───────────────────────────────────────────
  test("search input is visible for filtering assets", async ({ page }) => {
    const searchInput = page
      .locator('input[type="search"], input[type="text"][placeholder*="search" i], input[placeholder*="filter" i]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 6000 });
  });

  // ── 5. Asset grid renders content — never blank ───────────────────────────
  test("asset area renders grid, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no assets|no media|upload your first|nothing here|empty library/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: assets in the grid
    const hasAssets = await page
      .locator("img[src], video, [class*='asset'], [class*='media-card']")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: asset container/grid rendered
    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='grid']")
      .filter({ has: page.locator("p, span, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasAssets || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("content library page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Content Library/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
