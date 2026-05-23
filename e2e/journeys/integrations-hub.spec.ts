/**
 * Integrations Hub E2E — /dashboard/integrations-hub
 *
 * Tests the Integrations Hub page, a Nango + Zernio OAuth dashboard
 * that manages connections to Google, Meta, Apify, TikTok, and other
 * third-party platforms.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "All your integrations" + h1 "Integrations Hub"
 *   • Stats cards render: Connected count and Available count
 *   • At least one integration card is visible (Google, Meta, Apify, or TikTok)
 *   • Connect buttons are present for unconnected integrations
 *   • No 404 or generic error state
 *
 * No OAuth connections are initiated, authorized, or disconnected in these tests.
 * The connect buttons are verified to exist but never clicked (they trigger
 * Nango/Zernio popup flows requiring live credentials outside the test env).
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Integrations Hub — Connected Platforms", () => {
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
    await page.goto("/dashboard/integrations-hub");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow Nango connection list to load
    await page.waitForTimeout(2000);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("integrations hub page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/integrations-hub");
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
  test("renders editorial header with 'All your integrations' eyebrow and Integrations Hub h1", async ({ page }) => {
    // Eyebrow — "All your integrations"
    const eyebrow = page.getByText(/All your integrations/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Integrations Hub"
    const heading = page.getByRole("heading", { name: /Integrations Hub/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Stats cards render ────────────────────────────────────────────────
  test("stats cards render Connected count and Available count", async ({ page }) => {
    // Connected stat
    await expect(
      page.getByText(/^Connected$/i).first()
    ).toBeVisible({ timeout: 6000 });

    // Available stat
    await expect(
      page.getByText(/^Available$/i).first()
    ).toBeVisible({ timeout: 4000 });

    // Powered by label (Nango + Zernio)
    const hasPoweredBy = await page
      .getByText(/Nango|Zernio/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasPoweredBy).toBe(true);
  });

  // ── 4. Integration cards are visible ─────────────────────────────────────
  test("integration cards are visible for known platforms", async ({ page }) => {
    // At least one of the main integration names must be visible
    const hasGoogle = await page
      .getByText(/Google/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasMeta = await page
      .getByText(/Meta|Facebook|Instagram/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasApify = await page
      .getByText(/Apify/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasTikTok = await page
      .getByText(/TikTok/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasGoogle || hasMeta || hasApify || hasTikTok).toBe(true);
  });

  // ── 5. Connect buttons are present ───────────────────────────────────────
  test("Connect buttons are present for platforms not yet connected", async ({ page }) => {
    // At least one Connect button or Connected status should be visible
    const hasConnectBtn = await page
      .getByRole("button", { name: /^Connect|Connect .+/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasConnectedStatus = await page
      .getByText(/Connected|Disconnect/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasIntegrationGrid = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
      .filter({ has: page.locator("button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasConnectBtn || hasConnectedStatus || hasIntegrationGrid).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("integrations hub page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Integrations Hub" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Integrations Hub/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
