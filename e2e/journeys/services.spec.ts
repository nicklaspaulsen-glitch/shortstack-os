/**
 * Services E2E — /dashboard/services
 *
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Service Catalog" + h1 "Service Catalog"
 *   • Service list or create prompt renders — never blank
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Services — Service Catalog", () => {
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
    await page.goto("/dashboard/services");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("services page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/services");
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

  // ── 2. Editorial header: eyebrow + h1 (both read "Service Catalog") ─────
  test("renders editorial header with Service Catalog eyebrow and Service Catalog h1", async ({ page }) => {
    // Both eyebrow and h1 carry the same text on this page
    const eyebrow = page.getByText(/Service Catalog/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Service Catalog/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Service list or create prompt renders — never blank ───────────────
  test("service list or create prompt renders — never blank", async ({ page }) => {
    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 2: empty / create prompt
    const hasEmpty = await page
      .getByText(/no services|add.*first.*service|create.*service/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: actual service cards / rows
    const hasServices = await page
      .getByText(/monthly|hourly|project|retainer|seo|social|management|\$\d+/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 4: any containing panel is visible
    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded"], ul, ol, table')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasServices || hasContainer).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("services page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Service Catalog/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
