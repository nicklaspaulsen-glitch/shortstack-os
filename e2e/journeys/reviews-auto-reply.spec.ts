/**
 * Reviews Auto-Reply E2E — /dashboard/reviews/auto-reply
 *
 * Tests the AI auto-reply drafting sub-page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Reply Automation" + h1 "Review Auto-Reply"
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Reviews — AI Auto-Reply", () => {
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
    await page.goto("/dashboard/reviews/auto-reply");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("reviews/auto-reply loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/reviews/auto-reply");
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

  // ── 2. Editorial header renders ──────────────────────────────────────────
  test("renders Reply Automation eyebrow and Review Auto-Reply h1", async ({ page }) => {
    const eyebrow = page.getByText(/Reply Automation/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Review Auto-Reply/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. No 404 or generic error state ─────────────────────────────────────
  test("reviews/auto-reply does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Review Auto-Reply/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
