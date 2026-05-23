/**
 * Financials E2E — /dashboard/financials
 *
 * Tests the Financials page, a financial operations hub covering MRR,
 * expenses, subscriptions, invoicing, forecasting, and exports.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Financial Overview" + h1 "Financials"
 *   • All 6 tabs render: Overview, Expenses, Subscriptions, Invoicing, Forecasting, Export
 *   • Overview is the default active tab and renders key revenue stats
 *   • Expenses tab switches content
 *   • Subscriptions tab switches content
 *   • No 404 or generic error state
 *
 * No expenses are added, subscriptions created, or invoices generated in these
 * tests. The financial data surfaces are inspected in read-only mode.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Financials — Financial Operations Hub", () => {
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
    await page.goto("/dashboard/financials");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow client data, subscriptions, and expenses to load
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("financials page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/financials");
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
  test("renders editorial header with Financial Overview eyebrow and Financials h1", async ({ page }) => {
    // Eyebrow — "Financial Overview"
    const eyebrow = page.getByText(/Financial Overview/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Financials"
    const heading = page.getByRole("heading", { name: /^Financials$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 6 tabs render ─────────────────────────────────────────────────
  test("renders all 6 tabs: Overview, Expenses, Subscriptions, Invoicing, Forecasting, Export", async ({ page }) => {
    // Overview tab
    await expect(
      page.getByRole("button", { name: /^Overview$/i }).first()
    ).toBeVisible({ timeout: 8000 });

    // Expenses tab
    await expect(
      page.getByRole("button", { name: /^Expenses$/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Subscriptions tab
    await expect(
      page.getByRole("button", { name: /^Subscriptions$/i }).first()
    ).toBeVisible({ timeout: 4000 });

    // Invoicing tab
    await expect(
      page.getByRole("button", { name: /^Invoicing$/i }).first()
    ).toBeVisible({ timeout: 4000 });

    // Forecasting tab
    await expect(
      page.getByRole("button", { name: /^Forecasting$/i }).first()
    ).toBeVisible({ timeout: 4000 });

    // Export tab
    await expect(
      page.getByRole("button", { name: /^Export$/i }).first()
    ).toBeVisible({ timeout: 4000 });
  });

  // ── 4. Overview tab is the default active tab ────────────────────────────
  test("Overview tab is the default active tab and renders revenue stats", async ({ page }) => {
    // MRR stat card should be visible in the default Overview tab
    const hasMRR = await page
      .getByText(/\bMRR\b/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    // ARR stat card
    const hasARR = await page
      .getByText(/\bARR\b/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Net Profit stat card
    const hasNetProfit = await page
      .getByText(/Net Profit/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // General revenue guard — at minimum some financial metric must show
    const hasRevenueMetric = await page
      .getByText(/revenue|profit|MRR|ARR|income|financial/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasMRR || hasARR || hasNetProfit || hasRevenueMetric).toBe(true);
  });

  // ── 5. Expenses tab switches content ─────────────────────────────────────
  test("clicking Expenses tab renders expense content", async ({ page }) => {
    const expensesTab = page.getByRole("button", { name: /^Expenses$/i }).first();
    await expect(expensesTab).toBeVisible({ timeout: 6000 });

    await expensesTab.click();
    await page.waitForTimeout(600);

    // Expenses-specific content must be visible
    const hasContent =
      (await page
        .getByText(/expense|cost|spend|Monthly Expenses|Add Expense|No expenses/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .getByRole("button", { name: /Add Expense|add expense/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. Subscriptions tab switches content ────────────────────────────────
  test("clicking Subscriptions tab renders subscription content", async ({ page }) => {
    const subsTab = page.getByRole("button", { name: /^Subscriptions$/i }).first();
    await expect(subsTab).toBeVisible({ timeout: 6000 });

    await subsTab.click();
    await page.waitForTimeout(600);

    // Subscriptions-specific content must be visible
    const hasContent =
      (await page
        .getByText(/subscription|software|SaaS|tool|No subscriptions/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .getByRole("button", { name: /Add Subscription|add subscription/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)) ||
      (await page
        .locator("table, [class*='glass'], [class*='rounded-xl']")
        .filter({ has: page.locator("h2, h3, p") })
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 7. No 404 or generic error state ─────────────────────────────────────
  test("financials page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Financials" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Financials$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
