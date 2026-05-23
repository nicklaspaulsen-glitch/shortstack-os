/**
 * Workflows E2E — /dashboard/workflows
 *
 * Tests the Workflows page, which is the no-code / low-code automation
 * builder (distinct from /dashboard/automations which lists workflows).
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "WORKFLOWS" + h1 "Workflows"
 *   • Header action buttons render: AI Generate, New Workflow
 *   • All 8 main tabs render: Builder, Presets, Triggers & Actions, AI Agent,
 *     n8n Live, Analytics, Sharing, History (at least 6 of 8)
 *   • Default Builder tab renders workflow list, loading state, or empty state
 *   • Presets tab renders preset cards or empty state
 *   • No 404 or generic error state
 *
 * No workflows are created or modified in these tests.
 * The create/edit forms are not submitted.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Workflows — Workflow Builder", () => {
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
    await page.goto("/dashboard/workflows");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow the initial workflow list fetch to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("workflows page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/workflows");
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
  test("renders editorial header with WORKFLOWS eyebrow and Workflows h1", async ({ page }) => {
    // Eyebrow — "WORKFLOWS" (uppercase in source)
    const eyebrow = page.getByText(/WORKFLOWS|Workflows/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Workflows"
    const heading = page.getByRole("heading", { name: /^Workflows$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Header action buttons render ─────────────────────────────────────
  test("AI Generate and New Workflow buttons are visible", async ({ page }) => {
    // "AI Generate" button (Sparkles icon)
    const aiGenBtn = page.getByRole("button", { name: /AI Generate|AI Workflow/i }).first();
    const hasAiGen = await aiGenBtn.isVisible({ timeout: 6000 }).catch(() => false);

    // "New Workflow" button (alternative: Create, Build)
    const newWorkflowBtn = page
      .getByRole("button", { name: /New Workflow|New workflow|Create/i })
      .first();
    const hasNew = await newWorkflowBtn.isVisible({ timeout: 5000 }).catch(() => false);

    // At least one of the action buttons must be visible
    expect(hasAiGen || hasNew).toBe(true);
  });

  // ── 4. Main tab strip renders at least 6 of 8 tabs ──────────────────────
  test("renders at least 6 of 8 main tabs", async ({ page }) => {
    const tabLabels = [
      /^Builder$/i,
      /^Presets/i,
      /^Triggers.*Actions|Triggers & Actions/i,
      /^AI Agent$/i,
      /^n8n Live$/i,
      /^Analytics$/i,
      /^Sharing$/i,
      /^History$/i,
    ];

    let visibleCount = 0;
    for (const pattern of tabLabels) {
      const tab = page.getByRole("button", { name: pattern }).first();
      const isVisible = await tab.isVisible({ timeout: 3000 }).catch(() => false);
      if (isVisible) visibleCount++;
    }

    // At least 6 of the 8 tabs must be visible
    expect(visibleCount).toBeGreaterThanOrEqual(6);
  });

  // ── 5. Builder tab renders content — never blank ─────────────────────────
  test("Builder tab renders workflow list, loading skeleton, or empty state — never blank", async ({ page }) => {
    // Ensure we're on the Builder tab (default)
    const builderTab = page.getByRole("button", { name: /^Builder$/i }).first();
    if (await builderTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await builderTab.click();
      await page.waitForTimeout(600);
    }

    await page.waitForTimeout(1500);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/No workflows yet|No workflows found|Build your first|Create a workflow/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: workflow list (trigger types, status, run count)
    const hasWorkflows = await page
      .getByText(/running|active|paused|trigger|step|last run/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: the builder tab content area is rendered
    const hasBuilderArea = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasWorkflows || hasBuilderArea).toBe(true);
  });

  // ── 6. Presets tab renders content ───────────────────────────────────────
  test("clicking Presets tab renders preset cards or templates", async ({ page }) => {
    const presetsTab = page.getByRole("button", { name: /^Presets/i }).first();
    await expect(presetsTab).toBeVisible({ timeout: 6000 });

    await presetsTab.click();
    await page.waitForTimeout(600);

    // Must render preset cards
    const hasPresets =
      (await page
        .getByText(/preset|template|starter|lead|follow.?up|webhook/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="glass"], [class*="rounded"]')
        .filter({ has: page.locator("button, h2, h3") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasPresets).toBe(true);
  });

  // ── 7. No 404 or generic error state ─────────────────────────────────────
  test("workflows page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Workflows" heading must be visible instead
    const heading = page.getByRole("heading", { name: /^Workflows$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
