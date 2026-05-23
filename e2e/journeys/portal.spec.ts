/**
 * Client Portal E2E — /dashboard/portal
 *
 * Tests the Client Portal page. This page intentionally does NOT follow the
 * standard editorial eyebrow/h1 pattern. Instead it renders:
 *   • h1 "Welcome back, {name}" (authenticated client) OR
 *     h1 "Welcome to Trinity" (unauthenticated / fallback)
 *   • Navigation links to portal sections: leads, outreach, socials, content, reports
 *
 * Verifies:
 *   • Page loads without JS errors
 *   • An h1 containing "Welcome" is visible
 *   • Portal navigation links (leads / outreach / socials / content / reports) exist
 *   • No 404 or generic error state
 *
 * No portal data is modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Client Portal — Portal Home", () => {
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
    await page.goto("/dashboard/portal");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("portal page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/portal");
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

  // ── 2. h1 with "Welcome" text is visible ────────────────────────────────
  test("renders an h1 with Welcome text", async ({ page }) => {
    await expect(
      page.locator("h1").filter({ hasText: /Welcome/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 3. Portal navigation links exist ────────────────────────────────────
  test("portal navigation links are visible (leads, outreach, socials, content, or reports)", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasLeads = await page
      .getByRole("link", { name: /leads/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasOutreach = await page
      .getByRole("link", { name: /outreach/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasSocials = await page
      .getByRole("link", { name: /socials/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasContent = await page
      .getByRole("link", { name: /content/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasReports = await page
      .getByRole("link", { name: /reports/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasLeads || hasOutreach || hasSocials || hasContent || hasReports).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("portal page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    await expect(
      page.locator("h1").filter({ hasText: /Welcome/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 5. Page body renders content below the welcome heading ───────────────
  test("page renders body content below the welcome heading — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasLinks = await page
      .getByRole("link")
      .nth(1)
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasLinks || hasPanel).toBe(true);
  });
});
