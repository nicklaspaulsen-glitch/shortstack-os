// DM Controller E2E — /dashboard/dm-controller

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("DM Controller — DM Controller", () => {
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
    await page.goto("/dashboard/dm-controller");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("dm-controller page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/dm-controller");
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
  test("renders editorial header with DM CONTROLLER eyebrow and DM Controller h1", async ({ page }) => {
    const eyebrow = page.getByText(/DM CONTROLLER/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /DM Controller/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. DM threads or empty state renders — never blank ──────────────────
  test("DM threads or empty state renders — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty / connect platform prompt
    const hasEmpty = await page
      .getByText(/no.*dm|no.*messages|connect.*instagram|connect.*platform/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: thread content
    const hasThreads = await page
      .getByText(/instagram|tiktok|facebook|dm.*from|reply/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any container that confirms the page body mounted
    const hasContainer = await page
      .locator("main, [role='main'], .dashboard-content, section")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasThreads || hasContainer).toBe(true);
  });

  // ── 4. Platform connection or message composer is visible ────────────────
  test("platform connection or message composer is visible", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasPlatform = await page
      .getByText(/Instagram|TikTok|connect.*account|linked.*account/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasCompose = await page
      .locator("textarea, input[type='text']")
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasAction = await page
      .getByRole("button", { name: /connect|send.*dm|reply|compose|refresh/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasPlatform || hasCompose || hasAction).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("dm-controller page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /DM Controller/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
