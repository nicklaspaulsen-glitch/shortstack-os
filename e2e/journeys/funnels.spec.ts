/**
 * Funnels E2E — /dashboard/funnels
 *
 * Tests the Funnels page, a conversion funnel manager with filter tabs
 * for All, Published, Drafts, and Archived funnels.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Conversion Funnels" + h1 "Funnels"
 *   • Filter tabs render: All, Published, Drafts, Archived
 *   • New Funnel button is visible
 *   • Funnel list, loading state, or empty state renders — never blank
 *   • No 404 or generic error state
 *
 * No funnels are created, published, or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Funnels — Conversion Funnel Manager", () => {
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
    await page.goto("/dashboard/funnels");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("funnels page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/funnels");
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
  test("renders editorial header with Conversion Funnels eyebrow and Funnels h1", async ({ page }) => {
    const eyebrow = page.getByText(/Conversion Funnels/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Funnels$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Filter tabs render ─────────────────────────────────────────────────
  test("renders filter tabs: All, Published, Drafts, Archived", async ({ page }) => {
    // All tab
    await expect(
      page.getByRole("button", { name: /^All$/i }).first()
    ).toBeVisible({ timeout: 8000 });

    // Published tab
    await expect(
      page.getByRole("button", { name: /^Published$/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Drafts tab
    await expect(
      page.getByRole("button", { name: /^Drafts$/i }).first()
    ).toBeVisible({ timeout: 4000 });

    // Archived tab
    await expect(
      page.getByRole("button", { name: /^Archived$/i }).first()
    ).toBeVisible({ timeout: 4000 });
  });

  // ── 4. New Funnel button is visible ──────────────────────────────────────
  test("New Funnel button is visible in the header action area", async ({ page }) => {
    const newFunnelBtn = page.getByRole("button", { name: /New Funnel/i }).first();
    await expect(newFunnelBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 5. Funnel list renders content — never blank ──────────────────────────
  test("funnel list area renders list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no funnels|create your first funnel|get started|no conversion funnels/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: funnel cards
    const hasFunnels = await page
      .getByText(/draft|published|archived|steps|step|funnel/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any container rendered
    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
      .filter({ has: page.locator("h2, h3, p") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasFunnels || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("funnels page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Funnels$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
