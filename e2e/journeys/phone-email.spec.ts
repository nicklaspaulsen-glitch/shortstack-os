// Phone & Email Sender Management E2E — /dashboard/phone-email

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Phone & Email — Contact Channels / Sender Management", () => {
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
    await page.goto("/dashboard/phone-email");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("phone-email page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/phone-email");
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
  test("renders editorial header with Contact Channels eyebrow and Sender Management h1", async ({ page }) => {
    const eyebrow = page.getByText(/Contact Channels/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Sender Management/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Sender configuration renders — never blank ──────────────────────────
  test("sender configuration renders — never blank", async ({ page }) => {
    const hasSkeleton = await page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no senders|add.*first|configure.*sender/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasSenders = await page
      .getByText(/from.*name|from.*email|reply.*to|email.*domain|verified|unverified/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasContainer = await page
      .locator(
        '[class*="sender"], [class*="email"], [class*="domain"], form, [class*="panel"], [class*="card"], table',
      )
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasSenders || hasContainer).toBe(true);
  });

  // ── 4. Email domain or sender email input is visible ───────────────────────
  test("email domain or sender email input is visible", async ({ page }) => {
    const hasEmailInput = await page
      .locator(
        'input[type="email"], input[placeholder*="email" i], input[placeholder*="from" i]',
      )
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasDomain = await page
      .getByText(/domain|spf|dkim|verified|email.*verification/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasAction = await page
      .getByRole("button", { name: /add.*sender|verify|connect|save/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasEmailInput || hasDomain || hasAction).toBe(true);
  });

  // ── 5. No 404 + heading present ─────────────────────────────────────────────
  test("phone-email page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Sender Management/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
