/**
 * Calendar E2E — /dashboard/calendar
 *
 * Tests the Calendar page, a three-tab time-management surface covering
 * the monthly/weekly/daily calendar view, today's agenda, and deadlines.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Time Command" + h1 "Calendar"
 *   • All 3 tabs render: Calendar, Today's Agenda, Deadlines
 *   • Calendar is the default active tab (CSS .active class)
 *   • New Event button is visible
 *   • Clicking Today's Agenda tab switches content
 *   • Clicking Deadlines tab switches content
 *   • No 404 or generic error state
 *
 * No events are created, edited, or deleted in these tests.
 * This spec focuses on the /dashboard/calendar surface structure and tab navigation.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Calendar — Time Command", () => {
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
    await page.goto("/dashboard/calendar");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow calendar events and agenda items to load
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("calendar page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/calendar");
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
  test("renders editorial header with Time Command eyebrow and Calendar h1", async ({ page }) => {
    // Eyebrow — "Time Command"
    const eyebrow = page.getByText(/Time Command/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Calendar"
    const heading = page.getByRole("heading", { name: /^Calendar$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 3 tabs render ─────────────────────────────────────────────────
  test("renders all 3 tabs: Calendar, Today's Agenda, Deadlines", async ({ page }) => {
    // The tab-pill-strip container
    const tabStrip = page.locator(".tab-pill-strip").first();
    await expect(tabStrip).toBeVisible({ timeout: 8000 });

    // Calendar tab
    await expect(
      tabStrip.getByRole("button", { name: /^Calendar$/i })
    ).toBeVisible({ timeout: 5000 });

    // Today's Agenda tab
    await expect(
      tabStrip.getByRole("button", { name: /Today.*Agenda|Agenda/i })
    ).toBeVisible({ timeout: 4000 });

    // Deadlines tab
    await expect(
      tabStrip.getByRole("button", { name: /^Deadlines$/i })
    ).toBeVisible({ timeout: 4000 });
  });

  // ── 4. Calendar tab is active by default ────────────────────────────────
  test("Calendar tab is the default active tab", async ({ page }) => {
    const tabStrip = page.locator(".tab-pill-strip").first();
    await expect(tabStrip).toBeVisible({ timeout: 6000 });

    // Active tab uses CSS class "tab-pill active"
    const activeTab = tabStrip.locator(".tab-pill.active").first();
    await expect(activeTab).toBeVisible({ timeout: 5000 });

    // The active tab should be the Calendar tab
    const activeText = await activeTab.textContent();
    expect(activeText?.toLowerCase()).toContain("calendar");
  });

  // ── 5. New Event button is visible ──────────────────────────────────────
  test("New Event button is visible in the header action area", async ({ page }) => {
    const newEventBtn = page.getByRole("button", { name: /New Event/i }).first();
    await expect(newEventBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 6. Today's Agenda tab switches content ────────────────────────────────
  test("clicking Today's Agenda tab renders agenda content", async ({ page }) => {
    const tabStrip = page.locator(".tab-pill-strip").first();
    await expect(tabStrip).toBeVisible({ timeout: 6000 });

    const agendaTab = tabStrip.getByRole("button", { name: /Today.*Agenda|Agenda/i }).first();
    await expect(agendaTab).toBeVisible({ timeout: 5000 });

    await agendaTab.click();
    await page.waitForTimeout(600);

    // Agenda tab should now have the active class
    await expect(agendaTab).toHaveClass(/active/, { timeout: 3000 });

    // Content area must render something (events, empty state, or agenda structure)
    const hasContent =
      (await page
        .getByText(/today|agenda|event|meeting|schedule|No events today|no events/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("[class*='glass'], [class*='rounded-xl']")
        .filter({ has: page.locator("h2, h3, p") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 7. Deadlines tab switches content ────────────────────────────────────
  test("clicking Deadlines tab renders deadline content", async ({ page }) => {
    const tabStrip = page.locator(".tab-pill-strip").first();
    await expect(tabStrip).toBeVisible({ timeout: 6000 });

    const deadlinesTab = tabStrip.getByRole("button", { name: /^Deadlines$/i }).first();
    await expect(deadlinesTab).toBeVisible({ timeout: 5000 });

    await deadlinesTab.click();
    await page.waitForTimeout(600);

    // Deadlines tab should now have the active class
    await expect(deadlinesTab).toHaveClass(/active/, { timeout: 3000 });

    // Content area must render something
    const hasContent =
      (await page
        .getByText(/deadline|due date|overdue|upcoming|no deadline/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-lg']")
        .filter({ has: page.locator("h2, h3, p") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 8. No 404 or generic error state ─────────────────────────────────────
  test("calendar page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Calendar" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Calendar$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
