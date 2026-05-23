// Workspaces E2E — /dashboard/workspaces

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Workspaces — Multi-tenant Setup", () => {
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
    await page.goto("/dashboard/workspaces");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("workspaces page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/workspaces");
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

  // ── 2. Editorial header: eyebrow + h1 ──────────────────────────────────────
  test("renders editorial header with Multi-tenant Setup eyebrow and Workspaces h1", async ({ page }) => {
    const eyebrow = page.getByText(/Multi-tenant Setup/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Workspaces/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Workspace list or create form renders — never blank ──────────────────
  test("workspace list or create form renders — never blank", async ({ page }) => {
    const hasSkeleton = await page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no workspaces|create.*first|add.*workspace/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasWorkspaces = await page
      .getByText(/workspace.*name|active|inactive|clients|members|created/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasContainer = await page
      .locator(
        '[class*="workspace"], [class*="tenant"], form, [class*="panel"], [class*="card"], table',
      )
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasWorkspaces || hasContainer).toBe(true);
  });

  // ── 4. No 404 + heading present ─────────────────────────────────────────────
  test("workspaces page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Workspaces/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
