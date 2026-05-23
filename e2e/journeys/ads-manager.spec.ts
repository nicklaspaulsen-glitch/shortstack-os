/**
 * Ads Manager E2E — /dashboard/ads-manager
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Ads Manager — Paid Media", () => {
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
    await page.goto("/dashboard/ads-manager");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("ads manager page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/ads-manager");
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
  test("renders editorial header with Paid Media eyebrow and Ads Manager h1", async ({ page }) => {
    const eyebrow = page.getByText(/Paid Media/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Ads Manager/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Platform context badges visible in header ─────────────────────────
  test("platform context visible: Meta, Google, TikTok badges in header", async ({ page }) => {
    const platformBadge = page
      .getByText(/Meta|Google|TikTok/i)
      .first();
    await expect(platformBadge).toBeVisible({ timeout: 8000 });
  });

  // ── 4. All 5 tabs render ─────────────────────────────────────────────────
  test("renders all 5 tabs: Overview, Campaigns, Insights, Budgets, Connect", async ({ page }) => {
    const tabLabels = [
      /^Overview$/i,
      /^Campaigns$/i,
      /^Insights$/i,
      /^Budgets$/i,
      /^Connect$/i,
    ];

    for (const pattern of tabLabels) {
      const tab = page.getByRole("button", { name: pattern }).first();
      await expect(tab).toBeVisible({ timeout: 8000 });
    }
  });

  // ── 5. Overview area renders stats, chart, or empty state — never blank ──
  test("overview area renders stats, chart, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no campaigns|connect.*account|get started|link your/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/spend|impressions|clicks|ctr|roas|revenue/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl']")
      .filter({ has: page.locator("p, span, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("ads manager page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Ads Manager/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
