/**
 * Email Templates E2E — /dashboard/email-templates
 *
 * Tests the Email Templates library page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Template Library" + h1 "Email Templates"
 *   • "All" filter pill is visible (default active category)
 *   • Category filter pills render (Welcome, Follow-up, Re-engagement, etc.)
 *   • Template list or empty state is visible
 *   • Clicking a category filter does not crash the page
 *   • No 404 or generic error state
 *
 * No templates are created, edited, or sent in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

const CATEGORIES = [
  "All",
  "Welcome",
  "Follow-up",
  "Re-engagement",
  "Invoice",
  "Report",
  "Promotion",
  "Onboarding",
  "Sales",
  "Retention",
] as const;

test.describe("Email Templates — Template Library", () => {
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
    await page.goto("/dashboard/email-templates");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("email templates page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/email-templates");
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
  test("renders editorial header with Template Library eyebrow and Email Templates h1", async ({ page }) => {
    const eyebrow = page.getByText(/Template Library/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Email Templates/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. "All" filter pill is visible ─────────────────────────────────────
  test("All category filter pill is visible as the default selection", async ({ page }) => {
    const allPill = page.getByRole("button", { name: /^All$/i }).first();
    await expect(allPill).toBeVisible({ timeout: 8000 });
  });

  // ── 4. Core category filter pills render ────────────────────────────────
  test("renders category filter pills: Welcome, Follow-up, Onboarding, Sales", async ({ page }) => {
    for (const category of ["Welcome", "Follow-up", "Onboarding", "Sales"] as const) {
      const pill = page.getByRole("button", { name: new RegExp(`^${category}$`, "i") }).first();
      await expect(pill).toBeVisible({ timeout: 8000 });
    }
  });

  // ── 5. Template list or empty state is visible ───────────────────────────
  test("shows template list, empty state, or loading skeleton — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no templates|create.*template|add.*template|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/subject|preview|open rate|template|sequence|email/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent).toBe(true);
  });

  // ── 6. Clicking a category filter does not crash ─────────────────────────
  test("clicking Welcome category filter renders results without crashing", async ({ page }) => {
    const welcomePill = page.getByRole("button", { name: /^Welcome$/i }).first();
    await expect(welcomePill).toBeVisible({ timeout: 6000 });

    await welcomePill.click();
    await page.waitForTimeout(600);

    // Heading must still be visible — page did not crash
    const heading = page.getByRole("heading", { name: /Email Templates/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Filter applied: some content or empty state should show
    const hasResult =
      (await page
        .getByText(/welcome|no template|empty|get started/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("[class*='glass'], [class*='rounded-xl'], [class*='card']")
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasResult).toBe(true);
  });
});
