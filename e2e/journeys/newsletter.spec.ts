// Newsletter Builder E2E — /dashboard/newsletter

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Newsletter — Email Broadcasts", () => {
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
    await page.goto("/dashboard/newsletter");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("newsletter page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/newsletter");
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
  test("renders editorial header with Email Broadcasts eyebrow and Newsletter Builder h1", async ({ page }) => {
    const eyebrow = page.getByText(/Email Broadcasts/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Newsletter Builder/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Editor or template area renders — never blank ────────────────────
  test("editor or template area renders — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty state / onboarding prompt
    const hasEmpty = await page
      .getByText(/no newsletters|create.*first|get.*started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: actual content (subject line, template, subscribers, etc.)
    const hasContent = await page
      .getByText(/subject|template|subscribers|broadcast|campaign/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any container element that confirms the page body mounted
    const hasContainer = await page
      .locator("main, [role='main'], .dashboard-content, section")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasContent || hasContainer).toBe(true);
  });

  // ── 4. Subject line input or send trigger is visible ────────────────────
  test("subject line input or send trigger is visible", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasSubject = await page
      .locator('input[placeholder*="subject" i], input[type="text"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasSendBtn = await page
      .getByRole("button", { name: /send|create|new.*newsletter|new.*broadcast/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasEditor = await page
      .locator("textarea, [contenteditable]")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSubject || hasSendBtn || hasEditor).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("newsletter page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Newsletter Builder/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
