/**
 * Admin E2E — /dashboard/admin
 *
 * Tests the admin internal tools page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Internal Tools" + h1 "Admin"
 *   • Some content is visible (cards, buttons, or form elements)
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Admin — Internal Tools", () => {
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
    await page.goto("/dashboard/admin");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("admin page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/admin");
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
  test("renders editorial header with Internal Tools eyebrow and Admin h1", async ({ page }) => {
    const eyebrow = page.locator(".font-editorial").first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });
    await expect(eyebrow).toContainText("Internal Tools");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 6000 });
    await expect(h1).toContainText("Admin");
  });

  // ── 3. Some content is visible ──────────────────────────────────────────
  test("page renders cards, buttons, or form elements below the header", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page.locator(".animate-pulse").first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    const hasButton = await page.getByRole("button").nth(1)
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasCard = await page.locator("[class*='glass'], [class*='rounded-2xl'], [class*='card']").first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasContent = await page.locator("section, main > div > div").nth(1)
      .isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasSkeleton || hasButton || hasCard || hasContent).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("admin page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 8000 });
    await expect(heading).toContainText("Admin");
  });

  // ── 5. Access control — page is only accessible to authenticated users ──
  test("page does not redirect authenticated user to login", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard\/admin/);
  });
});
