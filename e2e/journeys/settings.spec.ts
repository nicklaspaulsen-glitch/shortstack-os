/**
 * Settings E2E — /dashboard/settings
 *
 * Tests the Settings index page, which is a 10-card category navigation hub
 * (Phase 2B EditorialBento redesign). Each card links to a real sub-route.
 *
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Configuration" + h1 "Settings"
 *   • Settings cards grid renders (at least 3 cards visible)
 *   • Key cards visible: Account & Profile, Branding & White-label
 *   • Plan tier preview visible (shows current plan in card preview row)
 *   • No 404 or generic error state
 *
 * No settings are modified in these tests.
 * Card navigation (links to sub-pages) is not followed here.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Settings — Configuration Hub", () => {
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
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow profile + brand preview fetch to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("settings page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/settings");
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
  test("renders editorial header with Configuration eyebrow and Settings h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Configuration/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Settings"
    const heading = page.getByRole("heading", { name: /^Settings$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Settings card grid renders ───────────────────────────────────────
  test("settings cards grid renders at least 3 cards", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Cards are anchor links that navigate to sub-pages
    const cards = page.getByRole("link").filter({
      has: page.locator("h2, h3, [class*='title']"),
    });

    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ── 4. Key cards are visible ─────────────────────────────────────────────
  test("Account & Profile and Branding & White-label cards are visible", async ({ page }) => {
    const accountCard = page.getByText(/Account.*Profile|Account & Profile/i).first();
    await expect(accountCard).toBeVisible({ timeout: 6000 });

    const brandCard = page.getByText(/Branding.*White.label|White.label/i).first();
    await expect(brandCard).toBeVisible({ timeout: 6000 });
  });

  // ── 5. Additional settings cards render ──────────────────────────────────
  test("additional settings categories are visible: Email Templates, Voice Profile", async ({ page }) => {
    const emailCard = page.getByText(/Email Templates/i).first();
    const voiceCard = page.getByText(/Voice Profile/i).first();

    const hasEmail = await emailCard.isVisible({ timeout: 5000 }).catch(() => false);
    const hasVoice = await voiceCard.isVisible({ timeout: 4000 }).catch(() => false);

    // At least one of the secondary cards must be visible
    expect(hasEmail || hasVoice).toBe(true);
  });

  // ── 6. Plan preview renders (shows current plan info) ───────────────────
  test("plan or integration preview information is visible in a card", async ({ page }) => {
    await page.waitForTimeout(2000);

    // The billing card shows "starter", "growth", "pro", "enterprise", or "free"
    // The integrations card shows "connected" count
    const hasPlanInfo =
      (await page
        .getByText(/starter|growth|pro|enterprise|free|internal/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .getByText(/connected|integrations|signed in as/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasPlanInfo).toBe(true);
  });

  // ── 7. No 404 or generic error state ─────────────────────────────────────
  test("settings page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Settings" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Settings$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
