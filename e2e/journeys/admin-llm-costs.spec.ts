/**
 * Admin LLM Costs E2E — /dashboard/admin/llm-costs
 *
 * Tests the admin/founder LLM cost dashboard. Verifies:
 *   • Page loads without JS errors
 *   • Renders a heading (either "LLM Cost Dashboard" or the role-gated "Admin only")
 *   • No 404 or generic error state
 *
 * The test account may or may not have admin/founder role — both outcomes are
 * valid as long as the page renders intentional UI rather than crashing.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Admin — LLM Cost Dashboard", () => {
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
    await page.goto("/dashboard/admin/llm-costs");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("admin/llm-costs page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/admin/llm-costs");
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

  // ── 2. A heading renders — either LLM Cost Dashboard or access denied ────
  test("renders a meaningful heading — cost dashboard or role-gate", async ({ page }) => {
    // Either the full dashboard heading (admin/founder account)
    // OR the intentional role-gate message (non-admin account) — both are valid
    const heading = page
      .getByRole("heading", {
        name: /LLM Cost Dashboard|Admin only/i,
      })
      .first();

    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  // ── 3. No 404 or generic error state ─────────────────────────────────────
  test("admin/llm-costs page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // Either the dashboard or the role-gate must be visible
    const hasContent =
      (await page
        .getByRole("heading", { name: /LLM Cost Dashboard|Admin only/i })
        .first()
        .isVisible({ timeout: 8000 })
        .catch(() => false)) ||
      (await page.getByText(/LLM cost|admin|founder|cost data/i).first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });
});
