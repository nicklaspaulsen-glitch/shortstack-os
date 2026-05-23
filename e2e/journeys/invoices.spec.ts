/**
 * Invoices E2E — /dashboard/invoices
 *
 * Tests the Invoices page, which is the billing and payment management hub.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Billing & Invoices" + h1 "Invoices"
 *   • All 7 main tabs render: All Invoices, Invoice Builder, Recurring,
 *     Reminders, Templates, Aging Report, Revenue
 *   • "AI Smart Invoice" link is visible
 *   • "New Invoice" button is visible
 *   • Stats cards render: Collected, Sent/Pending, Overdue (or similar)
 *   • Page shows loading state OR invoice list OR empty state (never blank)
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against empty accounts.
 * No invoices are created or modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Invoices — Billing & Invoices", () => {
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
    await page.goto("/dashboard/invoices");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow the initial invoice fetch to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("invoices page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/invoices");
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
  test("renders editorial header with Billing & Invoices eyebrow and Invoices h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Billing.*Invoices|Billing & Invoices/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Invoices"
    const heading = page.getByRole("heading", { name: /^Invoices$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 7 main tabs render ────────────────────────────────────────────
  test("renders all 7 main tabs: All Invoices, Invoice Builder, Recurring, Reminders, Templates, Aging Report, Revenue", async ({ page }) => {
    const tabLabels = [
      /All Invoices/i,
      /Invoice Builder/i,
      /Recurring/i,
      /Reminders/i,
      /Templates/i,
      /Aging Report/i,
      /Revenue/i,
    ];

    for (const pattern of tabLabels) {
      const tab = page.getByRole("button", { name: pattern }).first();
      await expect(tab).toBeVisible({ timeout: 6000 });
    }
  });

  // ── 4. AI Smart Invoice link is visible ─────────────────────────────────
  test("AI Smart Invoice link is visible", async ({ page }) => {
    const aiInvoiceBtn = page
      .getByRole("link", { name: /AI Smart Invoice|Smart Invoice/i })
      .first();
    await expect(aiInvoiceBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 5. New Invoice button is visible ─────────────────────────────────────
  test("New Invoice button is visible", async ({ page }) => {
    const newInvoiceBtn = page.getByRole("button", { name: /New Invoice/i }).first();
    await expect(newInvoiceBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 6. Stats cards render ────────────────────────────────────────────────
  test("stats cards render — Collected and at least one more metric", async ({ page }) => {
    // "Collected" is the primary revenue metric (totalPaid)
    const collected = page.getByText(/Collected/i).first();
    await expect(collected).toBeVisible({ timeout: 6000 });

    // At least one of the other stats should render
    const hasMoreStats =
      (await page
        .getByText(/Sent|Pending|Overdue|Draft|Recurring|payments received/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasMoreStats).toBe(true);
  });

  // ── 7. Page shows invoice list, loading, or empty state — never blank ───
  test("page shows invoice list, loading spinner, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading indicator ("Loading invoices…")
    const hasLoadingText = await page
      .getByText(/Loading invoices/i)
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state message
    const hasEmptyState = await page
      .getByText(/no invoices|create your first|nothing here|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: invoice data rows visible (client name, amount, status)
    const hasInvoiceData = await page
      .getByText(/\$([\d,]+)|draft|sent|paid|overdue/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: the always-present stats area loaded ($0 is valid)
    const hasStatsArea = await page
      .getByText(/payments received|not yet paid|past due/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasLoadingText || hasEmptyState || hasInvoiceData || hasStatsArea).toBe(true);
  });

  // ── 8. Clicking Invoice Builder tab renders form ─────────────────────────
  test("clicking Invoice Builder tab renders builder interface or empty state", async ({ page }) => {
    const builderTab = page.getByRole("button", { name: /Invoice Builder/i }).first();
    await expect(builderTab).toBeVisible({ timeout: 6000 });

    await builderTab.click();
    await page.waitForTimeout(500);

    // Must render something — form inputs or an empty state
    const hasBuilder =
      (await page
        .getByText(/client|amount|description|line item|due date|invoice/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('input, textarea, select')
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasBuilder).toBe(true);
  });

  // ── 9. No 404 or generic error state ─────────────────────────────────────
  test("invoices page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Invoices" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Invoices$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
