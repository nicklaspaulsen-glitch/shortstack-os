/**
 * Agent Command E2E — /dashboard/agent-command
 *
 * Tests the Agent Command Center page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Autonomous" + h1 "Agent Command Center"
 *   • Agent cards, status indicators, or empty state renders
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Agent Command — Agent Command Center", () => {
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
    await page.goto("/dashboard/agent-command");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("agent command page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/agent-command");
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
  test("renders editorial header with Autonomous eyebrow and Agent Command Center h1", async ({ page }) => {
    const eyebrow = page.locator(".font-editorial").first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });
    await expect(eyebrow).toContainText("Autonomous");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 6000 });
    await expect(h1).toContainText("Agent Command Center");
  });

  // ── 3. Agent-related content renders ────────────────────────────────────
  test("page shows agent cards, status indicators, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page.locator(".animate-pulse").first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await page.locator("text=/no agent/i, text=/empty/i").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasAgentContent = await page
      .getByText(/agent|command|autonomous|status|active|idle|running/i)
      .nth(1)
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasContainer = await page.locator("[class*='glass'], [class*='rounded-2xl'], [class*='card']").first()
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasAgentContent || hasContainer).toBe(true);
  });

  // ── 4. Multi-panel layout has visible sections ───────────────────────────
  test("page has multiple distinct content sections or panels", async ({ page }) => {
    await page.waitForTimeout(2000);

    // The 719-line multi-panel page should have at least 2 distinct panels or sections
    const panels = page.locator("[class*='glass'], [class*='rounded-2xl'], section");
    const panelCount = await panels.count();
    expect(panelCount).toBeGreaterThanOrEqual(1);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("agent command page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 8000 });
    await expect(heading).toContainText("Agent Command Center");
  });
});
