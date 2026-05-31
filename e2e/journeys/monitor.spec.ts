/**
 * Monitor E2E — /dashboard/monitor
 *
 * Tests the System Monitor page, which displays uptime monitoring and
 * service health status indicators.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Uptime Monitor" + h1 "System Monitor"
 *   • Monitor content visible: status indicators, service list, or empty state
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against accounts with no monitors configured.
 * No monitors are created or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Monitor — Uptime Monitor", () => {
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
    await page.goto("/dashboard/monitor");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("monitor page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/monitor");
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
  test("renders editorial header with Uptime Monitor eyebrow and System Monitor h1", async ({ page }) => {
    const eyebrow = page.getByText(/Uptime Monitor/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /System Monitor/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Monitor content visible — status indicators, service list, or empty─
  test("page shows status indicators, service list, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 2: empty state message
    const hasEmptyState = await page
      .getByText(/no monitors|add a monitor|no services|nothing here|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: status indicators (up, down, operational, degraded)
    const hasStatusContent = await page
      .getByText(/up|down|operational|degraded|online|offline|healthy|status|uptime/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: service/monitor cards
    const hasCards = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-lg']")
      .filter({ has: page.locator("h2, h3, p, span") })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasStatusContent || hasCards).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("monitor page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /System Monitor/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 5. Dashboard sidebar navigation is intact ────────────────────────────
  test("dashboard sidebar navigation is visible on monitor page", async ({ page }) => {
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Page content references monitoring concepts ───────────────────────
  test("page content mentions monitoring, uptime, or service-related text", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasMonitorContent = await page
      .getByText(/monitor|uptime|status|service|health|online|check/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasMonitorContent).toBe(true);
  });
});
