/**
 * Verticals E2E — /dashboard/verticals
 *
 * Tests the Vertical Templates page, an industry-specific template gallery
 * with no tab navigation (224 lines, single-view page).
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "VERTICAL TEMPLATES" + h1 "Vertical Templates"
 *   • Template gallery content is visible (industry cards or template grid or empty state)
 *   • Page contains industry-specific text or category labels
 *   • No 404 or generic error state
 *
 * No templates are installed or modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Verticals — Vertical Templates", () => {
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
    await page.goto("/dashboard/verticals");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("verticals page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/verticals");
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
  test("renders editorial header with VERTICAL TEMPLATES eyebrow and Vertical Templates h1", async ({ page }) => {
    // Eyebrow — "VERTICAL TEMPLATES" (may be uppercase in source)
    const eyebrow = page.getByText(/VERTICAL TEMPLATES|Vertical Templates/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Vertical Templates"
    const heading = page
      .getByRole("heading", { name: /Vertical Templates/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Template gallery or industry cards render ─────────────────────────
  test("shows industry cards, template grid, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no templates|no verticals|coming soon|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: industry category cards (common verticals)
    const hasIndustryContent = await page
      .getByText(/real estate|agency|fitness|salon|dental|medical|restaurant|legal|roofing|plumbing|hvac|contractor/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: generic template/card grid
    const hasGrid = await page
      .getByText(/template|workflow|sequence|funnel|install|use this/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 5: any rendered glass panel or card container
    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasIndustryContent || hasGrid || hasPanel).toBe(true);
  });

  // ── 4. Page contains industry-specific content ───────────────────────────
  test("page contains industry or vertical category labels", async ({ page }) => {
    await page.waitForTimeout(2000);

    // The page should have at least some recognizable industry or category text
    const hasIndustry =
      (await page
        .getByText(/real estate|agency|fitness|salon|dental|medical|restaurant|legal|roofing|contractor|hvac|plumbing/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .getByText(/vertical|industry|niche|sector|category/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .getByText(/template|workflow|sequence|install/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasIndustry).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("verticals page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page
      .getByRole("heading", { name: /Vertical Templates/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
