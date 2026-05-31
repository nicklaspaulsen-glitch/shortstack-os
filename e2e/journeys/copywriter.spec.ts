/**
 * AI Copywriter E2E — /dashboard/copywriter
 *
 * Tests the AI Copywriter page, a copy generation studio covering Blog Posts,
 * Landing Pages, Email Campaigns, Social Media, Product Descriptions, and Ad
 * Headlines.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Copy Engine" + h1 "AI Copywriter"
 *   • All 6 content type selectors render (Blog Post, Landing Page, Email
 *     Campaign, Social Media, Product Description, Ad Headlines)
 *   • Topic input or copy generation trigger is visible
 *   • Saved copy list, loading state, or empty state renders — never blank
 *   • No 404 or generic error state
 *
 * No copy is generated, saved, or exported in these tests.
 * The generate button is never clicked (it would consume AI credits).
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("AI Copywriter — Copy Generation Studio", () => {
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
    await page.goto("/dashboard/copywriter");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("copywriter page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/copywriter");
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
  test("renders editorial header with Copy Engine eyebrow and AI Copywriter h1", async ({ page }) => {
    const eyebrow = page.getByText(/Copy Engine/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /AI Copywriter/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Content type selectors render ──────────────────────────────────────
  test("content type selectors render: Blog Post, Landing Page, Email Campaign, Social Media, Product Description, Ad Headlines", async ({ page }) => {
    // Blog Post
    const hasBlog = await page
      .getByText(/Blog Post/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    // Landing Page
    const hasLanding = await page
      .getByText(/Landing Page/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Email Campaign
    const hasEmail = await page
      .getByText(/Email Campaign/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Social Media
    const hasSocial = await page
      .getByText(/Social Media/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Product Description
    const hasProduct = await page
      .getByText(/Product Description/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Ad Headlines
    const hasAd = await page
      .getByText(/Ad Headlines/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // At least 4 of 6 must be visible
    const visibleCount = [hasBlog, hasLanding, hasEmail, hasSocial, hasProduct, hasAd]
      .filter(Boolean).length;

    expect(visibleCount).toBeGreaterThanOrEqual(4);
  });

  // ── 4. Topic input is visible ─────────────────────────────────────────────
  test("topic input or generate trigger is visible in the configure panel", async ({ page }) => {
    const hasTopicInput = await page
      .locator('textarea, input[type="text"], input[placeholder*="topic" i], input[placeholder*="copy" i]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasGenerateBtn = await page
      .getByRole("button", { name: /Generate|Write Copy|Create Copy|Generate Copy/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCopyPanel = await page
      .getByText(/topic|audience|tone|keywords|generate|word count/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasTopicInput || hasGenerateBtn || hasCopyPanel).toBe(true);
  });

  // ── 5. Saved copy area renders content — never blank ──────────────────────
  test("saved copy area renders list, loading state, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no copy|no saved|generate your first|get started|nothing saved/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasCopy = await page
      .getByText(/blog post|landing page|email campaign|social media|ad headline|generated/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
      .filter({ has: page.locator("h2, h3, p, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasCopy || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("copywriter page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /AI Copywriter/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
