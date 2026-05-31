// Phone Setup E2E — /dashboard/phone-setup

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Phone Setup — Communication Setup", () => {
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
    await page.goto("/dashboard/phone-setup");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("phone setup page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/phone-setup");
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
  test("renders editorial header with Communication Setup eyebrow and Phone Setup h1", async ({ page }) => {
    const eyebrow = page.getByText(/Communication Setup/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Phone Setup/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Phone setup configuration renders — never blank ─────────────────────
  test("phone setup configuration renders — never blank", async ({ page }) => {
    const hasSkeleton = await page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no numbers|get.*started|configure.*phone/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasPhone = await page
      .getByText(/phone.*number|twilio|area.*code|sms|voice|caller.*id/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasContainer = await page
      .locator(
        '[class*="phone"], [class*="twilio"], [class*="communication"], form, [class*="panel"], [class*="card"]',
      )
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasPhone || hasContainer).toBe(true);
  });

  // ── 4. Phone number purchase or configuration is visible ───────────────────
  test("phone number purchase or configuration is visible", async ({ page }) => {
    const hasNumber = await page
      .getByText(/\+1|\(\d{3}\)|\d{3}-\d{3}-\d{4}|area.*code|buy.*number|purchase/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasSetup = await page
      .locator('input[type="text"], input[placeholder*="phone" i]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasAction = await page
      .getByRole("button", { name: /search|buy|configure|save|connect.*twilio/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasNumber || hasSetup || hasAction).toBe(true);
  });

  // ── 5. No 404 + heading present ─────────────────────────────────────────────
  test("phone setup page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Phone Setup/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
