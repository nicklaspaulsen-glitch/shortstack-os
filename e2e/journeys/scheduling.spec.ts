/**
 * Scheduling E2E — /dashboard/scheduling
 *
 * Tests the AI Smart Scheduler page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Appointment Booking" + h1 "AI Smart Scheduler"
 *   • Availability or booking configuration is visible
 *   • Scheduling content area renders — never blank
 *   • No 404 or generic error state
 *
 * No bookings are created or modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Scheduling — AI Smart Scheduler", () => {
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
    await page.goto("/dashboard/scheduling");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("scheduling page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/scheduling");
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
  test("renders editorial header with Appointment Booking eyebrow and AI Smart Scheduler h1", async ({ page }) => {
    const eyebrow = page.getByText(/Appointment Booking/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /AI Smart Scheduler/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Availability or booking configuration is visible ──────────────────
  test("availability or booking configuration is visible", async ({ page }) => {
    const hasAvailability = await page
      .getByText(/availability|available.*slots|weekly.*hours/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasBookings = await page
      .getByText(/recent.*booking|appointments|bookings/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCalendar = await page
      .getByText(/calendar|schedule|booking.*link/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasAvailability || hasBookings || hasCalendar).toBe(true);
  });

  // ── 4. Scheduling content area renders — never blank ────────────────────
  test("scheduling content area renders — never blank", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no.*bookings|no.*appointments|set.*up/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContent = await page
      .getByText(/Monday|Tuesday|Wednesday|Thu|9:00|10:00|am|pm/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasContainer = await page
      .locator('[class*="glass"], [class*="rounded-xl"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasContent || hasContainer).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("scheduling page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /AI Smart Scheduler/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
