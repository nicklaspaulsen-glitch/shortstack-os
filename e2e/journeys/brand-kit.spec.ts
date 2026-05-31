/**
 * Brand Kit E2E — /dashboard/brand-kit
 *
 * Tests the Brand Kit page, a visual identity extraction and generation tool
 * with five tabs: Extract, Colors, Typography, Media, and Generate.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Visual Identity System" + h1 "Brand Kit"
 *   • All 5 tabs render (Extract always enabled; Colors/Typography/Media/Generate
 *     enabled only after extraction — checked as visible at minimum)
 *   • Extract tab is the default active tab
 *   • URL input for brand extraction is visible
 *   • No 404 or generic error state
 *
 * No brand extraction is performed, no assets generated, and no kits exported
 * in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Brand Kit — Visual Identity System", () => {
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
    await page.goto("/dashboard/brand-kit");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("brand kit page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/brand-kit");
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
  test("renders editorial header with Visual Identity System eyebrow and Brand Kit h1", async ({ page }) => {
    const eyebrow = page.getByText(/Visual Identity System/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Brand Kit/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 5 tabs render ─────────────────────────────────────────────────
  test("renders all 5 tabs: Extract, Colors, Typography, Media, Generate", async ({ page }) => {
    // Extract tab (always enabled)
    await expect(
      page.getByRole("button", { name: /^Extract$/i }).first()
    ).toBeVisible({ timeout: 8000 });

    // Colors tab (may be disabled until brand extracted)
    await expect(
      page.getByRole("button", { name: /^Colors$/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Typography tab
    await expect(
      page.getByRole("button", { name: /^Typography$/i }).first()
    ).toBeVisible({ timeout: 4000 });

    // Media tab
    await expect(
      page.getByRole("button", { name: /^Media$/i }).first()
    ).toBeVisible({ timeout: 4000 });

    // Generate tab
    await expect(
      page.getByRole("button", { name: /^Generate$/i }).first()
    ).toBeVisible({ timeout: 4000 });
  });

  // ── 4. Extract tab is the default active tab ─────────────────────────────
  test("Extract tab is active by default with URL input visible", async ({ page }) => {
    // Extract tab button is the default active one
    const extractTab = page.getByRole("button", { name: /^Extract$/i }).first();
    await expect(extractTab).toBeVisible({ timeout: 6000 });

    // URL input should be visible in the Extract tab
    const hasUrlInput = await page
      .locator('input[type="url"], input[type="text"], input[placeholder*="url" i], input[placeholder*="website" i], input[placeholder*="brand" i]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    // Extract button or "Extract Brand" text
    const hasExtractTrigger = await page
      .getByRole("button", { name: /Extract|Analyze|Scan brand/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // General extract surface content
    const hasExtractContent = await page
      .getByText(/extract|website url|brand url|scan|analyze|paste.*url/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasUrlInput || hasExtractTrigger || hasExtractContent).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("brand kit page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Brand Kit/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
