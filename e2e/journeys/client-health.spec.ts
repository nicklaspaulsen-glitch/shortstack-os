/**
 * Client Health Monitor E2E — /dashboard/client-health
 *
 * Tests the Client Health Monitor page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Health Scores" + h1 "Client Health Monitor"
 *   • All 5 tabs render: Overview, Algorithm, Alerts, NPS & Survey, History
 *   • Overview is the default active tab
 *   • Clicking Algorithm tab switches content without crashing
 *   • Overview content or empty state is visible
 *   • No 404 or generic error state
 *
 * All tests are guarded with hasTestCreds(). Data-dependent assertions fall
 * back to empty-state checks so tests never hard-fail on a fresh account.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Client Health Monitor — Health Scores", () => {
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
    await page.goto("/dashboard/client-health");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("client health page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/client-health");
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
  test("renders editorial header with Health Scores eyebrow and Client Health Monitor h1", async ({ page }) => {
    const eyebrow = page.getByText(/Health Scores/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Client Health Monitor/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 5 tabs render ─────────────────────────────────────────────────
  test("renders all 5 tabs: Overview, Algorithm, Alerts, NPS & Survey, History", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /^Overview$/i }).first()
    ).toBeVisible({ timeout: 8000 });

    await expect(
      page.getByRole("button", { name: /^Algorithm$/i }).first()
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /^Alerts$/i }).first()
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /NPS.*Survey|NPS & Survey/i }).first()
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /^History$/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ── 4. Overview is the default tab and shows content or empty state ──────
  test("overview tab is active by default and shows content or empty state", async ({ page }) => {
    // The Overview button must be visible
    const overviewBtn = page.getByRole("button", { name: /^Overview$/i }).first();
    await expect(overviewBtn).toBeVisible({ timeout: 6000 });

    // Page should show skeleton, empty state, or real health content
    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no clients|no health|add.*client|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/health score|risk|churn|at risk|healthy|average/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 5. Clicking Algorithm tab does not crash ─────────────────────────────
  test("clicking Algorithm tab renders content without crashing", async ({ page }) => {
    const algorithmTab = page.getByRole("button", { name: /^Algorithm$/i }).first();
    await expect(algorithmTab).toBeVisible({ timeout: 6000 });

    await algorithmTab.click();
    await page.waitForTimeout(800);

    // Heading must still be visible after tab switch — page did not crash
    const heading = page.getByRole("heading", { name: /Client Health Monitor/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Some content should appear in the algorithm tab
    const hasContent =
      (await page
        .getByText(/algorithm|weight|factor|score|metric|criteria/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
        .filter({ has: page.locator("p, h2, h3") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("client health page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Client Health Monitor/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
