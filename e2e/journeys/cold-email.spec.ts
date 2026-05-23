/**
 * Cold Email E2E — /dashboard/cold-email
 *
 * Tests the AI Cold Email page, which manages cold email campaigns
 * powered by AI-generated sequences.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Cold Email" + h1 "AI Cold Email"
 *   • "New Campaign" button is visible
 *   • Clicking "New Campaign" expands the create form with Campaign Name input
 *   • Campaign list, loading state, or empty state renders — never blank
 *   • No 404 or generic error state
 *
 * No campaigns are created or sent in these tests.
 * The create form is opened and immediately closed without submitting.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Cold Email — AI Cold Email", () => {
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
    await page.goto("/dashboard/cold-email");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow the initial campaign fetch to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("cold email page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/cold-email");
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
  test("renders editorial header with Cold Email eyebrow and AI Cold Email h1", async ({ page }) => {
    // Eyebrow — "Cold Email"
    const eyebrow = page.getByText(/^Cold Email$/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "AI Cold Email"
    const heading = page.getByRole("heading", { name: /AI Cold Email/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. New Campaign button is visible ────────────────────────────────────
  test("New Campaign button is visible", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /New Campaign/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Clicking New Campaign expands create form ─────────────────────────
  test("clicking New Campaign expands the create form with Campaign Name input", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /New Campaign/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 6000 });

    await newBtn.click();
    await page.waitForTimeout(400);

    // Form must appear with "Campaign Name" label and input
    const hasFormLabel = await page
      .getByText(/Campaign Name/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasInput = await page
      .locator('input[placeholder*="outreach"], input[placeholder*="campaign"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasFormLabel || hasInput).toBe(true);

    // Close by pressing Escape or clicking New Campaign button again (toggle)
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  // ── 5. Campaign list, loading, or empty state renders ───────────────────
  test("page shows campaign list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/No campaigns|no campaigns yet|create your first|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: campaign rows (status, leads, sent count)
    const hasCampaigns = await page
      .getByText(/active|paused|draft|leads|sent|open rate|sequence/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasCampaigns).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("cold email page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "AI Cold Email" heading must be visible instead
    const heading = page.getByRole("heading", { name: /AI Cold Email/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
