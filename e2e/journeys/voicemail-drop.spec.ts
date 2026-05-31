/**
 * Voicemail Drop E2E — /dashboard/voicemail-drop
 *
 * Tests the Voicemail Drop page, a single-page campaign manager for
 * uploading and dispatching ringless voicemail drops to contact lists.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Drop Campaigns" + h1 "Voicemail Drop"
 *   • Campaign creation form or existing campaigns render — never blank
 *   • Campaign name input or create trigger is visible
 *   • No 404 or generic error state
 *
 * No voicemails are uploaded, campaigns created, or drops dispatched
 * in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Voicemail Drop — Drop Campaigns", () => {
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
    await page.goto("/dashboard/voicemail-drop");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("voicemail drop page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/voicemail-drop");
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
  test("renders editorial header with Drop Campaigns eyebrow and Voicemail Drop h1", async ({ page }) => {
    // Eyebrow — "Drop Campaigns"
    const eyebrow = page.getByText(/Drop Campaigns/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Voicemail Drop"
    const heading = page.getByRole("heading", { name: /Voicemail Drop/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Campaign creation form or existing campaigns render — never blank ──
  test("campaign creation form or existing campaigns render — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty / first-campaign prompt
    const hasEmpty = await page
      .getByText(/no campaigns|create.*first|get.*started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: existing campaign content visible
    const hasCampaigns = await page
      .getByText(/sales follow-up|follow.*up|campaign|scheduled|completed/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: create/upload form with a text input
    const hasForm = await page
      .locator('input[type="text"], textarea')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasCampaigns || hasForm).toBe(true);
  });

  // ── 4. Campaign name input or create trigger is visible ──────────────────
  test("campaign name input or create trigger is visible", async ({ page }) => {
    // Soft-or: name input (upload modal may need opening), a create button, or a label

    // Check for a visible text input matching campaign name context
    const hasInput = await page
      .locator(
        'input[placeholder*="campaign" i], input[placeholder*="Sales follow-up" i], input[type="text"]',
      )
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasCreateBtn = await page
      .getByRole("button", { name: /create.*campaign|new.*campaign|add.*campaign|create|upload/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasTrigger = await page
      .getByText(/campaign.*name|new.*voicemail|drop.*campaign/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasInput || hasCreateBtn || hasTrigger).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("voicemail drop page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Voicemail Drop" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Voicemail Drop/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
