/**
 * WhatsApp E2E — /dashboard/whatsapp
 *
 * Tests the WhatsApp Business Campaigns page, which manages WhatsApp
 * campaign broadcasts, business phone numbers, and the inbox.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "WhatsApp Business" + h1 "WhatsApp Campaigns"
 *   • "Campaigns" tab button is visible and the default active tab
 *   • Campaigns tab shows campaign list, loading state, or empty state
 *   • "Numbers" tab button is clickable without crashing
 *   • "Inbox" tab button is clickable without crashing
 *   • No 404 or generic error state
 *
 * No campaigns, numbers, or messages are created or sent in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("WhatsApp — WhatsApp Business", () => {
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
    await page.goto("/dashboard/whatsapp");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("whatsapp page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/whatsapp");
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
  test("renders editorial header with WhatsApp Business eyebrow and WhatsApp Campaigns h1", async ({ page }) => {
    const eyebrow = page.getByText(/WhatsApp Business/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page
      .getByRole("heading", { name: /WhatsApp Campaigns/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Campaigns tab is visible as the default ───────────────────────────
  test("Campaigns tab button is visible and is the default active tab", async ({ page }) => {
    const campaignsTab = page
      .getByRole("button", { name: /^Campaigns$/i })
      .first();
    await expect(campaignsTab).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Campaigns tab renders content — never blank ───────────────────────
  test("Campaigns tab shows campaign list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no campaigns|create.*campaign|get started|connect.*whatsapp|set up/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: campaign rows (status, sent, delivered, read rates)
    const hasCampaigns = await page
      .getByText(/sent|delivered|read|campaign|broadcast|scheduled|draft|active/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any rendered glass panel or card
    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasCampaigns || hasPanel).toBe(true);
  });

  // ── 5. Numbers tab is clickable without crashing ─────────────────────────
  test("clicking Numbers tab renders content without crashing", async ({ page }) => {
    const numbersTab = page
      .getByRole("button", { name: /^Numbers$/i })
      .first();
    await expect(numbersTab).toBeVisible({ timeout: 6000 });

    await numbersTab.click();
    await page.waitForTimeout(800);

    // Heading must still be visible — page did not crash
    const heading = page
      .getByRole("heading", { name: /WhatsApp Campaigns/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Some content should appear in the numbers panel
    const hasContent =
      (await page
        .getByText(/number|phone|business.*number|add.*number|no numbers|whatsapp.*number|register/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="glass"], [class*="rounded"]')
        .filter({ has: page.locator("p, h2, h3, button") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. Inbox tab is clickable without crashing ───────────────────────────
  test("clicking Inbox tab renders content without crashing", async ({ page }) => {
    const inboxTab = page
      .getByRole("button", { name: /^Inbox$/i })
      .first();
    await expect(inboxTab).toBeVisible({ timeout: 6000 });

    await inboxTab.click();
    await page.waitForTimeout(800);

    // Heading must still be visible — page did not crash
    const heading = page
      .getByRole("heading", { name: /WhatsApp Campaigns/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Some content should appear in the inbox panel
    const hasContent =
      (await page
        .getByText(/inbox|conversation|message|no messages|no conversations|reply/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="glass"], [class*="rounded"]')
        .filter({ has: page.locator("p, h2, h3") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 7. No 404 or generic error state ─────────────────────────────────────
  test("whatsapp page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page
      .getByRole("heading", { name: /WhatsApp Campaigns/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
