/**
 * Design Studio E2E — /dashboard/design-studio
 *
 * Tests the Design Studio page, the creative workspace for brand assets.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "DESIGN STUDIO" + h1 "Design Studio"
 *   • Design tools or project area renders — never blank
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Design Studio", () => {
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
    await page.goto("/dashboard/design-studio");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("design studio page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/design-studio");
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
  test("renders editorial header with DESIGN STUDIO eyebrow and Design Studio h1", async ({ page }) => {
    const eyebrow = page.getByText(/DESIGN STUDIO/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Design Studio/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Design tools or project area renders — never blank ────────────────
  test("design tools or project area renders — never blank", async ({ page }) => {
    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 2: empty / onboarding state
    const hasEmpty = await page
      .getByText(/no designs|create.*first|get.*started|start.*designing/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: design tool surfaces (templates, canvas, brand kit, actions)
    const hasTools = await page
      .getByText(/template|canvas|brand.*kit|create.*design|new.*design/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 4: a glass/rounded container holding interactive children
    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .filter({ has: page.locator("button, h2, h3") })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasTools || hasContainer).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("design studio page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Design Studio/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
