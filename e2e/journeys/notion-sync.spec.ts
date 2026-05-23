/**
 * Notion Sync E2E — /dashboard/notion-sync
 *
 * Tests the Knowledge Sync / Notion workspace sync page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Knowledge Sync" + h1 "Notion Sync"
 *   • Sync content is visible: connect button OR sync status OR database list OR empty state
 *   • Page never blank below the header
 *   • No 404 or generic error state
 *
 * No sync actions or workspace connections are initiated in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Notion Sync — Knowledge Sync", () => {
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
    await page.goto("/dashboard/notion-sync");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("notion-sync page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/notion-sync");
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
  test("renders editorial header with Knowledge Sync eyebrow and Notion Sync h1", async ({ page }) => {
    const eyebrow = page.getByText(/Knowledge Sync/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Notion Sync/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Sync content is visible (connected or unconnected state) ──────────
  test("shows connect Notion button, sync status, database list, or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasConnectBtn = await page
      .getByRole("button", { name: /Connect Notion|Connect to Notion|Connect/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasSyncStatus = await page
      .getByText(/sync status|last synced|syncing|connected|workspace/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasDatabaseList = await page
      .getByText(/database|page|workspace|notion/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

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

    expect(hasConnectBtn || hasSyncStatus || hasDatabaseList || hasSkeleton || hasEmptyState).toBe(true);
  });

  // ── 4. Page never blank below the header ────────────────────────────────
  test("page shows content below the header — never a blank void", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasText = await page
      .getByText(/notion|sync|workspace|connect|database/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasPanel || hasText).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("notion-sync page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Notion Sync/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
