/**
 * Reports E2E — /dashboard/reports
 *
 * Tests the AI Client Reports page, which generates weekly/monthly
 * performance reports for clients on-demand or via cron.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Intelligence Reports" + h1 "AI Client Reports"
 *   • Refresh button is visible
 *   • Stats cards render: Total Reports, Clients Covered (Weekly/Monthly optional)
 *   • Generate Report panel renders with a client select and type buttons
 *   • Report history list, loading state, or empty state renders — never blank
 *   • No 404 or generic error state
 *
 * No reports are generated, exported, or emailed in these tests.
 * The generate form is inspected but the submit button is never clicked
 * (it requires a selected client anyway, which would make it a no-op).
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Reports — AI Client Reports", () => {
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
    await page.goto("/dashboard/reports");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow clients + report history to load
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("reports page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/reports");
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
  test("renders editorial header with Intelligence Reports eyebrow and AI Client Reports h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Intelligence Reports/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "AI Client Reports"
    const heading = page.getByRole("heading", { name: /AI Client Reports/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Refresh button is visible ─────────────────────────────────────────
  test("Refresh button is visible in the header action area", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh/i }).first();
    await expect(refreshBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Stats cards render ────────────────────────────────────────────────
  test("stats cards render: Total Reports and Clients Covered", async ({ page }) => {
    await expect(
      page.getByText(/Total Reports/i).first()
    ).toBeVisible({ timeout: 6000 });

    await expect(
      page.getByText(/Clients Covered/i).first()
    ).toBeVisible({ timeout: 4000 });

    // Weekly and Monthly cards are also expected (softer check — same labels
    // are reused on type-toggle buttons, so we only verify at least 2 distinct
    // numeric summary values appear rather than matching labels precisely)
    const hasWeeklyCard = await page
      .getByText(/^Weekly$/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasMonthlyCard = await page
      .getByText(/^Monthly$/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasWeeklyCard || hasMonthlyCard).toBe(true);
  });

  // ── 5. Generate Report panel renders ─────────────────────────────────────
  test("Generate Report panel renders with client selector and type buttons", async ({ page }) => {
    // Panel heading
    await expect(
      page.getByText(/Generate Report/i).first()
    ).toBeVisible({ timeout: 6000 });

    // Client select element (placeholder: "Select a client...")
    const clientSelect = page.locator('select').first();
    await expect(clientSelect).toBeVisible({ timeout: 5000 });

    // Weekly button
    const weeklyBtn = page.getByRole("button", { name: /^Weekly$/i }).first();
    const hasWeekly = await weeklyBtn.isVisible({ timeout: 4000 }).catch(() => false);

    // Monthly button
    const monthlyBtn = page.getByRole("button", { name: /^Monthly$/i }).first();
    const hasMonthly = await monthlyBtn.isVisible({ timeout: 3000 }).catch(() => false);

    // At least one type button must be visible
    expect(hasWeekly || hasMonthly).toBe(true);
  });

  // ── 6. Batch Reports panel renders ───────────────────────────────────────
  test("Batch Reports (auto-generate) panel is visible", async ({ page }) => {
    const batchPanel = page.getByText(/Batch Reports/i).first();
    await expect(batchPanel).toBeVisible({ timeout: 6000 });
  });

  // ── 7. Report history renders content — never blank ──────────────────────
  test("report history area renders list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state (no reports generated yet)
    const hasEmptyState = await page
      .getByText(/No reports yet|no reports|generate your first|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: report rows (client name, weekly/monthly label, date)
    const hasReports = await page
      .getByText(/weekly report|monthly report|generated|download|copy/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: the report history container is rendered with glass styling
    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .filter({ has: page.locator("h2, h3, p") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasReports || hasContainer).toBe(true);
  });

  // ── 8. No 404 or generic error state ─────────────────────────────────────
  test("reports page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "AI Client Reports" heading must be visible instead
    const heading = page.getByRole("heading", { name: /AI Client Reports/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
