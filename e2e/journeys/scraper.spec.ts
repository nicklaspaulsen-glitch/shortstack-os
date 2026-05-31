/**
 * Scraper / Lead Finder E2E — /dashboard/scraper
 *
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Prospecting Engine" + h1 "Lead Finder"
 *   • Search form or result list renders — never blank
 *   • Search input or prospecting trigger is visible
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Scraper — Lead Finder", () => {
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
    await page.goto("/dashboard/scraper");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("scraper page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/scraper");
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
  test("renders editorial header with Prospecting Engine eyebrow and Lead Finder h1", async ({ page }) => {
    const eyebrow = page.getByText(/Prospecting Engine/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Lead Finder/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Search form or result list renders — never blank ─────────────────
  test("search form or result list renders — never blank", async ({ page }) => {
    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 2: empty / prompt state
    const hasEmpty = await page
      .getByText(/no results|start.*search|enter.*criteria|find.*leads/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: actual result rows
    const hasResults = await page
      .getByText(/company|industry|employees|revenue|location|contact|email/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 4: any containing panel is visible
    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded"], ul, ol, table, form')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasResults || hasContainer).toBe(true);
  });

  // ── 4. Search input or prospecting trigger is visible ───────────────────
  test("search input or prospecting trigger is visible", async ({ page }) => {
    const hasSearch = await page
      .locator(
        'input[type="text"], input[placeholder*="search" i], input[placeholder*="company" i], input[placeholder*="industry" i]',
      )
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasSearchBtn = await page
      .getByRole("button", { name: /search|find.*leads|prospect|scrape/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasFilter = await page
      .getByText(/industry|company.*size|location|filters/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // At least one input/trigger/filter must be present
    expect(hasSearch || hasSearchBtn || hasFilter).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("scraper page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Lead Finder/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
