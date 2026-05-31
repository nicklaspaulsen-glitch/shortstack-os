// Marketplace Listings E2E — /dashboard/marketplace/listings

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Marketplace Listings — Active Listings", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping authenticated tests");
    test.setTimeout(200_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tour_completed", "true");
        localStorage.setItem("cookie-consent", "accepted");
      } catch {}
    });
    await page.goto("/dashboard/marketplace/listings");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("marketplace listings page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/marketplace/listings");
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
  test("renders editorial header with Active Listings eyebrow and My Listings h1", async ({ page }) => {
    const eyebrow = page.getByText(/Active Listings/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /My Listings/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Listing grid or empty state renders — never blank ────────────────────
  test("listing grid or empty state is visible — never blank", async ({ page }) => {
    const hasSkeleton = await page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no listings|create.*listing|add.*listing|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasListings = await page
      .locator('[class*="listing"], [class*="card"], [class*="grid"] > *, table tbody tr')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasListings).toBe(true);
  });

  // ── 4. Create listing button is visible ────────────────────────────────────
  test("create listing button is visible on the page", async ({ page }) => {
    const createBtn = page
      .getByRole("button", { name: /create listing|new listing|add listing|create|new/i })
      .first();

    const isVisible = await createBtn.isVisible({ timeout: 6000 }).catch(() => false);

    // Fallback: look for a link with similar text
    const createLink = page
      .getByRole("link", { name: /create listing|new listing|add listing/i })
      .first();
    const linkVisible = await createLink.isVisible({ timeout: 3000 }).catch(() => false);

    expect(isVisible || linkVisible).toBe(true);
  });

  // ── 5. No 404 or error state ────────────────────────────────────────────────
  test("marketplace listings does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /listings/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
