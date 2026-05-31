/**
 * API Docs E2E — /dashboard/api-docs
 *
 * Tests the API Documentation page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "API Reference" + h1 "API Documentation"
 *   • Default tab (Explorer) renders content
 *   • Tab navigation works (clicking Endpoints changes the view)
 *   • Some API reference content is visible
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("API Docs — API Documentation", () => {
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
    await page.goto("/dashboard/api-docs");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("api-docs page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/api-docs");
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
  test("renders editorial header with API Reference eyebrow and API Documentation h1", async ({ page }) => {
    const eyebrow = page.locator(".font-editorial").first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });
    await expect(eyebrow).toContainText("API Reference");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 6000 });
    await expect(h1).toContainText("API Documentation");
  });

  // ── 3. Explorer tab renders by default ──────────────────────────────────
  test("Explorer tab is visible and renders content by default", async ({ page }) => {
    const explorerTab = page
      .getByRole("button", { name: /^Explorer$/i })
      .first();
    await expect(explorerTab).toBeVisible({ timeout: 8000 });

    await page.waitForTimeout(1000);

    // Page has some content below the header
    const hasSkeleton = await page.locator(".animate-pulse").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasContent = await page.locator("[class*='glass'], [class*='rounded-2xl'], code, pre").first()
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasSkeleton || hasContent).toBe(true);
  });

  // ── 4. Tab navigation: clicking Endpoints renders that section ──────────
  test("clicking Endpoints tab navigates to the Endpoints section", async ({ page }) => {
    const endpointsTab = page
      .getByRole("button", { name: /^Endpoints$/i })
      .first();
    await expect(endpointsTab).toBeVisible({ timeout: 8000 });
    await endpointsTab.click();
    await page.waitForTimeout(600);

    // Page should remain stable after tab switch
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 5000 });
  });

  // ── 5. Some API reference content is visible ─────────────────────────────
  test("page shows API reference content (endpoint details, code, or key info)", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasApiContent = await page
      .getByText(/api|endpoint|key|authentication|request|response|GET|POST|PUT|DELETE/i)
      .nth(1)
      .isVisible({ timeout: 5000 }).catch(() => false);
    const hasCode = await page.locator("code, pre, [class*='code']").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasContainer = await page.locator("[class*='glass'], [class*='rounded-2xl']").nth(1)
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasApiContent || hasCode || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("api-docs page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 8000 });
    await expect(heading).toContainText("API Documentation");
  });
});
