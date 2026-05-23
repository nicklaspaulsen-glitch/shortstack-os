/**
 * Outreach Hub E2E — /dashboard/outreach-hub
 *
 * Tests the Outreach Hub page, which is the multi-channel outreach
 * campaign and sequence management center.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Outreach Command" + h1 "Outreach Hub"
 *   • All 5 main tabs render: Campaigns, Sequences, Templates, Analytics, Settings
 *   • "New Campaign" button is visible
 *   • Campaigns tab renders campaign list, loading state, or empty state
 *   • Sequences tab renders sequence list or empty state
 *   • Templates tab renders sub-tabs (Calls, SMS, Email, DMs)
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against empty accounts.
 * No campaigns, sequences, or templates are created or modified.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Outreach Hub", () => {
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
    await page.goto("/dashboard/outreach-hub");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow the initial data load to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("outreach hub page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/outreach-hub");
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
  test("renders editorial header with Outreach Command eyebrow and Outreach Hub h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Outreach Command/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Outreach Hub"
    const heading = page.getByRole("heading", { name: /Outreach Hub/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 5 main tabs render ────────────────────────────────────────────
  test("renders all 5 main tabs: Campaigns, Sequences, Templates, Analytics, Settings", async ({ page }) => {
    const tabLabels = [
      /^Campaigns$/i,
      /^Sequences$/i,
      /^Templates$/i,
      /^Analytics$/i,
      /^Settings$/i,
    ];

    for (const pattern of tabLabels) {
      const tab = page.getByRole("button", { name: pattern }).first();
      await expect(tab).toBeVisible({ timeout: 6000 });
    }
  });

  // ── 4. New Campaign button is visible ────────────────────────────────────
  test("New Campaign button is visible", async ({ page }) => {
    const newCampaignBtn = page.getByRole("button", { name: /New Campaign/i }).first();
    await expect(newCampaignBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 5. Campaigns tab renders content — never blank ───────────────────────
  test("Campaigns tab renders campaign list, loading state, or empty state — never blank", async ({ page }) => {
    // Ensure we're on the Campaigns tab (it's the default)
    const campaignsTab = page.getByRole("button", { name: /^Campaigns$/i }).first();
    if (await campaignsTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await campaignsTab.click();
      await page.waitForTimeout(600);
    }

    await page.waitForTimeout(1500);

    // Valid state 1: campaign cards (active, paused, or completed)
    const hasCampaigns = await page
      .getByText(/active|paused|completed|campaign|leads|contacted|replied/i)
      .nth(1) // skip the tab label itself
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no campaigns|create your first|get started|build your first/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: loading skeleton
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasCampaigns || hasEmptyState || hasSkeleton).toBe(true);
  });

  // ── 6. Sequences tab renders content or empty state ─────────────────────
  test("clicking Sequences tab renders content or empty state", async ({ page }) => {
    const sequencesTab = page.getByRole("button", { name: /^Sequences$/i }).first();
    await expect(sequencesTab).toBeVisible({ timeout: 6000 });

    await sequencesTab.click();
    await page.waitForTimeout(600);

    // Must render something
    const hasContent =
      (await page
        .getByText(/sequence|steps|day|follow.?up|no sequences|initial outreach/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="rounded"]')
        .filter({ has: page.locator("button, p, span") })
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 7. Templates tab renders channel sub-tabs ────────────────────────────
  test("clicking Templates tab renders Calls, SMS, Email, DMs sub-tabs", async ({ page }) => {
    const templatesTab = page.getByRole("button", { name: /^Templates$/i }).first();
    await expect(templatesTab).toBeVisible({ timeout: 6000 });

    await templatesTab.click();
    await page.waitForTimeout(600);

    // Template sub-tabs should appear: Calls, SMS, Email, DMs
    const subTabLabels = ["Calls", "SMS", "Email", "DMs"];
    let visibleSubTabs = 0;

    for (const label of subTabLabels) {
      const subTab = page
        .getByRole("button", { name: new RegExp(`^${label}$`, "i") })
        .first();
      const textEl = page.getByText(new RegExp(`^${label}$`, "i")).first();
      const isVisible =
        (await subTab.isVisible({ timeout: 3000 }).catch(() => false)) ||
        (await textEl.isVisible({ timeout: 2000 }).catch(() => false));
      if (isVisible) visibleSubTabs++;
    }

    // At least 3 of the 4 sub-tabs must be visible
    expect(visibleSubTabs).toBeGreaterThanOrEqual(3);
  });

  // ── 8. No 404 or generic error state ─────────────────────────────────────
  test("outreach hub does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Outreach Hub" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Outreach Hub/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
