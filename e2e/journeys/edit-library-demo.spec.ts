/**
 * Edit Library Demo E2E — /dashboard/video-editor/edit-library-demo
 *
 * Tests the "start simple, reveal on demand" auto-edit reference flow.
 * Verifies:
 *   • Page loads without JS errors
 *   • Drop zone renders with expected text
 *   • File input for video upload is present
 *   • No 404 or generic error state
 *
 * Does NOT trigger actual analysis — only tests the initial "drop" step.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Edit Library Demo — Auto-Edit Flow", () => {
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
    await page.goto("/dashboard/video-editor/edit-library-demo");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1000);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("edit-library-demo page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/video-editor/edit-library-demo");
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

  // ── 2. Drop zone is visible with expected text ───────────────────────────
  test("renders drop zone with 'Drop your footage here' prompt", async ({ page }) => {
    const dropText = page.getByText(/drop your footage here/i).first();
    await expect(dropText).toBeVisible({ timeout: 8000 });

    const browseText = page.getByText(/browse files/i).first();
    await expect(browseText).toBeVisible({ timeout: 4000 });
  });

  // ── 3. File input for video upload is present in the DOM ─────────────────
  test("file input for video upload is present", async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="video"]');
    // Hidden but must exist in DOM so drag-and-drop and click both work
    expect(await fileInput.count()).toBeGreaterThan(0);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("edit-library-demo page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // Drop zone must be present — not a blank void
    const dropZone = page.getByText(/drop your footage|browse files/i).first();
    await expect(dropZone).toBeVisible({ timeout: 8000 });
  });
});
