/**
 * Carousel Generator E2E — /dashboard/carousel-generator
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Carousel Generator", () => {
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
    await page.goto("/dashboard/carousel-generator");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("carousel generator page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/carousel-generator");
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
  test("renders editorial header with Visual Carousels eyebrow and Carousel Generator h1", async ({ page }) => {
    const eyebrow = page.getByText(/Visual Carousels/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Carousel Generator/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Platform selector is visible ─────────────────────────────────────
  test("platform selector is visible (Instagram, LinkedIn)", async ({ page }) => {
    const hasInstagram = await page
      .getByText(/Instagram/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasLinkedIn = await page
      .getByText(/LinkedIn/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasPlatformLabel = await page
      .getByText(/platform|choose.*platform|select.*platform/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasInstagram || hasLinkedIn || hasPlatformLabel).toBe(true);
  });

  // ── 4. Topic input or carousel type selector is visible ─────────────────
  test("topic input or carousel type selector is visible", async ({ page }) => {
    const hasTopicInput = await page
      .locator('textarea, input[type="text"]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasTypeSelector = await page
      .getByText(/how.to|guide|tutorial|content.*type|carousel.*type/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasWizardStep = await page
      .getByText(/topic|idea|suggest.*topic|generate|step/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasTopicInput || hasTypeSelector || hasWizardStep).toBe(true);
  });

  // ── 5. Generate button or AI trigger is visible ──────────────────────────
  test("generate button or AI trigger is visible", async ({ page }) => {
    const hasGenBtn = await page
      .getByRole("button", { name: /generate|create.*carousel|suggest.*topic|create/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasAITrigger = await page
      .getByText(/generate.*carousel|create.*slides|ai.*generate/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasGenBtn || hasAITrigger).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("carousel generator page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Carousel Generator/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
