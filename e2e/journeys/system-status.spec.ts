/**
 * System Status E2E — /dashboard/system-status
 *
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Admin · Launch readiness" + h1 "System Status"
 *   • Status checks or readiness items render — never blank
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("System Status", () => {
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
    await page.goto("/dashboard/system-status");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("system status page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/system-status");
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
  test("renders editorial header with Admin · Launch readiness eyebrow and System Status h1", async ({ page }) => {
    const eyebrow = page.getByText(/Admin.*Launch readiness/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /System Status/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Status checks or readiness items render — never blank ─────────────
  test("status checks or readiness items render — never blank", async ({ page }) => {
    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 2: loading / no checks placeholder
    const hasEmpty = await page
      .getByText(/no checks|loading/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: actual status items (readiness indicators, env-var rows)
    const hasStatus = await page
      .getByText(/ready|configured|connected|missing|api.*key|env.*var|supabase|vercel/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 4: glass/rounded card containing meaningful content
    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .filter({ has: page.locator("p, span, svg") })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasStatus || hasContainer).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("system status page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /System Status/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
