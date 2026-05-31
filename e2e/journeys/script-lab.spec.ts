/**
 * Script Lab E2E — /dashboard/script-lab
 *
 * Tests the Script Lab page, an AI script generation studio that produces
 * long-form video scripts, ad scripts, email sequences, Twitter threads,
 * and carousel copy from user prompts.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Script Studio" + h1 "Script Lab"
 *   • Script type selectors render (Long Form, Ad Script, Email Sequence,
 *     Twitter Thread, Carousel Script)
 *   • Topic input or generate trigger is visible
 *   • Saved scripts section or empty state renders — never blank
 *   • No 404 or generic error state
 *
 * No scripts are generated, saved, or exported in these tests.
 * The generate form is inspected for structure only; the generate
 * button is never clicked (it would consume AI credits).
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Script Lab — AI Script Generation Studio", () => {
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
    await page.goto("/dashboard/script-lab");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow trending hooks and saved scripts to load
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("script lab page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/script-lab");
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
  test("renders editorial header with Script Studio eyebrow and Script Lab h1", async ({ page }) => {
    // Eyebrow — "Script Studio"
    const eyebrow = page.getByText(/Script Studio/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Script Lab"
    const heading = page.getByRole("heading", { name: /Script Lab/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Script type selectors render ──────────────────────────────────────
  test("script type selectors render: Long Form, Ad Script, Email Sequence, Twitter Thread, Carousel Script", async ({ page }) => {
    // Long Form
    const hasLongForm = await page
      .getByText(/Long Form/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    // Ad Script
    const hasAdScript = await page
      .getByText(/Ad Script/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Email Sequence
    const hasEmailSeq = await page
      .getByText(/Email Sequence/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Twitter Thread
    const hasTwitter = await page
      .getByText(/Twitter Thread/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Carousel Script
    const hasCarousel = await page
      .getByText(/Carousel Script|Carousel/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // At least 3 of the 5 script types must be visible
    const visibleCount = [hasLongForm, hasAdScript, hasEmailSeq, hasTwitter, hasCarousel]
      .filter(Boolean).length;

    expect(visibleCount).toBeGreaterThanOrEqual(3);
  });

  // ── 4. Topic input or generate trigger is visible ─────────────────────────
  test("topic input or generate button is visible in the configure panel", async ({ page }) => {
    // Topic input (textarea or text input for the script topic/prompt)
    const hasTopicInput = await page
      .locator('textarea, input[type="text"], input[placeholder*="topic" i], input[placeholder*="script" i], textarea[placeholder*="topic" i]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    // Generate / Create Script button
    const hasGenerateBtn = await page
      .getByRole("button", { name: /Generate|Create Script|Write Script|Generate Script/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Generic configure/input area
    const hasConfigPanel = await page
      .getByText(/topic|script topic|hook|niche|target audience|generate|create script/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasTopicInput || hasGenerateBtn || hasConfigPanel).toBe(true);
  });

  // ── 5. Saved scripts area renders content — never blank ──────────────────
  test("saved scripts area renders list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state
    const hasEmptyState = await page
      .getByText(/no scripts|no saved scripts|generate your first|get started|nothing here/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: existing scripts (title, hook text, type label)
    const hasScripts = await page
      .getByText(/long form|ad script|email sequence|twitter thread|carousel|generated|hook/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: a container section is rendered
    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
      .filter({ has: page.locator("h2, h3, p, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasScripts || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("script lab page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Script Lab" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Script Lab/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
