/**
 * Social Studio E2E — /dashboard/social-studio
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Social Studio — Post Studio", () => {
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
    await page.goto("/dashboard/social-studio");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("social studio page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/social-studio");
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
  test("renders editorial header with Post Studio eyebrow and Social Studio h1", async ({ page }) => {
    const eyebrow = page.getByText(/Post Studio/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Social Studio/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 6 tab-pill tabs render ───────────────────────────────────────
  test("renders all 6 tab-pill tabs", async ({ page }) => {
    const tabLabels = [
      /^Calendar$/i,
      /^AI Auto-Upload$/i,
      /^Trends & Ideas$/i,
      /^Stats$/i,
      /^Top Commenters$/i,
      /^Creator AI$/i,
    ];

    for (const pattern of tabLabels) {
      const tab = page.getByRole("button", { name: pattern }).first();
      await expect(tab).toBeVisible({ timeout: 8000 });
    }
  });

  // ── 4. Calendar tab is active by default ────────────────────────────────
  test("Calendar tab is active by default", async ({ page }) => {
    const activeTab = page.locator(".tab-pill.active").first();
    await expect(activeTab).toBeVisible({ timeout: 8000 });

    const text = await activeTab.textContent();
    expect((text ?? "").toLowerCase()).toContain("calendar");
  });

  // ── 5. Content area renders calendar, loading state, or empty state ─────
  test("content area renders calendar, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no posts|no scheduled|nothing scheduled|get started|create your first/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/scheduled|posted|caption|post/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl']")
      .filter({ has: page.locator("p, span, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasContent || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("social studio page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Social Studio/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
