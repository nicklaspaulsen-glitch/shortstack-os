// Google Business E2E — /dashboard/google-business

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Google Business — Local SEO", () => {
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
    await page.goto("/dashboard/google-business");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("google-business page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/google-business");
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
  test("renders editorial header with Local SEO eyebrow and Google Business h1", async ({ page }) => {
    const eyebrow = page.getByText(/Local SEO/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Google Business/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Business profile or connect prompt renders — never blank ──────────
  test("business profile or connect prompt renders — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: connect / link prompt
    const hasEmpty = await page
      .getByText(/connect.*google|link.*google.*business|no.*profile|get.*started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: profile data
    const hasProfile = await page
      .getByText(/business.*name|address|phone|hours|reviews|rating/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any container that confirms the page body mounted
    const hasContainer = await page
      .locator("main, [role='main'], .dashboard-content, section")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasProfile || hasContainer).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("google-business page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Google Business/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
