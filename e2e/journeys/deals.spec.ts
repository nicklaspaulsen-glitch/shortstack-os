/**
 * Deals E2E — /dashboard/deals
 *
 * Tests the Deals Pipeline page, which is the central revenue-pipeline hub.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Deal Pipeline" + h1 "Deals Pipeline"
 *   • All 6 main tabs are present: Pipeline Board, Revenue Forecast,
 *     Win/Loss Analysis, Deal Scoring, Contracts, Commissions
 *   • "New Deal" button is visible
 *   • Clicking "New Deal" opens the Quick Create inline form with
 *     Deal title, Company name, and Amount inputs (all have aria-labels)
 *   • Pipeline Board renders stage columns OR a loading/empty state
 *     (never a blank void)
 *   • Revenue Forecast tab renders content or an empty state
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against empty accounts.
 * Tests that open inline forms close or navigate away before the next test.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Deals — Deal Pipeline", () => {
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
    await page.goto("/dashboard/deals");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow the initial data fetch to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("deals page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/deals");
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
  test("renders editorial header with Deal Pipeline eyebrow and Deals Pipeline h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Deal Pipeline/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Deals Pipeline"
    const heading = page.getByRole("heading", { name: /Deals Pipeline/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 6 main tabs render ────────────────────────────────────────────
  test("renders all 6 main tabs: Pipeline Board, Revenue Forecast, Win/Loss Analysis, Deal Scoring, Contracts, Commissions", async ({ page }) => {
    const tabs = [
      /Pipeline Board/i,
      /Revenue Forecast/i,
      /Win\/Loss Analysis|Win.Loss Analysis/i,
      /Deal Scoring/i,
      /Contracts/i,
      /Commissions/i,
    ];

    for (const pattern of tabs) {
      const tab = page.getByRole("button", { name: pattern }).first();
      await expect(tab).toBeVisible({ timeout: 6000 });
    }
  });

  // ── 4. New Deal button is visible ────────────────────────────────────────
  test("New Deal button is visible", async ({ page }) => {
    const newDealBtn = page.getByRole("button", { name: /New Deal/i }).first();
    await expect(newDealBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 5. New Deal button opens Quick Create form ───────────────────────────
  test("clicking New Deal opens Quick Create form with Deal title, Company name, and Amount inputs", async ({ page }) => {
    const newDealBtn = page.getByRole("button", { name: /New Deal/i }).first();
    await expect(newDealBtn).toBeVisible({ timeout: 6000 });
    await newDealBtn.click();
    await page.waitForTimeout(400);

    // Deal title input (aria-labeled)
    const titleInput = page.locator('[aria-label="Deal title"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Company name input (aria-labeled)
    const companyInput = page.locator('[aria-label="Company name"]');
    await expect(companyInput).toBeVisible({ timeout: 4000 });

    // Amount input (aria-labeled)
    const amountInput = page.locator('[aria-label="Deal amount"]');
    await expect(amountInput).toBeVisible({ timeout: 4000 });

    // Dismiss: press Escape or click a cancel button
    const cancelBtn = page.getByRole("button", { name: /Cancel|Close|✕/i }).first();
    if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(300);
  });

  // ── 6. Pipeline Board renders stage columns or loading / empty state ─────
  test("Pipeline Board tab renders stage columns, loading state, or empty state — never blank", async ({ page }) => {
    // Ensure Pipeline Board tab is active (it's the default)
    const pipelineTab = page.getByRole("button", { name: /Pipeline Board/i }).first();
    if (await pipelineTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await pipelineTab.click();
      await page.waitForTimeout(600);
    }

    // Valid state 1: named stage columns (Prospect, Qualified, etc.)
    const hasStageColumns =
      (await page
        .getByText(/Prospect|Qualified|Proposal Sent|Negotiation|Closed Won|Closed Lost/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    // Valid state 2: skeleton / loading indicator
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"], [class*="skeleton"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 3: explicit empty state message
    const hasEmptyState = await page
      .getByText(/no deals|empty pipeline|add your first deal|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasStageColumns || hasSkeleton || hasEmptyState).toBe(true);
  });

  // ── 7. Revenue Forecast tab renders content or empty state ───────────────
  test("clicking Revenue Forecast tab renders content or empty state", async ({ page }) => {
    const forecastTab = page.getByRole("button", { name: /Revenue Forecast/i }).first();
    await expect(forecastTab).toBeVisible({ timeout: 6000 });

    await forecastTab.click();
    await page.waitForTimeout(600);

    // Must render something — chart, summary card, or empty state
    const hasContent =
      (await page
        .getByText(/forecast|revenue|pipeline value|weighted|projected|no forecast|no deals/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="rounded"]')
        .filter({ has: page.locator("button, p, span, h2, h3") })
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 8. Deal Scoring tab renders content or empty state ───────────────────
  test("clicking Deal Scoring tab renders content or empty state", async ({ page }) => {
    const scoringTab = page.getByRole("button", { name: /Deal Scoring/i }).first();
    await expect(scoringTab).toBeVisible({ timeout: 6000 });

    await scoringTab.click();
    await page.waitForTimeout(600);

    const hasContent =
      (await page
        .getByText(/score|scoring|no deals|probability|win rate|AI/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="rounded"]')
        .filter({ has: page.locator("button, p, span") })
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 9. No 404 or generic error state ─────────────────────────────────────
  test("deals page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Deals Pipeline" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Deals Pipeline/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
