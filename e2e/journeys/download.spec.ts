/**
 * Download E2E — /dashboard/download
 *
 * Tests the Desktop App download page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Desktop App" + h1 "Download Trinity for Desktop"
 *   • At least one platform option or download button is visible (Windows/Mac/Linux)
 *   • Download links or CTA buttons are present and not broken
 *   • Page never shows a blank void
 *   • No 404 or generic error state
 *
 * No actual downloads are initiated in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Download — Desktop App", () => {
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
    await page.goto("/dashboard/download");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("download page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/download");
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
  test("renders editorial header with Desktop App eyebrow and Download Trinity for Desktop h1", async ({ page }) => {
    const eyebrow = page.getByText(/Desktop App/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Download Trinity for Desktop/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. At least one platform option is visible ───────────────────────────
  test("renders at least one platform download option: Windows, Mac, or Linux", async ({ page }) => {
    const hasPlatform =
      (await page
        .getByText(/Windows|macOS|Mac OS|Linux|Apple|x64|arm64|\.exe|\.dmg|\.AppImage/i)
        .first()
        .isVisible({ timeout: 6000 })
        .catch(() => false)) ||
      (await page
        .getByRole("button", { name: /download|Windows|macOS|Linux/i })
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .getByRole("link", { name: /download|Windows|macOS|Linux/i })
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false));

    expect(hasPlatform).toBe(true);
  });

  // ── 4. Download CTA is present ───────────────────────────────────────────
  test("download CTA button or link is present and visible", async ({ page }) => {
    const hasCta =
      (await page
        .getByRole("button", { name: /download/i })
        .first()
        .isVisible({ timeout: 6000 })
        .catch(() => false)) ||
      (await page
        .getByRole("link", { name: /download/i })
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .getByText(/download.*Trinity|get.*desktop|install.*desktop|download.*app/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false));

    expect(hasCta).toBe(true);
  });

  // ── 5. Page shows content — never blank ─────────────────────────────────
  test("page shows download content or loading skeleton — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/download|desktop|Trinity|platform|version|release/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("download page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Download Trinity for Desktop/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
