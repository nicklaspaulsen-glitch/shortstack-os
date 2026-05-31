/**
 * Tickets E2E — /dashboard/tickets
 *
 * Tests the Help & Support / Contact Support page.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Help & Support" + h1 "Contact Support"
 *   • Support form or contact options are visible
 *   • No 404 or generic error state
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Tickets — Contact Support", () => {
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
    await page.goto("/dashboard/tickets");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("tickets / contact support page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/tickets");
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
  test("renders editorial header with Help & Support eyebrow and Contact Support h1", async ({ page }) => {
    const eyebrow = page.getByText(/Help.*Support|Help & Support/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Contact Support/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Support form or contact options are visible ───────────────────────
  test("support form or contact options are visible", async ({ page }) => {
    // Valid state 1: a form or text/textarea input is present
    const hasForm = await page
      .locator("form, textarea, input[type=\"text\"]")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Valid state 2: a subject / category / priority / issue-type label is visible
    const hasCategory = await page
      .getByText(/subject|category|priority|issue.*type|ticket.*type/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: a submit / send / open-ticket action button is visible
    const hasSubmitBtn = await page
      .getByRole("button", { name: /submit|send.*ticket|contact|open.*ticket/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasForm || hasCategory || hasSubmitBtn).toBe(true);
  });

  // ── 4. No 404 or generic error state ─────────────────────────────────────
  test("tickets page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Contact Support/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
