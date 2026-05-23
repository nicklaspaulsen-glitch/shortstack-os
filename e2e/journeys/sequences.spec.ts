/**
 * Email Sequences E2E — /dashboard/sequences
 *
 * Tests the Email Sequences page, an outreach automation builder with
 * six tabs covering sequence construction, templates, analytics, enrollment
 * rules, active runs, and settings.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Outreach Sequences" + h1 "Email Sequences"
 *   • All 6 tabs render via tab-pill-strip: Sequence Builder, Templates,
 *     Performance, Enrollment Rules, Active Runs, Settings
 *   • Sequence Builder is the default active tab (CSS .active class)
 *   • Clicking Templates tab switches content
 *   • No 404 or generic error state
 *
 * No sequences are created, contacts enrolled, or emails sent in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Email Sequences — Outreach Automation", () => {
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
    await page.goto("/dashboard/sequences");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("sequences page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/sequences");
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
  test("renders editorial header with Outreach Sequences eyebrow and Email Sequences h1", async ({ page }) => {
    const eyebrow = page.getByText(/Outreach Sequences/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Email Sequences/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. All 6 tabs render ─────────────────────────────────────────────────
  test("renders all 6 tabs in the tab-pill-strip", async ({ page }) => {
    const tabStrip = page.locator(".tab-pill-strip").first();
    await expect(tabStrip).toBeVisible({ timeout: 8000 });

    await expect(
      tabStrip.getByRole("button", { name: /Sequence Builder/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      tabStrip.getByRole("button", { name: /^Templates$/i })
    ).toBeVisible({ timeout: 4000 });

    await expect(
      tabStrip.getByRole("button", { name: /Performance/i })
    ).toBeVisible({ timeout: 4000 });

    await expect(
      tabStrip.getByRole("button", { name: /Enrollment Rules/i })
    ).toBeVisible({ timeout: 4000 });

    await expect(
      tabStrip.getByRole("button", { name: /Active Runs/i })
    ).toBeVisible({ timeout: 4000 });

    await expect(
      tabStrip.getByRole("button", { name: /^Settings$/i })
    ).toBeVisible({ timeout: 4000 });
  });

  // ── 4. Sequence Builder is the default active tab ────────────────────────
  test("Sequence Builder tab is the default active tab", async ({ page }) => {
    const tabStrip = page.locator(".tab-pill-strip").first();
    await expect(tabStrip).toBeVisible({ timeout: 6000 });

    const activeTab = tabStrip.locator(".tab-pill.active").first();
    await expect(activeTab).toBeVisible({ timeout: 5000 });

    const activeText = await activeTab.textContent();
    expect(activeText?.toLowerCase()).toContain("sequence builder");
  });

  // ── 5. Clicking Templates tab switches content ───────────────────────────
  test("clicking Templates tab renders template content", async ({ page }) => {
    const tabStrip = page.locator(".tab-pill-strip").first();
    await expect(tabStrip).toBeVisible({ timeout: 6000 });

    const templatesTab = tabStrip.getByRole("button", { name: /^Templates$/i }).first();
    await templatesTab.click();
    await page.waitForTimeout(600);

    await expect(templatesTab).toHaveClass(/active/, { timeout: 3000 });

    const hasContent =
      (await page
        .getByText(/template|sequence template|cold outreach|follow-up|nurture/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("[class*='glass'], [class*='rounded-xl']")
        .filter({ has: page.locator("h2, h3, p") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("sequences page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Email Sequences/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
