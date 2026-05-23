/**
 * SMS Templates E2E — /dashboard/sms-templates
 *
 * Tests the SMS Templates page, which manages message templates for
 * outbound SMS campaigns with TCPA compliance tooling.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Message Templates" + h1 "SMS Templates"
 *   • "Template Library" tab button is visible and the default view
 *   • Template list or empty state is visible under the default tab
 *   • "Preview" tab button is clickable without crashing
 *   • No 404 or generic error state
 *
 * No templates are created or sent in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

const TABS = [
  { key: "library", label: "Template Library" },
  { key: "preview", label: "Preview" },
  { key: "compliance", label: "TCPA Compliance" },
  { key: "analytics", label: "SMS Analytics" },
  { key: "links", label: "Short Links" },
  { key: "schedule", label: "Schedule" },
] as const;

test.describe("SMS Templates — Message Templates", () => {
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
    await page.goto("/dashboard/sms-templates");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("sms-templates page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/sms-templates");
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
  test("renders editorial header with Message Templates eyebrow and SMS Templates h1", async ({ page }) => {
    const eyebrow = page.getByText(/Message Templates/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /SMS Templates/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Template Library tab button is visible (default) ─────────────────
  test("Template Library tab button is visible as the default tab", async ({ page }) => {
    const libraryTab = page
      .getByRole("button", { name: /Template Library/i })
      .first();
    await expect(libraryTab).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Template list or empty state renders under the default tab ────────
  test("shows template list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no templates|create your first|get started|add a template/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: template rows/cards (names, categories, SMS body text)
    const hasTemplates = await page
      .getByText(/follow.?up|appointment|reminder|opt.?out|reply stop|template/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any rendered content panel
    const hasPanel = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasTemplates || hasPanel).toBe(true);
  });

  // ── 5. Preview tab is clickable without crashing ─────────────────────────
  test("clicking Preview tab renders content without crashing", async ({ page }) => {
    const previewTab = page
      .getByRole("button", { name: /^Preview$/i })
      .first();
    await expect(previewTab).toBeVisible({ timeout: 6000 });

    await previewTab.click();
    await page.waitForTimeout(800);

    // Heading must still be visible — page did not crash
    const heading = page.getByRole("heading", { name: /SMS Templates/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Some content should appear in the preview panel
    const hasContent =
      (await page
        .getByText(/preview|phone|message|select.*template/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="glass"], [class*="rounded"]')
        .filter({ has: page.locator("p, h2, h3, input") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("sms-templates page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /SMS Templates/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
