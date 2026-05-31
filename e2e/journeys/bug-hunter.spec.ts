/**
 * BugHunter E2E — /dashboard/bug-hunter
 *
 * Tests the Claude BugHunter integration dashboard page.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders with BugHunter h1
 *   • Four tabs render: Overview, Scan, Findings, Reports
 *   • Overview tab content mounts (capability map or quick-launch)
 *   • No 404 or generic error state
 *
 * No actual security scans are initiated in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("BugHunter — Claude Security Integration", () => {
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
    await page.goto("/dashboard/bug-hunter");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("bug-hunter page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/bug-hunter");
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

  // ── 2. Editorial header renders ──────────────────────────────────────────
  test("renders editorial header with BugHunter h1", async ({ page }) => {
    const heading = page
      .getByRole("heading", { name: /bug.?hunter|BugHunter/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 3. All 4 tabs render ─────────────────────────────────────────────────
  test("renders all 4 tabs: Overview, Scan, Findings, Reports", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^Overview$/i }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /^Scan$/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Findings/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Reports/i }).first()).toBeVisible({ timeout: 5000 });
  });

  // ── 4. Overview tab renders capability map ───────────────────────────────
  test("Overview tab renders capability content — never blank", async ({ page }) => {
    await page.waitForTimeout(1000);

    const hasContent =
      (await page
        .getByText(/overview|capability|scan|finding|vulnerability|security|wapt/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .locator("main section, main ul, main button")
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("bug-hunter page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page
      .getByRole("heading", { name: /bug.?hunter|BugHunter/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
