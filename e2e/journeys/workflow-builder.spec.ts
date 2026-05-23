// Workflow Builder E2E — /dashboard/workflow-builder

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Workflow Builder — Workflow Design", () => {
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
    await page.goto("/dashboard/workflow-builder");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("workflow builder page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/workflow-builder");
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
  test("renders editorial header with Workflow Design eyebrow and Workflow Builder h1", async ({ page }) => {
    const eyebrow = page.getByText(/Workflow Design/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Workflow Builder/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Workflow canvas or template list renders — never blank ───────────────
  test("workflow canvas or template list renders — never blank", async ({ page }) => {
    const hasSkeleton = await page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no workflows|create.*first|start.*building/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasWorkflows = await page
      .getByText(/trigger|action|condition|step|node|automation/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasContainer = await page
      .locator(
        '[class*="canvas"], [class*="flow"], [class*="board"], [class*="builder"], [class*="workflow"], form, [class*="panel"]',
      )
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasWorkflows || hasContainer).toBe(true);
  });

  // ── 4. Create workflow or add step trigger is visible ───────────────────────
  test("create workflow or add step trigger is visible", async ({ page }) => {
    const hasCreate = await page
      .getByRole("button", { name: /create.*workflow|new.*workflow|add.*step|start/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasCanvas = await page
      .locator('[class*="canvas"], [class*="flow"], [class*="board"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasTemplate = await page
      .getByText(/template|blank|start.*from/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasCreate || hasCanvas || hasTemplate).toBe(true);
  });

  // ── 5. No 404 + heading present ─────────────────────────────────────────────
  test("workflow builder page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Workflow Builder/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
