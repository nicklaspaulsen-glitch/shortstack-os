/**
 * Meetings E2E — /dashboard/meetings
 *
 * Tests the Meetings page, a single-page appointment tracker with AI
 * notetaking (Whisper transcription + Claude action-item extraction).
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Appointment Tracker" + h1 "Meetings"
 *   • Meeting creation form or list renders — never blank
 *   • Meeting title input or create action is accessible
 *   • No 404 or generic error state
 *
 * No meetings are created, recordings uploaded, or URLs ingested in
 * these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Meetings — Appointment Tracker", () => {
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
    await page.goto("/dashboard/meetings");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("meetings page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/meetings");
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
  test("renders editorial header with Appointment Tracker eyebrow and Meetings h1", async ({ page }) => {
    // Eyebrow — "Appointment Tracker"
    const eyebrow = page.getByText(/Appointment Tracker/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Meetings"
    const heading = page.getByRole("heading", { name: /^Meetings$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Meeting creation form or list renders — never blank ───────────────
  test("meeting creation form or list renders — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty / first-meeting prompt
    const hasEmpty = await page
      .getByText(/no meetings|no appointments|schedule.*first|add.*first/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: existing meeting content visible
    const hasMeetings = await page
      .getByText(/strategy.*kickoff|kickoff|meeting|appointment|confirmed|pending|upcoming/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: quick-create form with a text input
    const hasForm = await page
      .locator('input[type="text"], input[placeholder*="Title" i]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasMeetings || hasForm).toBe(true);
  });

  // ── 4. Meeting title input or create action is accessible ────────────────
  test("meeting title input or create action is accessible", async ({ page }) => {
    // Soft-or: title input from the quick-create form, a create/schedule button

    const hasTitleInput = await page
      .locator(
        'input[placeholder*="Title" i], input[placeholder*="strategy kickoff" i], input[placeholder*="meeting" i]',
      )
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasCreateBtn = await page
      .getByRole("button", { name: /add.*meeting|new.*meeting|create.*meeting|schedule|add/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasTitleInput || hasCreateBtn).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("meetings page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Meetings" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Meetings$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
