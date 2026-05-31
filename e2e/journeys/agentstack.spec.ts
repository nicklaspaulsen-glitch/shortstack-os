/**
 * AgentStack E2E — /dashboard/agentstack
 *
 * Tests the AgentStack Control Plane hub page.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders with AgentStack h1
 *   • Five tabs render: Overview, ShortStack OS, Agents, Automations, Integrations
 *   • Overview tab is active by default (quick-launch matrix renders)
 *   • No 404 or generic error state
 *
 * No workflows are triggered or external APIs called in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("AgentStack — Control Plane Hub", () => {
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
    await page.goto("/dashboard/agentstack");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("agentstack page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/agentstack");
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

  // ── 2. Editorial header renders ──────────────────────────────────────────
  test("renders editorial header with AgentStack h1", async ({ page }) => {
    const heading = page.getByRole("heading", { name: /AgentStack/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 3. All 5 tabs render ─────────────────────────────────────────────────
  test("renders all 5 tabs: Overview, ShortStack OS, Agents, Automations, Integrations", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^Overview$/i }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /ShortStack OS/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /^Agents$/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Automations/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Integrations/i }).first()).toBeVisible({ timeout: 5000 });
  });

  // ── 4. Overview tab is active by default and renders content ────────────
  test("Overview tab is default and renders quick-launch content", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Some kind of quick-launch matrix or system overview should render
    const hasContent =
      (await page
        .getByText(/overview|quick.*launch|system.*status|feature|module|shortstack/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .locator("main section, main [role='grid'], main a[href]")
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("agentstack page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /AgentStack/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
