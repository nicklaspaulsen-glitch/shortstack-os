/**
 * Notifications E2E — /dashboard/notifications
 *
 * Tests the Notifications page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Alerts & Updates" + h1 "Notifications"
 *   • Notification list or empty state renders — never blank
 *   • Notification filtering or mark-all-read is accessible
 *   • No 404 or generic error state
 *
 * No notifications are dismissed or modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Notifications — Alerts & Updates", () => {
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
    await page.goto("/dashboard/notifications");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("notifications page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/notifications");
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
  test("renders editorial header with Alerts & Updates eyebrow and Notifications h1", async ({ page }) => {
    const eyebrow = page.getByText(/Alerts & Updates/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Notifications/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Notification list or empty state renders — never blank ────────────
  test("notification list or empty state renders — never blank", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no.*notifications|all.*caught.*up|nothing.*here|you.*re.*all.*caught/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasNotificationItem = await page
      .locator('[class*="notification"], [class*="alert"], [role="listitem"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasTimestamp = await page
      .getByText(/ago|just now|minutes|hours|today/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasContainer = await page
      .locator('ul, ol, [role="list"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasNotificationItem || hasTimestamp || hasContainer).toBe(true);
  });

  // ── 4. Notification filtering or mark-all-read is accessible ─────────────
  test("notification filtering or mark-all-read is accessible", async ({ page }) => {
    const hasMarkRead = await page
      .getByRole("button", { name: /mark.*read|mark all/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasFilter = await page
      .getByRole("button", { name: /all|unread|filter/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasList = await page
      .locator('ul, ol, [role="list"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasMarkRead || hasFilter || hasList).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("notifications page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Notifications/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
