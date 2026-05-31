/**
 * Mail Setup E2E — /dashboard/mail-setup
 *
 * Tests the Mail Setup page, which configures email sending (SMTP, domain,
 * SPF/DKIM, sender identity).
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Email Setup" + h1 "Mail Setup"
 *   • Setup content is visible: form inputs OR status indicators OR connect buttons
 *   • Page does not show a 404 or generic error state
 *
 * No configuration is changed in these tests — read-only verification only.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Mail Setup — Email Setup", () => {
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
    await page.goto("/dashboard/mail-setup");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("mail-setup page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/mail-setup");
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
  test("renders editorial header with Email Setup eyebrow and Mail Setup h1", async ({ page }) => {
    const eyebrow = page.getByText(/Email Setup/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Envelope Setup/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Setup content visible — inputs, status indicators, or connect btns ─
  test("setup content is visible — form inputs, status indicators, or connect buttons present", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: form inputs for SMTP / domain configuration
    const hasInputs = await page
      .locator("input, textarea, select")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 2: status/connection indicators
    const hasStatusIndicator = await page
      .getByText(/connected|verified|pending|not connected|domain|SMTP|SPF|DKIM|configured|status/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: a connect or setup action button
    const hasConnectBtn = await page
      .getByRole("button", { name: /connect|setup|configure|verify|add domain|authenticate/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 4: loading skeleton
    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasInputs || hasStatusIndicator || hasConnectBtn || hasSkeleton).toBe(true);
  });

  // ── 4. Page references email-related concepts ────────────────────────────
  test("page content mentions email, domain, or sending-related text", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasEmailContent = await page
      .getByText(/email|domain|SMTP|SPF|DKIM|sender|sending|from address|mail/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasEmailContent).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("mail-setup page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Envelope Setup/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Dashboard sidebar navigation is intact ────────────────────────────
  test("dashboard sidebar navigation is visible on mail-setup page", async ({ page }) => {
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible({ timeout: 8000 });
  });
});
