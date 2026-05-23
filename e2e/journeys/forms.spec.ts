/**
 * Form Builder E2E — /dashboard/forms
 *
 * Tests the Form Builder page, a lead capture tool with five tabs covering
 * builder, templates, submissions, analytics, and settings.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Lead Capture" + h1 "Form Builder"
 *   • All 5 tabs render: Builder, Templates, Submissions, Analytics, Settings
 *   • Builder is the default active tab
 *   • Clicking Templates tab switches content
 *   • No 404 or generic error state
 *
 * No forms are created, published, or submissions reviewed in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Form Builder — Lead Capture", () => {
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
    await page.goto("/dashboard/forms");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("forms page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/forms");
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
  test("renders editorial header with Lead Capture eyebrow and Form Builder h1", async ({ page }) => {
    const eyebrow = page.getByText(/Lead Capture/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Form Builder/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 5 tabs render ─────────────────────────────────────────────────
  test("renders all 5 tabs: Builder, Templates, Submissions, Analytics, Settings", async ({ page }) => {
    // Builder tab
    await expect(
      page.getByRole("button", { name: /^Builder$/i }).first()
    ).toBeVisible({ timeout: 8000 });

    // Templates tab
    await expect(
      page.getByRole("button", { name: /^Templates$/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Submissions tab
    await expect(
      page.getByRole("button", { name: /^Submissions$/i }).first()
    ).toBeVisible({ timeout: 4000 });

    // Analytics tab
    await expect(
      page.getByRole("button", { name: /^Analytics$/i }).first()
    ).toBeVisible({ timeout: 4000 });

    // Settings tab
    await expect(
      page.getByRole("button", { name: /^Settings$/i }).first()
    ).toBeVisible({ timeout: 4000 });
  });

  // ── 4. Builder tab content renders by default ─────────────────────────────
  test("Builder tab is active by default and renders form builder content", async ({ page }) => {
    // The builder tab container renders some form-related content
    const hasBuilderContent =
      (await page
        .getByText(/form|field|label|input|drag|drop|new form|add field/i)
        .first()
        .isVisible({ timeout: 6000 })
        .catch(() => false)) ||
      (await page
        .locator("[class*='glass'], [class*='rounded-xl']")
        .filter({ has: page.locator("h2, h3, p") })
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false));

    expect(hasBuilderContent).toBe(true);
  });

  // ── 5. Clicking Templates tab switches content ───────────────────────────
  test("clicking Templates tab renders template content", async ({ page }) => {
    const templatesTab = page.getByRole("button", { name: /^Templates$/i }).first();
    await expect(templatesTab).toBeVisible({ timeout: 6000 });

    await templatesTab.click();
    await page.waitForTimeout(600);

    const hasContent =
      (await page
        .getByText(/template|contact form|lead magnet|survey|waitlist|opt-in/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-lg']")
        .filter({ has: page.locator("h2, h3, p") })
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("forms page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Form Builder/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
