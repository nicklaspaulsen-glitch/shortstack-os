/**
 * Automations E2E — /dashboard/automations
 *
 * Tests the Automations page, which lists workflows and links to the
 * workflow builder and template library.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Trigger & Orchestrate" + h1 "Automations"
 *   • Stats cards render: Total Automations, Active, Paused
 *   • Search input is visible and accepts text
 *   • "New Automation" link/button is visible
 *   • "Browse template library" link/button is visible
 *   • Page shows loading skeleton OR empty state OR workflow list (never blank)
 *   • Nonsense search query shows empty state or 0 results
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against empty accounts.
 * Workflow creation is NOT tested here — that's the workflow-builder surface.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Automations", () => {
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
    await page.goto("/dashboard/automations");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow the initial workflow fetch to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("automations page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/automations");
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
  test("renders editorial header with Trigger & Orchestrate eyebrow and Automations h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Trigger.*Orchestrate|Trigger & Orchestrate/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Automations"
    const heading = page.getByRole("heading", { name: /^Automations$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Stats cards render ────────────────────────────────────────────────
  test("renders Total Automations, Active, and Paused stats cards", async ({ page }) => {
    await expect(page.getByText(/Total Automations/i).first()).toBeVisible({ timeout: 6000 });
    await expect(page.getByText(/^Active$/i).first()).toBeVisible({ timeout: 4000 });
    await expect(page.getByText(/^Paused$/i).first()).toBeVisible({ timeout: 4000 });
  });

  // ── 4. Search input is visible and accepts text ──────────────────────────
  test("search input is visible and accepts text input", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search automations"]').first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    await searchInput.fill("Test automation query");
    await expect(searchInput).toHaveValue("Test automation query");

    // Clear
    await searchInput.fill("");
    await expect(searchInput).toHaveValue("");
  });

  // ── 5. New Automation button / link is visible ───────────────────────────
  test("New Automation link is visible", async ({ page }) => {
    const newBtn = page.getByRole("link", { name: /New Automation/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 6. Browse template library link is visible ───────────────────────────
  test("Browse template library link is visible", async ({ page }) => {
    const libraryLink = page.getByRole("link", { name: /template library|Browse template/i }).first();
    await expect(libraryLink).toBeVisible({ timeout: 6000 });
  });

  // ── 7. Page shows some content — never blank ─────────────────────────────
  test("page shows loading skeleton, workflow list, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2500);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/No automations yet|No automations found|Build workflows/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 3: workflow list (at least one workflow card)
    const hasWorkflows = await page
      .getByText(/running now|Total Automations|Active|Paused/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasWorkflows).toBe(true);
  });

  // ── 8. Nonsense search shows empty state ────────────────────────────────
  test("typing a nonsense search query shows no automations found or 0 results", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search automations"]').first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    // Wait for initial load to complete first
    await page.waitForTimeout(1000);

    await searchInput.fill("zzz_no_match_automation_xqz99");
    await page.waitForTimeout(600);

    // Must show either the empty-state message or no workflow cards
    const hasEmptyMsg = await page
      .getByText(/No automations found|no automations|no results/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Or the workflow list is empty (no workflow name elements)
    const workflowCards = page
      .locator('[class*="glass"], [class*="rounded"]')
      .filter({ has: page.locator('[class*="font-display"], [class*="font-bold"]') });
    // Exclude the stats cards (they're always present) — just check if count is small
    const cardCount = await workflowCards.count();

    // Pass if empty message shown OR no workflow cards visible beyond the 3 stat cards
    expect(hasEmptyMsg || cardCount <= 3).toBe(true);

    // Clean up
    await searchInput.fill("");
  });

  // ── 9. No 404 or generic error state ─────────────────────────────────────
  test("automations page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Automations" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Automations$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
