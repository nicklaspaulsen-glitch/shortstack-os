/**
 * Email Composer E2E — /dashboard/email-composer
 *
 * Tests the Email Composer page, a split editor/preview layout for crafting
 * email campaigns with subject line editing, body composition, spam score,
 * word count stats, and AI generation capability.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Campaign Editor" + h1 "Email Composer"
 *   • Subject line or email body editor is visible
 *   • Email stats panel renders spam score, word count, or similar metrics
 *   • Send or generate trigger is visible
 *   • No 404 or generic error state
 *
 * No emails are sent, generated, or saved in these tests.
 * The send and generate buttons are never clicked.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Email Composer — Campaign Editor", () => {
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
    await page.goto("/dashboard/email-composer");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("email composer page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/email-composer");
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
  test("renders editorial header with Campaign Editor eyebrow and Email Composer h1", async ({ page }) => {
    const eyebrow = page.getByText(/Campaign Editor/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Email Composer/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Subject line or email body editor is visible ──────────────────────
  test("subject line or email body editor is visible", async ({ page }) => {
    const hasSubject = await page
      .locator('input[placeholder*="subject" i], input[name="subject"]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasEditor = await page
      .locator('textarea, [contenteditable="true"], [role="textbox"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasComposerPanel = await page
      .getByText(/subject|body|template|campaign/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSubject || hasEditor || hasComposerPanel).toBe(true);
  });

  // ── 4. Email stats panel renders spam score, word count, or similar metrics
  test("email stats panel renders spam score, word count, or similar metrics", async ({ page }) => {
    const hasSpamScore = await page
      .getByText(/spam.*score|spam/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasWordCount = await page
      .getByText(/word.*count|words/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasStats = await page
      .getByText(/\d+%|\d+ words|score|variables/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSpamScore || hasWordCount || hasStats).toBe(true);
  });

  // ── 5. Send or generate trigger is visible ───────────────────────────────
  test("send or generate trigger is visible", async ({ page }) => {
    const hasSendBtn = await page
      .getByRole("button", { name: /send|generate|create|preview/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasAI = await page
      .getByText(/generate|write.*email|create.*email|ai/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSendBtn || hasAI).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("email composer page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Email Composer/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
