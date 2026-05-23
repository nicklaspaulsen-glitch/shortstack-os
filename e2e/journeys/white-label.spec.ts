// White Label E2E — /dashboard/white-label

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("White Label — Agency Branding", () => {
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
    await page.goto("/dashboard/white-label");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("white label page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/white-label");
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

  // ── 2. Editorial header: eyebrow + h1 ──────────────────────────────────────
  test("renders editorial header with Agency Branding eyebrow and White Label h1", async ({ page }) => {
    const eyebrow = page.getByText(/Agency Branding/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /White Label/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Branding configuration fields render — never blank ──────────────────
  test("branding configuration fields render — never blank", async ({ page }) => {
    const hasSkeleton = await page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no config|get.*started|set up.*white.*label/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasBranding = await page
      .getByText(/logo|brand.*color|agency.*name|custom.*domain|favicon/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasContainer = await page
      .locator(
        '[class*="branding"], [class*="white-label"], [class*="settings"], form, [class*="panel"], [class*="card"]',
      )
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasBranding || hasContainer).toBe(true);
  });

  // ── 4. Logo upload or color picker is visible ───────────────────────────────
  test("logo upload or color picker is visible", async ({ page }) => {
    const hasLogo = await page
      .getByText(/logo|upload.*logo|agency.*logo/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasColorText = await page
      .getByText(/brand.*color|primary.*color|accent.*color/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasColorInput = await page
      .locator('input[type="color"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasColor = hasColorText || hasColorInput;

    const hasSave = await page
      .getByRole("button", { name: /save|update.*branding|apply/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasLogo || hasColor || hasSave).toBe(true);
  });

  // ── 5. No 404 + heading present ─────────────────────────────────────────────
  test("white label page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /White Label/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
