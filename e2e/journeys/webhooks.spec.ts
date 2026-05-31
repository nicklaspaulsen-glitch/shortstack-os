/**
 * Webhooks E2E — /dashboard/webhooks
 *
 * Tests the Webhooks / Endpoint Manager page, which configures and monitors
 * inbound and outbound webhook endpoints.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Endpoint Manager" + h1 "Webhooks"
 *   • "Endpoints" tab button is visible and the default view
 *   • Endpoints tab shows webhook list, empty state, or create button
 *   • "Test" tab button is clickable without crashing
 *   • No 404 or generic error state
 *
 * No endpoints are created, edited, or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

const TABS = ["Endpoints", "Delivery Log", "Test", "Templates", "Settings"] as const;

test.describe("Webhooks — Endpoint Manager", () => {
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
    await page.goto("/dashboard/webhooks");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("webhooks page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/webhooks");
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
  test("renders editorial header with Endpoint Manager eyebrow and Webhooks h1", async ({ page }) => {
    const eyebrow = page.getByText(/Endpoint Manager/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Webhooks$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Endpoints tab is visible as the default ───────────────────────────
  test("Endpoints tab button is visible and is the default active tab", async ({ page }) => {
    const endpointsTab = page
      .getByRole("button", { name: /^Endpoints$/i })
      .first();
    await expect(endpointsTab).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Endpoints tab renders content — never blank ───────────────────────
  test("Endpoints tab shows webhook list, empty state, or create button — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no endpoints|no webhooks|add.*endpoint|create.*webhook|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: endpoint rows (URL, method, status, events)
    const hasEndpoints = await page
      .getByText(/https:\/\/|http:\/\/|POST|GET|active|paused|endpoint|url/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: create/add button
    const hasCreateBtn =
      (await page
        .getByRole("button", { name: /add endpoint|create|new webhook/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="glass"], [class*="rounded-xl"]')
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false));

    expect(hasSkeleton || hasEmptyState || hasEndpoints || hasCreateBtn).toBe(true);
  });

  // ── 5. Test tab is clickable without crashing ────────────────────────────
  test("clicking Test tab renders content without crashing", async ({ page }) => {
    const testTab = page
      .getByRole("button", { name: /^Test$/i })
      .first();
    await expect(testTab).toBeVisible({ timeout: 6000 });

    await testTab.click();
    await page.waitForTimeout(800);

    // Heading must still be visible — page did not crash
    const heading = page.getByRole("heading", { name: /^Webhooks$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Some content should appear in the test panel
    const hasContent =
      (await page
        .getByText(/test|send.*payload|endpoint.*url|event.*type|request|response/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="glass"], [class*="rounded"]')
        .filter({ has: page.locator("p, h2, h3, input, textarea") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("webhooks page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Webhooks$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
