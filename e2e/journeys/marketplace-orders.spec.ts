// Marketplace Orders E2E — /dashboard/marketplace/orders

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Marketplace Orders — Order History", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping authenticated tests");
    test.setTimeout(200_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tour_completed", "true");
        localStorage.setItem("cookie-consent", "accepted");
      } catch {}
    });
    await page.goto("/dashboard/marketplace/orders");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("marketplace orders page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/marketplace/orders");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const filtered = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection") &&
        !e.includes("hydration"),
    );
    expect(filtered).toHaveLength(0);
  });

  // ── 2. Editorial header: eyebrow + h1 ──────────────────────────────────────
  test("renders editorial header with Order History eyebrow and Marketplace Orders h1", async ({ page }) => {
    const eyebrow = page.getByText(/Order History/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Marketplace Orders/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Order list or empty state renders — never blank ─────────────────────
  test("order list or empty state is visible — never blank", async ({ page }) => {
    const hasSkeleton = await page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no orders|no purchases|nothing here|get started|browse marketplace/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasOrders = await page
      .locator('[class*="order"], table tbody tr, [class*="card"], [class*="row"]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasOrders).toBe(true);
  });

  // ── 4. No 404 or error state ────────────────────────────────────────────────
  test("marketplace orders does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /orders/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 5. Order status values render with readable text (if orders exist) ──────
  test("order status badges render with readable text when orders are present", async ({ page }) => {
    await page.waitForTimeout(1000);

    const statusBadges = page.getByText(/pending|completed|processing|cancelled|refunded|paid/i);
    const count = await statusBadges.count();

    if (count > 0) {
      const text = await statusBadges.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
    // If 0 orders, test passes — covered by the empty-state test above
  });
});
