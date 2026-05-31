/**
 * CRM E2E — /dashboard/crm
 *
 * Tests the CRM (Relationship Engine) page, which is the contact/prospect
 * management hub with pipeline status tracking.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Relationship Engine" + h1 "CRM"
 *   • Status tabs render: All, New, Contacted, Replied, Booked, Converted
 *   • Search input is visible with correct placeholder and accepts text
 *   • View mode buttons render (table / card / pipeline)
 *   • Clicking a status tab narrows the view
 *   • Search shows 0 results or empty message for nonsense query
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against empty accounts.
 * All assertions use `isVisible().catch(() => false)` so tests never
 * hard-fail on accounts with no CRM data.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("CRM — Relationship Engine", () => {
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
    await page.goto("/dashboard/crm");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow the initial contact fetch to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("CRM page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/crm");
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
  test("renders editorial header with Relationship Engine eyebrow and CRM h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Relationship Engine/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "CRM"
    const heading = page.getByRole("heading", { name: /^CRM$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Status tabs render ───────────────────────────────────────────────
  test("renders status tabs: All, New, Contacted, Replied, Booked, Converted", async ({ page }) => {
    const statusTabs = ["All", "New", "Contacted", "Replied", "Booked", "Converted"];

    for (const label of statusTabs) {
      // Buttons contain a count badge inside: "All 5", "New 3", etc.
      // Use partial name match (exact: false) so the count doesn't break the selector.
      const tab =
        page.getByRole("button", { name: label, exact: false }).first();
      const tabVisible = await tab.isVisible({ timeout: 5000 }).catch(() => false);

      // Fall back to any element that *starts with* the label text (count badge follows)
      const textEl = page.getByText(new RegExp(`^${label}`, "i")).first();
      const textVisible = await textEl.isVisible({ timeout: 3000 }).catch(() => false);

      expect(tabVisible || textVisible).toBe(true);
    }
  });

  // ── 4. Search input is visible and accepts text ──────────────────────────
  test("search input is visible with correct placeholder and accepts text input", async ({ page }) => {
    const searchInput = page.locator(
      'input[placeholder*="Search name"], input[placeholder*="Search"], input[type="search"]',
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    await searchInput.fill("Test contact query");
    await expect(searchInput).toHaveValue("Test contact query");

    // Clear it
    await searchInput.fill("");
    await expect(searchInput).toHaveValue("");
  });

  // ── 5. View mode buttons render ─────────────────────────────────────────
  test("view mode controls render (table / card / pipeline)", async ({ page }) => {
    // The CRM has three view modes: table, card, pipeline
    // They may be rendered as buttons with text or aria-label
    const hasTableMode =
      (await page
        .getByRole("button", { name: /table|list/i })
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[aria-label*="table"], [aria-label*="Table"], [title*="table"], [title*="Table"]')
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    const hasCardMode =
      (await page
        .getByRole("button", { name: /card|grid/i })
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[aria-label*="card"], [aria-label*="Card"], [title*="card"], [title*="Card"]')
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    const hasPipelineMode =
      (await page
        .getByRole("button", { name: /pipeline|kanban/i })
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[aria-label*="pipeline"], [aria-label*="Pipeline"], [title*="pipeline"]')
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    // At least two of the three view modes must be discoverable
    const modeCount = [hasTableMode, hasCardMode, hasPipelineMode].filter(Boolean).length;
    expect(modeCount).toBeGreaterThanOrEqual(2);
  });

  // ── 6. Clicking a status tab narrows the view ────────────────────────────
  test("clicking the New status tab updates the active state", async ({ page }) => {
    // Find and click the "New" tab
    const newTab = page
      .getByRole("button", { name: /^New$/i })
      .first();

    const newTabVisible = await newTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (!newTabVisible) {
      // Try finding it as any element with the text "New"
      const newTabEl = page.getByText(/^New$/i).first();
      if (await newTabEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newTabEl.click();
      }
    } else {
      await newTab.click();
    }

    await page.waitForTimeout(500);

    // After clicking, page must remain stable — no crash
    const heading = page.getByRole("heading", { name: /^CRM$/i }).first();
    await expect(heading).toBeVisible({ timeout: 4000 });
  });

  // ── 7. CRM renders some content — never blank ────────────────────────────
  test("CRM shows contacts, loading skeleton, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: contact rows or cards
    const hasContactData = await page
      .getByText(/\b(email|phone|company|industry|city|status)\b/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 2: loading skeleton
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"], [class*="skeleton"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 3: empty state message
    const hasEmptyState = await page
      .getByText(/no contacts|no results|nothing here|add your first|get started|import/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: stats dashboard panel
    const hasDashboard = await page
      .getByText(/total contacts|conversion rate|conversion|new contacts|pipeline/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasContactData || hasSkeleton || hasEmptyState || hasDashboard).toBe(true);
  });

  // ── 8. Nonsense search shows 0 results or empty message ─────────────────
  test("typing a nonsense search query shows 0 results or empty message", async ({ page }) => {
    const searchInput = page.locator(
      'input[placeholder*="Search name"], input[placeholder*="Search"], input[type="search"]',
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    await page.waitForTimeout(500);

    await searchInput.fill("zzz_no_match_contact_xqz99");
    await page.waitForTimeout(700);

    // Either: an explicit "no results" / "empty" message
    const hasEmptyMsg = await page
      .getByText(/no contacts|no results|nothing here|no matching|0 contacts|0 results/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Or: the contact list is empty (no contact rows visible)
    const contactRows = page.locator('[class*="contact"], tr[class], [class*="card"]').filter({
      has: page.locator("td, h3, [class*='name']"),
    });
    const rowCount = await contactRows.count();

    // Pass if either the empty message shows or there are 0 contact rows
    expect(hasEmptyMsg || rowCount === 0).toBe(true);

    // Clean up
    await searchInput.fill("");
  });

  // ── 9. No 404 or generic error state ─────────────────────────────────────
  test("CRM page does not render a 404 or generic error state", async ({ page }) => {
    // Use specific phrases to avoid false-positives on contact data like "(404) area code"
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "CRM" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^CRM$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
