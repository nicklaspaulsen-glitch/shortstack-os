/**
 * Invoice Templates E2E — /dashboard/invoice-templates
 *
 * Tests the Invoice Templates page, which displays saved invoice templates.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Saved Templates" + h1 "Invoice Templates"
 *   • Template list OR skeleton loading state OR empty state is visible (never blank)
 *   • A create/add button is visible
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against empty accounts.
 * No templates are created or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Invoice Templates — Saved Templates", () => {
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
    await page.goto("/dashboard/invoice-templates");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("invoice-templates page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/invoice-templates");
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
  test("renders editorial header with Saved Templates eyebrow and Invoice Templates h1", async ({ page }) => {
    const eyebrow = page.getByText(/Saved Templates/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Invoice Templates/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Template list, skeleton, or empty state visible — never blank ─────
  test("page shows template list, loading skeleton, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 2: empty state message
    const hasEmptyState = await page
      .getByText(/no templates|create your first|no invoice templates|nothing here/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: template card content
    const hasContent = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-lg']")
      .filter({ has: page.locator("h2, h3, p, span") })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 4. Create / add template button is visible ───────────────────────────
  test("a create or add template button is visible", async ({ page }) => {
    // Various possible button labels for the create action
    const createBtn =
      page.getByRole("button", { name: /new template|create template|add template/i }).first();

    const createLink =
      page.getByRole("link", { name: /new template|create template|add template/i }).first();

    const hasCreateBtn = await createBtn.isVisible({ timeout: 6000 }).catch(() => false);
    const hasCreateLink = await createLink.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasCreateBtn || hasCreateLink).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("invoice-templates page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Invoice Templates/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Dashboard sidebar navigation is intact ────────────────────────────
  test("dashboard sidebar navigation is visible on invoice-templates page", async ({ page }) => {
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible({ timeout: 8000 });
  });
});
