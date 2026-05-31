/**
 * Billing E2E — /dashboard/billing
 *
 * Tests the Billing & Usage page, which shows the current subscription plan,
 * usage metrics, and links to plan management.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Billing" + h1 "Billing & Usage"
 *   • Current plan section is visible (plan name + Active badge)
 *   • "Upgrade plan" link is visible
 *   • "Manage subscription" button is visible
 *   • Usage or quota section renders
 *   • No 404 or generic error state
 *
 * No payments, plan changes, or subscription modifications are made.
 * This test is purely read-only.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Billing — Billing & Usage", () => {
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
    await page.goto("/dashboard/billing");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow billing data to load from Stripe/Supabase
    await page.waitForTimeout(2000);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("billing page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/billing");
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
  test("renders editorial header with Billing eyebrow and Billing & Usage h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/^Billing$/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Billing & Usage"
    const heading = page.getByRole("heading", { name: /Billing.*Usage|Billing & Usage/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Current plan section is visible ──────────────────────────────────
  test("current plan section renders with a plan name and Active badge", async ({ page }) => {
    // Plan badge shows "Active" next to the plan name
    const activeBadge = page.getByText(/^Active$/i).first();
    await expect(activeBadge).toBeVisible({ timeout: 8000 });

    // Plan name — one of the tiers or "free" / "internal"
    const hasPlanName = await page
      .getByText(/plan|starter|growth|pro|enterprise|free|Internal\/free/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasPlanName).toBe(true);
  });

  // ── 4. Upgrade plan link is visible ─────────────────────────────────────
  test("Upgrade plan link is visible", async ({ page }) => {
    const upgradeLink = page.getByRole("link", { name: /Upgrade plan/i }).first();
    await expect(upgradeLink).toBeVisible({ timeout: 6000 });
  });

  // ── 5. Manage subscription button is visible ────────────────────────────
  test("Manage subscription button is visible", async ({ page }) => {
    const manageBtn = page.getByRole("button", { name: /Manage subscription|Manage/i }).first();
    await expect(manageBtn).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Page renders usage or quota section ───────────────────────────────
  test("page renders usage section or plan feature list — never blank below the header", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasUsage =
      (await page
        .getByText(/usage|tokens?|credits?|quota|limit|included|plan features|seats|calls|leads/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="glass"], [class*="rounded-2xl"]')
        .filter({ has: page.locator("p, span") })
        .nth(1) // skip the plan hero, check second section
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasUsage).toBe(true);
  });

  // ── 7. No 404 or generic error state ─────────────────────────────────────
  test("billing page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Billing & Usage" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Billing.*Usage/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
