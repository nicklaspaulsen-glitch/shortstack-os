/**
 * Voice Receptionist E2E — /dashboard/voice-receptionist
 *
 * Tests the AI Voice Receptionist page, a single-page configuration surface
 * covering phone number setup, ElevenLabs voice agent, stats, and call log.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Beta" + h1 "AI Voice Receptionist"
 *   • Stats, call log, or empty/setup state renders — never blank
 *   • Phone configuration or voice setup is visible
 *   • No 404 or generic error state
 *
 * No calls are initiated, phone numbers configured, or ElevenLabs agents
 * created in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Voice Receptionist — AI Voice Receptionist", () => {
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
    await page.goto("/dashboard/voice-receptionist");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("voice receptionist page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/voice-receptionist");
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
  test("renders editorial header with Beta eyebrow and AI Voice Receptionist h1", async ({ page }) => {
    // Eyebrow — "Beta"
    const eyebrow = page.getByText(/^Beta$/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "AI Voice Receptionist"
    const heading = page.getByRole("heading", { name: /AI Voice Receptionist/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Stats, call log, or setup state renders — never blank ────────────
  test("receptionist stats or call log renders — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty / setup prompt
    const hasEmpty = await page
      .getByText(/no calls|set up.*receptionist|connect.*phone|waiting.*first.*call/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: real stats visible
    const hasStats = await page
      .getByText(/handled|booked|duration|calls/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: call log table rendered
    const hasLog = await page
      .locator('table, [role="table"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasStats || hasLog).toBe(true);
  });

  // ── 4. Phone configuration or voice setup is visible ────────────────────
  test("phone configuration or voice setup is visible", async ({ page }) => {
    // Soft-or: at least one of phone config, voice/ElevenLabs, or a save/connect button
    const hasPhone = await page
      .getByText(/phone.*number|inbound.*number|twilio|configure/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasVoice = await page
      .getByText(/voice|elevenlabs|agent.*name|receptionist.*name/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasSetup = await page
      .getByRole("button", { name: /save|connect|configure|setup/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasPhone || hasVoice || hasSetup).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("voice receptionist page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "AI Voice Receptionist" heading must be visible instead
    const heading = page.getByRole("heading", { name: /AI Voice Receptionist/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
