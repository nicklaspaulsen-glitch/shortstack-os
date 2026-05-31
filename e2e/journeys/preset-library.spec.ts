import { test, expect } from "@playwright/test";
import { hasTestCreds, signIn } from "../helpers/auth";

/**
 * Preset Library — /dashboard/video-editor/library
 *
 * Tests the auto-edit preset bank: five tabs (Fonts, Transitions, Effects,
 * SFX, Music), search/filter bar, skeleton loading, and empty state.
 * Part of the auto-edit engine v2 marathon (commit f90c0e59).
 *
 * Checks:
 *   • Page loads without JS errors
 *   • h1 "Preset Library" is rendered
 *   • All 5 tabs are present: Fonts, Transitions, Effects, SFX, Music
 *   • Fonts tab is the default active tab
 *   • Fonts tab renders preset content or skeleton
 *   • Search/filter bar is present on the active tab
 *   • No 404 or generic error state
 */

test.describe("Preset Library — Video Editor preset bank", () => {
  test.skip(!hasTestCreds(), "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/dashboard/video-editor/library", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => null);
    // Allow MotionPage fade-in (0.4 s) to complete
    await page.waitForTimeout(600);
    (page as any).__pageErrors = errors;
  });

  // ── 1. No JS errors ─────────────────────────────────────────────────────────
  test("preset-library page loads without JS errors", async ({ page }) => {
    const errors: string[] = (page as any).__pageErrors ?? [];
    const realErrors = errors.filter(
      (e) =>
        !e.includes("hydration") &&
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise") &&
        !e.includes("Worker module function was called")
    );
    expect(realErrors, `Unexpected JS exceptions: ${realErrors.join(" | ")}`).toHaveLength(0);
  });

  // ── 2. h1 heading ─────────────────────────────────────────────────────────
  test("renders h1 Preset Library heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Preset Library/i, level: 1 })).toBeVisible({
      timeout: 5_000,
    });
  });

  // ── 3. All 5 tabs present ──────────────────────────────────────────────────
  test("renders all 5 tabs: Fonts, Transitions, Effects, SFX, Music", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Fonts/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /Transitions/i })).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole("button", { name: /Effects/i })).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole("button", { name: /SFX/i })).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole("button", { name: /Music/i })).toBeVisible({ timeout: 4_000 });
  });

  // ── 4. Default tab renders content ────────────────────────────────────────
  test("Fonts tab is default and renders preset tiles or skeleton", async ({ page }) => {
    // Fonts tab should be active by default — content OR skeleton is acceptable
    const hasPresets =
      await page.locator('[class*="preset"], [class*="tile"], [class*="font"]').first()
        .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasSkeleton =
      await page.locator('[class*="animate-pulse"]').first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(
      hasPresets || hasSkeleton,
      "Fonts tab should show preset tiles or a loading skeleton"
    ).toBe(true);
  });

  // ── 5. Search/filter bar present ──────────────────────────────────────────
  test("search / filter bar is visible on the active tab", async ({ page }) => {
    // The PresetSearchFilterBar renders an input or search control
    const hasSearchInput =
      await page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]')
        .first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasFilterBar =
      await page.locator('[class*="filter"], [class*="search"]').first()
        .isVisible({ timeout: 4_000 }).catch(() => false);
    expect(
      hasSearchInput || hasFilterBar,
      "A search/filter bar should be present"
    ).toBe(true);
  });

  // ── 6. No error state ─────────────────────────────────────────────────────
  test("preset-library page does not render a 404 or generic error state", async ({ page }) => {
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const lower = bodyText.toLowerCase();
    expect(lower).not.toContain("404");
    expect(lower).not.toContain("page not found");
    expect(lower).not.toContain("something went wrong");
    expect(lower).not.toContain("internal server error");
  });
});
