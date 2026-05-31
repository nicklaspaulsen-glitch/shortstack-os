/**
 * Trinity AI E2E — /dashboard/trinity
 *
 * Tests the Trinity AI Command Center page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "AI Command Center" + h1 "Trinity AI"
 *   • Agent status grid or AI panels are visible
 *   • AI action input or command trigger is accessible
 *   • History or activity area renders — never blank
 *   • No 404 or generic error state
 *
 * No actions are dispatched or tasks created in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Trinity AI — AI Command Center", () => {
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
    await page.goto("/dashboard/trinity");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("trinity AI page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/trinity");
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
  test("renders editorial header with AI Command Center eyebrow and Trinity AI h1", async ({ page }) => {
    const eyebrow = page.getByText(/AI Command Center/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Trinity AI/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Agent status grid or AI panels are visible ───────────────────────
  test("agent status grid or AI panels are visible", async ({ page }) => {
    const hasGrid = await page
      .getByText(/Agent Status|Status Grid/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasOutput = await page
      .getByText(/Output Viewer|Combined Output/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasQueue = await page
      .getByText(/Task Queue|Unified Task/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .filter({ has: page.locator("h2") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasGrid || hasOutput || hasQueue || hasPanel).toBe(true);
  });

  // ── 4. AI action input or command trigger is accessible ─────────────────
  test("AI action input or command trigger is accessible", async ({ page }) => {
    const hasInput = await page
      .locator('textarea, input[type="text"]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasBtn = await page
      .getByRole("button", { name: /run|execute|dispatch|send|submit/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCommandArea = await page
      .getByText(/command|action|task|prompt/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasInput || hasBtn || hasCommandArea).toBe(true);
  });

  // ── 5. History or activity area renders — never blank ───────────────────
  test("history or activity area renders — never blank", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no.*actions|no.*history|get.*started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasHistory = await page
      .getByText(/history|action|trace|run/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasHistory || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("trinity page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Trinity AI/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
