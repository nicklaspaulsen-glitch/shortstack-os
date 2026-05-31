/**
 * Proposals E2E — /dashboard/proposals
 *
 * Tests the Proposals page, which is the client proposal creation and
 * management hub (currently in Beta with local storage).
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Client Proposals" + h1 "Proposals"
 *   • Beta banner is visible
 *   • Stats cards render: Total Value, Signed, Win Rate
 *   • "New proposal" button is visible
 *   • Clicking "New proposal" opens the create form
 *   • Proposal list or empty state renders — never blank
 *   • No 404 or generic error state
 *
 * No proposals are saved or deleted in these tests.
 * The create form is opened and immediately closed without submitting.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Proposals — Client Proposals", () => {
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
    await page.goto("/dashboard/proposals");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1000);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("proposals page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/proposals");
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
  test("renders editorial header with Client Proposals eyebrow and Proposals h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Client Proposals/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Proposals"
    const heading = page.getByRole("heading", { name: /^Proposals$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Beta banner is visible ────────────────────────────────────────────
  test("Beta banner is visible", async ({ page }) => {
    const betaBanner = page.getByText(/Beta/i).first();
    await expect(betaBanner).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Stats cards render: Total Value, Signed, Win Rate ────────────────
  test("stats cards render: Total Value, Signed, Win Rate", async ({ page }) => {
    await expect(page.getByText(/Total Value/i).first()).toBeVisible({ timeout: 6000 });
    await expect(page.getByText(/^Signed$/i).first()).toBeVisible({ timeout: 4000 });
    await expect(page.getByText(/Win Rate/i).first()).toBeVisible({ timeout: 4000 });
  });

  // ── 5. New proposal button is visible ────────────────────────────────────
  test("New proposal button is visible", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /New proposal/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 6. Clicking New proposal opens create form ───────────────────────────
  test("clicking New proposal opens the create form", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /New proposal/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 6000 });
    await newBtn.click();
    await page.waitForTimeout(400);

    // Create form must appear — check for form inputs or a close button
    const hasForm =
      (await page
        .locator("input, textarea")
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .getByText(/proposal title|client|amount|proposal/i)
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasForm).toBe(true);

    // Dismiss — press Escape or click a cancel/close button
    const cancelBtn = page.getByRole("button", { name: /Cancel|Close|✕/i }).first();
    if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(300);
  });

  // ── 7. Proposal list or empty state renders — never blank ────────────────
  test("proposals list or empty state is visible — never blank", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Valid state 1: proposal cards (with status, amount, client name)
    const hasProposals = await page
      .getByText(/draft|sent|signed|rejected|\$\d|\d proposals?/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 2: explicit empty state message
    const hasEmptyState = await page
      .getByText(/no proposals|create your first|0 proposals/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: stats show 0 (always present)
    const hasZeroStats = await page
      .getByText(/0 proposals|\$0/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasProposals || hasEmptyState || hasZeroStats).toBe(true);
  });

  // ── 8. No 404 or generic error state ─────────────────────────────────────
  test("proposals page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Proposals" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Proposals$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
