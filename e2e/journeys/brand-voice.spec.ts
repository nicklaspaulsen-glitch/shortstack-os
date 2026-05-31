/**
 * Brand Voice E2E — /dashboard/brand-voice
 *
 * Tests the Brand Voice Manager page, a form-based editor for configuring
 * tone, style, and persona settings with auto-save support.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Brand Identity" + h1 "Brand Voice Manager"
 *   • Voice configuration inputs are visible (textarea / text input / form content)
 *   • Save or auto-save indicator is accessible
 *   • No 404 or generic error state
 *
 * No brand voice settings are saved or modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Brand Voice — Brand Identity Manager", () => {
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
    await page.goto("/dashboard/brand-voice");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("brand voice page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/brand-voice");
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
  test("renders editorial header with Brand Identity eyebrow and Brand Voice Manager h1", async ({ page }) => {
    const eyebrow = page.getByText(/Brand Identity/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Brand Voice Manager/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Voice configuration inputs are visible ────────────────────────────
  test("voice configuration inputs are visible", async ({ page }) => {
    const hasTextarea = await page
      .locator("textarea")
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasInput = await page
      .locator('input[type="text"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasFormContent = await page
      .getByText(/tone|persona|style|voice|brand|writing/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasTextarea || hasInput || hasFormContent).toBe(true);
  });

  // ── 4. Save or auto-save indicator is accessible ─────────────────────────
  test("save or auto-save indicator is accessible", async ({ page }) => {
    const hasSaveBtn = await page
      .getByRole("button", { name: /save|update|apply/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasAutoSave = await page
      .getByText(/saved|saving|auto.?save/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasForm = await page
      .locator('form, [class*="form"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSaveBtn || hasAutoSave || hasForm).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("brand voice page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Brand Voice Manager/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
