/**
 * Domains E2E — /dashboard/domains
 *
 * Tests the Domain Management page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Domain Management" + h1 "Domains"
 *   • Some domain content is visible: list, empty state, or connect domain button
 *   • Add/connect domain button or CTA is reachable
 *   • Page never shows a blank void
 *   • No 404 or generic error state
 *
 * No domains are added, transferred, or deleted in these tests.
 * The surface is inspected in read-only mode.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Domains — Domain Management", () => {
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
    await page.goto("/dashboard/domains");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("domains page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/domains");
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
  test("renders editorial header with Domain Management eyebrow and Domains h1", async ({ page }) => {
    const eyebrow = page.getByText(/Domain Management/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Domains$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Page shows content, empty state, or loading skeleton ─────────────
  test("page shows domain list, empty state, or loading skeleton — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no domains|add.*domain|connect.*domain|get started|no custom domain/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/\.com|\.io|\.net|\.org|SSL|verified|pending|active/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 4. Add or connect domain CTA is visible ──────────────────────────────
  test("add or connect domain button or CTA is visible", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasAddBtn =
      (await page
        .getByRole("button", { name: /add.*domain|connect.*domain|new domain|add domain/i })
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .getByText(/add.*domain|connect.*domain|add custom domain/i)
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    // Empty state pages may render a large CTA card instead of a button
    const hasCta = await page
      .locator("[class*='glass'], [class*='rounded-xl']")
      .filter({ has: page.getByText(/domain/i) })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasAddBtn || hasCta).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("domains page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Domains$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
