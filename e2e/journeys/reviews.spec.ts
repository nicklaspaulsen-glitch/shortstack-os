/**
 * Reviews E2E — /dashboard/reviews
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Reviews — Reputation Management", () => {
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
    await page.goto("/dashboard/reviews");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("reviews page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/reviews");
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
  test("renders editorial header with Reputation Management eyebrow and Reviews h1", async ({ page }) => {
    const eyebrow = page.getByText(/Reputation Management/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Reviews$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Review Manager and Review Requests tabs render ───────────────────
  test("renders Review Manager and Review Requests tabs", async ({ page }) => {
    const managerTab = page.getByRole("button", { name: /Review Manager/i }).first();
    await expect(managerTab).toBeVisible({ timeout: 8000 });

    const requestsTab = page.getByRole("button", { name: /Review Requests/i }).first();
    await expect(requestsTab).toBeVisible({ timeout: 8000 });
  });

  // ── 4. Review stats render: rating, count, or reputation metrics ─────────
  test("review stats render: rating, count, or reputation metrics", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasRating = await page
      .getByText(/rating|average|stars|\d\.\d/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasCount = await page
      .getByText(/total.*reviews?|reviews?.*count|unreplied|critical/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasStats = await page
      .locator('[class*="font-display"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasRating || hasCount || hasStats).toBe(true);
  });

  // ── 5. Review list or empty state renders — never blank ──────────────────
  test("review list or empty state renders — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no reviews|no feedback|add.*google|get.*started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasReviewSentiment = await page
      .getByText(/5 star|4 star|3 star|negative|positive|excellent|great|good|poor/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasAvatar = await page
      .locator('img[alt*="avatar"], [class*="avatar"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl']")
      .filter({ has: page.locator("p, span, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasReviewSentiment || hasAvatar || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("reviews page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Reviews$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
