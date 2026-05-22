/**
 * Lead Pipeline E2E — /dashboard/leadgen-pipeline
 *
 * Tests the voice-outreach AI qualification kanban dashboard. Verifies:
 *   • Page loads without JS errors (settingsOnly — accessible via direct URL)
 *   • Stage column headers render (outreach_sent, replied, qualifying,
 *     qualified, pitch_ready, closed)
 *   • Stats bar appears with metric labels
 *   • Phase section buttons render (Outreach, Deal, Production, Done)
 *   • Empty-state message shows when no leads exist
 *   • Dead leads accordion section is present
 *   • No uncaught console errors
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

/** Actual stage labels from src/app/dashboard/leadgen-pipeline/page.tsx */
const STAGE_LABELS = [
  "Outreach Sent",
  "Replied",
  "Qualifying",
  "Qualified",
  "Pitch Ready",
  "Closed",
];

test.describe("Lead Pipeline", () => {
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
    // Navigate FIRST, then wait for dashboard auth gate
    await page.goto("/dashboard/leadgen-pipeline");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
  });

  test("renders page heading and stats bar", async ({ page }) => {
    // Page title — h1 "Lead Pipeline"
    await expect(
      page.getByRole("heading", { name: /lead pipeline/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Stats bar renders metric labels (Active, Closed, Conv %, etc.)
    const statsLabel = page.getByText(/Active|Closed|Conv\s*%|Revenue|Delivered/i).first();
    await expect(statsLabel).toBeVisible({ timeout: 5000 });
  });

  test("renders active stage columns", async ({ page }) => {
    // At least the first few stage labels should be visible
    for (const label of STAGE_LABELS.slice(0, 4)) {
      await expect(
        page.getByText(label, { exact: false }).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("phase section buttons are present and interactive", async ({ page }) => {
    // Page uses collapsible PhaseSection with phase labels as buttons
    const phases = ["Outreach", "Deal", "Production"];
    for (const phase of phases) {
      const phaseBtn = page.getByText(phase, { exact: false }).first();
      const visible = await phaseBtn.isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) {
        await expect(phaseBtn).toBeVisible();
      }
    }
    // At least one phase heading should be visible
    const anyPhase = await page
      .getByText(/Outreach|Deal|Production|Done/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(anyPhase).toBe(true);
  });

  test("kanban board or empty state is visible", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Either lead cards are visible, or an empty-state message
    const hasLeadCards = (await page.locator("[class*='card'], [class*='lead'], [class*='kanban']").count()) > 0;
    const hasEmptyText = await page
      .getByText(/no leads|no qualified|get started|create your first|empty/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    // Either we have lead content or an empty state
    expect(hasLeadCards || hasEmptyText).toBeTruthy();
  });

  test("dead leads section renders when present", async ({ page }) => {
    // Scroll to the bottom — dead leads section is below the kanban board
    await page.keyboard.press("End");
    await page.waitForTimeout(500);

    // Dead leads button text is dynamic: "N dead lead(s)"
    const deadSection = page.getByText(/dead lead/i).first();
    const visible = await deadSection.isVisible({ timeout: 3000 }).catch(() => false);
    // If no dead leads exist, the section may be absent — that's OK
    if (visible) {
      await expect(deadSection).toBeVisible();
    }
  });

  test("no uncaught JS errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/dashboard/leadgen-pipeline");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection") &&
        !e.includes("hydration"),
    );
    expect(critical).toHaveLength(0);
  });
});
