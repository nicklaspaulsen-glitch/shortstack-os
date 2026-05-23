/**
 * N8N Workflows E2E — /dashboard/n8n
 *
 * Tests the N8N Workflows page, which manages n8n automation workflows
 * with a tab-pill-strip filter: "all" | "active" | "inactive".
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Automations" + h1 "N8N Workflows"
 *   • All three filter pills render: all, active, inactive
 *   • "all" filter is active by default (.tab-pill.active contains "all")
 *   • Workflow list OR empty state is visible
 *   • "active" filter pill is clickable and switches state
 *   • No 404 or generic error state
 *
 * Filter buttons use .tab-pill and .tab-pill.active classes (tab-pill-strip pattern).
 *
 * Data-dependent assertions guard against accounts with no workflows.
 * No workflows are created or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("N8N Workflows — Automations", () => {
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
    await page.goto("/dashboard/n8n");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("n8n page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/n8n");
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
  test("renders editorial header with Automations eyebrow and N8N Workflows h1", async ({ page }) => {
    const eyebrow = page.getByText(/^Automations$/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /N8N Workflows/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All three filter pills render ────────────────────────────────────
  test("renders all three filter pills: all, active, inactive", async ({ page }) => {
    // The strip uses .tab-pill buttons inside a .tab-pill-strip container
    const allPill = page.locator(".tab-pill").filter({ hasText: /^all$/i }).first();
    await expect(allPill).toBeVisible({ timeout: 8000 });

    const activePill = page.locator(".tab-pill").filter({ hasText: /^active$/i }).first();
    await expect(activePill).toBeVisible({ timeout: 6000 });

    const inactivePill = page.locator(".tab-pill").filter({ hasText: /^inactive$/i }).first();
    await expect(inactivePill).toBeVisible({ timeout: 6000 });
  });

  // ── 4. "all" filter pill is active by default ────────────────────────────
  test('"all" filter pill has the active class by default', async ({ page }) => {
    // The active pill gets both .tab-pill and .active (i.e. .tab-pill.active)
    const activeAllPill = page
      .locator(".tab-pill.active")
      .filter({ hasText: /^all$/i })
      .first();

    await expect(activeAllPill).toBeVisible({ timeout: 8000 });
  });

  // ── 5. Workflow list or empty state visible on default "all" view ─────────
  test("page shows workflow list, loading skeleton, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 2: empty state message
    const hasEmptyState = await page
      .getByText(/no workflows|no n8n workflows|nothing here|connect n8n|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: workflow cards or list items
    const hasContent = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-lg']")
      .filter({ has: page.locator("h2, h3, p, span") })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 6. Clicking "active" filter pill switches state ─────────────────────
  test('clicking "active" filter pill becomes the active selection', async ({ page }) => {
    const activePill = page
      .locator(".tab-pill")
      .filter({ hasText: /^active$/i })
      .first();
    await expect(activePill).toBeVisible({ timeout: 8000 });

    await activePill.click();
    await page.waitForTimeout(500);

    // After click the active pill should now carry the .active class
    const isNowActive = await page
      .locator(".tab-pill.active")
      .filter({ hasText: /^active$/i })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(isNowActive).toBe(true);
  });

  // ── 7. No 404 or generic error state ─────────────────────────────────────
  test("n8n page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /N8N Workflows/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
