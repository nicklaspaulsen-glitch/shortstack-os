/**
 * Enemy Tracker E2E — /dashboard/enemy-tracker
 *
 * Tests the Enemy Tracker (competitor/viral intelligence) page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Viral Intelligence" + h1 "Enemy Tracker"
 *   • Some competitor tracking content is visible: list, empty state, or add CTA
 *   • Add competitor button or CTA is present
 *   • Page never shows a blank void
 *   • No 404 or generic error state
 *
 * No competitors are added, tracked, or deleted in these tests.
 * The surface is inspected in read-only mode.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Enemy Tracker — Viral Intelligence", () => {
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
    await page.goto("/dashboard/enemy-tracker");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("enemy tracker page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/enemy-tracker");
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
  test("renders editorial header with Viral Intelligence eyebrow and Enemy Tracker h1", async ({ page }) => {
    const eyebrow = page.getByText(/Viral Intelligence/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Enemy Tracker/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Page shows tracking content, empty state, or loading skeleton ──────
  test("shows competitor list, empty state, or loading skeleton — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no competitor|add.*competitor|track.*competitor|no enemy|get started|no rivals/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/competitor|rival|viral|follower|engagement|views|TikTok|Instagram|YouTube/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 4. Add competitor CTA is present ─────────────────────────────────────
  test("add competitor button or CTA is visible", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasAddCta =
      (await page
        .getByRole("button", { name: /add.*competitor|add.*enemy|track.*competitor|add rival/i })
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .getByText(/add.*competitor|add.*enemy|track.*competitor|start tracking/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      // Empty-state CTA card
      (await page
        .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
        .filter({ has: page.getByText(/competitor|enemy|rival|track/i) })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasAddCta).toBe(true);
  });

  // ── 5. Page retains heading after load completes ─────────────────────────
  test("Enemy Tracker heading remains visible after full page load", async ({ page }) => {
    // Wait for async data fetches to settle
    await page.waitForTimeout(3000);

    const heading = page.getByRole("heading", { name: /Enemy Tracker/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("enemy tracker page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Enemy Tracker/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
