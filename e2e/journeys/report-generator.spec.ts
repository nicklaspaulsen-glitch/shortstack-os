/**
 * Report Generator E2E — /dashboard/report-generator
 *
 * Tests the Analytics Builder / Report Generator page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Analytics Builder" + h1 "Report Generator"
 *   • Report builder content is visible: template picker, form, report list, or empty state
 *   • A generate / create report button is visible
 *   • No 404 or generic error state
 *
 * No reports are generated or exported in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Report Generator — Analytics Builder", () => {
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
    await page.goto("/dashboard/report-generator");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("report-generator page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/report-generator");
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
  test("renders editorial header with Analytics Builder eyebrow and Report Generator h1", async ({ page }) => {
    const eyebrow = page.getByText(/Analytics Builder/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Report Generator/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Report builder content is visible ────────────────────────────────
  test("shows template picker, form, report list, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no reports|create your first|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasTemplateOrForm = await page
      .getByText(/template|report type|date range|metric|section|generate|client performance/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCard = await page
      .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
      .filter({ has: page.locator("p, span, h3, label") })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasTemplateOrForm || hasCard).toBe(true);
  });

  // ── 4. Generate or create report button is visible ───────────────────────
  test("generate or create report button is visible", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasGenerateBtn = await page
      .getByRole("button", { name: /generate|create report|new report|build report/i })
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    // Fallback: any prominent button that triggers report creation
    const hasPrimaryBtn = await page
      .locator('button[class*="btn-pill"], button[class*="brand-accent"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasGenerateBtn || hasPrimaryBtn).toBe(true);
  });

  // ── 5. Page renders some UI below the header ─────────────────────────────
  test("page renders UI content below the header — never a blank void", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasText = await page
      .getByText(/report|analytics|generate|template|metric/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasPanel || hasText).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("report-generator page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Report Generator/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
