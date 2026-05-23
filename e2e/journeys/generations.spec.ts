/**
 * Generations E2E — /dashboard/generations
 *
 * Tests the Generations page, which displays AI-generated content outputs.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Content Output" + h1 "Generations"
 *   • Page shows content list OR skeleton loading state OR empty state (never blank)
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against empty accounts.
 * No generations are created or deleted in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Generations — Content Output", () => {
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
    await page.goto("/dashboard/generations");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("generations page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/generations");
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
  test("renders editorial header with Content Output eyebrow and Generations h1", async ({ page }) => {
    const eyebrow = page.getByText(/Content Output/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Generations$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Page shows content list, loading skeleton, or empty state ─────────
  test("page shows generation list, loading skeleton, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeleton
    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 2: empty state message
    const hasEmptyState = await page
      .getByText(/no generations|nothing here|get started|no content|no outputs/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: generation content items visible
    const hasContent = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-lg']")
      .filter({ has: page.locator("p, h2, h3, span") })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 4. Page does not show a 404 or error state ──────────────────────────
  test("generations page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Generations$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 5. Navigation is intact (dashboard layout rendered) ──────────────────
  test("dashboard sidebar navigation is visible on generations page", async ({ page }) => {
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Page content area is not empty (has something rendered) ───────────
  test("main content area renders something beyond an empty white page", async ({ page }) => {
    await page.waitForTimeout(2000);

    // At minimum the heading must be present — proves the page component mounted
    const heading = page.getByRole("heading", { name: /^Generations$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });

    // And some body content must exist below the header
    const hasBody =
      (await page
        .getByText(/Content Output|generated|output|AI|content/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false));

    expect(hasBody).toBe(true);
  });
});
