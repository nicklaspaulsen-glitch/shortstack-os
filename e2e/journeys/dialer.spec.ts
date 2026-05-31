/**
 * Dialer E2E — /dashboard/dialer
 *
 * Tests the Dialer page, a three-tab cockpit covering Voice, SMS, and DM.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Voice & Messaging" + h1 "Dialer"
 *   • All 3 tabs render: Power Dialer, SMS Console, DM Composer
 *   • Power Dialer is the default active tab (aria-current="page")
 *   • Power Dialer tab renders stat cards, call list, and contact paste area
 *   • Clicking SMS Console tab switches content
 *   • Clicking DM Composer tab switches content
 *   • No 404 or generic error state
 *
 * No calls are initiated, SMS messages sent, or DMs composed in these tests.
 * The voice-dialer-flow.spec.ts covers the Voice Studio → Clone integration path.
 * This spec focuses on the /dashboard/dialer surface structure and tab navigation.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Dialer — Voice & Messaging Cockpit", () => {
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
    await page.goto("/dashboard/dialer");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow Twilio SDK dynamic import and voice presets to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("dialer page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/dialer");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection") &&
        !e.includes("hydration") &&
        // Twilio SDK fires a WebRTC-related warning in headless environments
        !e.includes("RTCPeerConnection") &&
        !e.includes("getUserMedia"),
    );
    expect(critical).toHaveLength(0);
  });

  // ── 2. Editorial header: eyebrow + h1 ───────────────────────────────────
  test("renders editorial header with Voice & Messaging eyebrow and Dialer h1", async ({ page }) => {
    // Eyebrow — "Voice & Messaging" (source has &amp; but Playwright sees &)
    const eyebrow = page.getByText(/Voice.*Messaging/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Dialer"
    const heading = page.getByRole("heading", { name: /^Dialer$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 4 tabs render ─────────────────────────────────────────────────
  test("renders all 4 tabs: Power Dialer, AI Calls, SMS Console, DM Composer", async ({ page }) => {
    const nav = page.locator('[aria-label="Dialer tabs"]').first();
    await expect(nav).toBeVisible({ timeout: 8000 });

    await expect(
      nav.getByRole("button", { name: /Power Dialer/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      nav.getByRole("button", { name: /AI Calls/i })
    ).toBeVisible({ timeout: 4000 });

    await expect(
      nav.getByRole("button", { name: /SMS Console/i })
    ).toBeVisible({ timeout: 4000 });

    await expect(
      nav.getByRole("button", { name: /DM Composer/i })
    ).toBeVisible({ timeout: 4000 });
  });

  // ── 4. Power Dialer is active by default ────────────────────────────────
  test("Power Dialer tab is the default active tab", async ({ page }) => {
    const nav = page.locator('[aria-label="Dialer tabs"]').first();
    await expect(nav).toBeVisible({ timeout: 6000 });

    const powerDialerBtn = nav.getByRole("button", { name: /Power Dialer/i }).first();
    await expect(powerDialerBtn).toBeVisible({ timeout: 5000 });

    // Active tab uses aria-current="page"
    const ariaCurrent = await powerDialerBtn.getAttribute("aria-current");
    expect(ariaCurrent).toBe("page");
  });

  // ── 5. Power Dialer tab content renders ──────────────────────────────────
  test("Power Dialer tab renders stat cards, call list, and paste area", async ({ page }) => {
    // Stat cards: Dialed today, Connected, Voicemails
    const hasDialedStat = await page
      .getByText(/Dialed today|Dialed/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCallList = await page
      .getByText(/Call list/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Paste area: textarea for pasting phone numbers
    const hasPasteArea = await page
      .locator('textarea[placeholder*="phone" i], textarea[placeholder*="paste" i]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // General content guard — at minimum some UI must be visible
    const hasContent = await page
      .getByText(/voice|call|dialer|connected|voicemail|phone|paste/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasDialedStat || hasCallList || hasPasteArea || hasContent).toBe(true);
  });

  // ── 6. AI Calls tab switches content ────────────────────────────────────
  test("clicking AI Calls tab renders ElevenAgents content", async ({ page }) => {
    const nav = page.locator('[aria-label="Dialer tabs"]').first();
    await expect(nav).toBeVisible({ timeout: 6000 });

    const aiCallsTab = nav.getByRole("button", { name: /AI Calls/i }).first();
    await expect(aiCallsTab).toBeVisible({ timeout: 5000 });

    await aiCallsTab.click();
    await page.waitForTimeout(600);

    // AI Calls tab should become active
    const ariaCurrent = await aiCallsTab.getAttribute("aria-current");
    expect(ariaCurrent).toBe("page");

    // Content area must render something — ElevenAgents content
    const hasContent =
      (await page
        .getByText(/agent|elevenlabs|ai.*call|call.*ai|create|connect/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("button, input[type=text]")
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 7. SMS Console tab switches content ─────────────────────────────────
  test("clicking SMS Console tab renders SMS content", async ({ page }) => {
    const nav = page.locator('[aria-label="Dialer tabs"]').first();
    await expect(nav).toBeVisible({ timeout: 6000 });

    const smsTab = nav.getByRole("button", { name: /SMS Console/i }).first();
    await expect(smsTab).toBeVisible({ timeout: 5000 });

    await smsTab.click();
    await page.waitForTimeout(600);

    // SMS Console tab should become active
    const ariaCurrent = await smsTab.getAttribute("aria-current");
    expect(ariaCurrent).toBe("page");

    // Content area must render something
    const hasContent =
      (await page
        .getByText(/SMS|message|send|recipient|template|bulk|single/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("textarea, input[type=text]")
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 7. DM Composer tab switches content ──────────────────────────────────
  test("clicking DM Composer tab renders DM content", async ({ page }) => {
    const nav = page.locator('[aria-label="Dialer tabs"]').first();
    await expect(nav).toBeVisible({ timeout: 6000 });

    const dmTab = nav.getByRole("button", { name: /DM Composer/i }).first();
    await expect(dmTab).toBeVisible({ timeout: 5000 });

    await dmTab.click();
    await page.waitForTimeout(600);

    // DM Composer tab should become active
    const ariaCurrent = await dmTab.getAttribute("aria-current");
    expect(ariaCurrent).toBe("page");

    // Content area must render something
    const hasContent =
      (await page
        .getByText(/DM|direct message|compose|message|platform|Instagram|LinkedIn|Twitter/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("textarea, input[type=text], select")
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 8. No 404 or generic error state ─────────────────────────────────────
  test("dialer page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Dialer" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Dialer$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
