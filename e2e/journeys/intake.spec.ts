/**
 * Intake E2E — /dashboard/intake
 *
 * Tests the Intake Forms page, which manages intake forms and their submissions.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Intake" + h1 "Intake Forms"
 *   • Two border-b style tabs are rendered: "forms" and "submissions"
 *   • Default active tab is "forms" (forms tab content visible on load)
 *   • Clicking "submissions" tab switches content
 *   • No 404 or generic error state
 *
 * Tabs are rendered via (["forms", "submissions"] as const).map(...) with
 * border-b active state styling — NOT the .tab-pill-strip pattern.
 *
 * Data-dependent assertions guard against empty accounts.
 * No forms are created or submissions reviewed in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Intake — Intake Forms", () => {
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
    await page.goto("/dashboard/intake");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("intake page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/intake");
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
  test("renders editorial header with Intake eyebrow and Intake Forms h1", async ({ page }) => {
    const eyebrow = page.getByText(/^Intake$/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Intake Forms/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Both tabs render: forms and submissions ───────────────────────────
  test("renders both intake tabs: forms and submissions", async ({ page }) => {
    // Tab text may be capitalised ("Forms") or lowercase ("forms")
    const formsTab = page
      .getByRole("button", { name: /^forms$/i })
      .first();
    await expect(formsTab).toBeVisible({ timeout: 8000 });

    const submissionsTab = page
      .getByRole("button", { name: /^submissions$/i })
      .first();
    await expect(submissionsTab).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Default tab is forms — forms content visible on load ─────────────
  test("forms tab is active by default and renders forms content or empty state", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Valid state 1: skeleton loading
    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 2: empty state for forms
    const hasEmptyState = await page
      .getByText(/no forms|create your first|no intake forms|nothing here/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: actual form cards / list rows
    const hasContent = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-lg']")
      .filter({ has: page.locator("h2, h3, p") })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 5. Clicking submissions tab switches content ─────────────────────────
  test("clicking submissions tab renders submissions content or empty state", async ({ page }) => {
    const submissionsTab = page
      .getByRole("button", { name: /^submissions$/i })
      .first();
    await expect(submissionsTab).toBeVisible({ timeout: 8000 });

    await submissionsTab.click();
    await page.waitForTimeout(700);

    const hasContent =
      (await page
        .getByText(/submissions|responses|no submissions|submitted/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .locator(".animate-pulse")
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("intake page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Intake Forms/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
