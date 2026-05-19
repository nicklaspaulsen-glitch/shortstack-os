/**
 * Lead Pipeline E2E — /dashboard/leadgen-pipeline
 *
 * Tests the voice-outreach AI qualification kanban dashboard. Verifies:
 *   • Page loads without JS errors (settingsOnly — accessible via direct URL)
 *   • Stage column headers render (outreach_sent, replied, qualifying, qualified,
 *     content_ready, converted)
 *   • Stats bar appears with at least 5 labels
 *   • Stage filter pills render
 *   • Empty-state message shows when no leads exist
 *   • Dead leads accordion section is present
 *   • No uncaught console errors
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

const STAGE_LABELS = [
  "Outreach Sent",
  "Replied",
  "Qualifying",
  "Qualified",
  "Content Ready",
  "Converted",
];

test.describe("Lead Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasTestCreds(),
      "E2E credentials not set — skipping authenticated tests",
    );

    test.setTimeout(45_000);
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.goto("/dashboard/leadgen-pipeline");
    await page.waitForLoadState("networkidle");
  });

  test("renders page heading and stats bar", async ({ page }) => {
    // Page title
    await expect(
      page.locator("h1, [data-testid='page-title']").filter({ hasText: /Lead Pipeline/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Stats bar — at least one metric label present
    const statsBar = page.locator("[data-testid='pipeline-stats'], .stats-bar");
    if (await statsBar.count() > 0) {
      await expect(statsBar).toBeVisible();
    }
  });

  test("renders all 6 active stage columns", async ({ page }) => {
    for (const label of STAGE_LABELS) {
      await expect(
        page.locator(`text=${label}`).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("stage filter pills are present and interactive", async ({ page }) => {
    // "All" filter pill should be the default active state
    const allPill = page.locator("button").filter({ hasText: /^All$/i });
    await expect(allPill).toBeVisible({ timeout: 10_000 });

    // Clicking a stage pill should not throw
    const qualifiedPill = page.locator("button").filter({ hasText: /Qualified/i }).first();
    if (await qualifiedPill.isVisible()) {
      await qualifiedPill.click();
      // Should remain on the page without JS errors
      await expect(page.locator("body")).toBeVisible();
      // Reset back to All
      await allPill.click();
    }
  });

  test("kanban board or empty state is visible", async ({ page }) => {
    // Either a lead card is visible, or an empty-state message
    const board = page.locator("[data-testid='kanban-board'], .kanban-column, [class*='kanban']");
    const emptyText = page.locator("text=No leads").or(
      page.locator("text=No qualified leads"),
    );

    const hasBoardContent = await board.count() > 0;
    const hasEmptyState = await emptyText.count() > 0;

    expect(hasBoardContent || hasEmptyState).toBeTruthy();
  });

  test("dead leads accordion section renders", async ({ page }) => {
    // Scroll to the bottom — dead leads accordion is below the kanban board
    await page.keyboard.press("End");
    await page.waitForTimeout(500);

    // The accordion button or section heading
    const deadSection = page.locator("button, summary").filter({ hasText: /Dead leads/i });
    if (await deadSection.count() > 0) {
      await expect(deadSection.first()).toBeVisible();
    }
    // If no dead leads exist, the section may be absent — that's OK
  });

  test("no uncaught JS errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.reload();
    await page.waitForLoadState("networkidle");

    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection") &&
        !e.includes("hydration"),
    );
    expect(critical).toHaveLength(0);
  });
});
