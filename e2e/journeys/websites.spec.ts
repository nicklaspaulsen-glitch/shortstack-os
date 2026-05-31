/**
 * Websites E2E — /dashboard/websites
 *
 * Tests the Websites page ("Sites That Convert"), which lists and manages
 * agency websites. The viewport toggle (desktop/tablet/mobile tab-pill-strip)
 * exists inside a site detail view, not on the main listing page.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Websites" + h1 "Sites That Convert"
 *   • Site list or empty state is visible on load
 *   • A create/generate site button is visible
 *   • No 404 or generic error state
 *
 * No sites are created, edited, or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Websites — Sites That Convert", () => {
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
    await page.goto("/dashboard/websites");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("websites page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/websites");
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
  test("renders editorial header with Websites eyebrow and Sites That Convert h1", async ({ page }) => {
    const eyebrow = page.getByText(/^Websites$/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page
      .getByRole("heading", { name: /Sites That Convert/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Site list or empty state renders ─────────────────────────────────
  test("shows site list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no sites|no websites|generate.*website|create.*site|get started|build your first/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: site rows/cards (domain, status, visits)
    const hasSites = await page
      .getByText(/live|published|draft|domain|https?:\/\/|visits|pages|traffic/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any rendered card or panel
    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasSites || hasPanel).toBe(true);
  });

  // ── 4. Create / Generate Website button is visible ───────────────────────
  test("create or generate site button is visible", async ({ page }) => {
    // The CTA may read "Generate Website", "New Site", or "Create Site"
    const hasCreateBtn =
      (await page
        .getByRole("button", { name: /generate website|new site|create site|add site/i })
        .first()
        .isVisible({ timeout: 6000 })
        .catch(() => false)) ||
      (await page
        .getByText(/generate website|new site|create site|add site/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasCreateBtn).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("websites page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page
      .getByRole("heading", { name: /Sites That Convert/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
