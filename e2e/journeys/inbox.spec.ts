/**
 * Inbox E2E — /dashboard/inbox
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Inbox — Message Center", () => {
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
    await page.goto("/dashboard/inbox");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("inbox page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/inbox");
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
  test("renders editorial header with Message Center eyebrow and Inbox h1", async ({ page }) => {
    const eyebrow = page.getByText(/Message Center/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Inbox/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Message list panel renders or shows empty state ───────────────────
  test("message list panel renders or shows empty state", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no messages|all caught up|empty inbox|no conversations/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasMessages = await page
      .getByText(/subject|from|reply|forward|unread/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl']")
      .filter({ has: page.locator("p, span, button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasMessages || hasContainer).toBe(true);
  });

  // ── 4. Compose or reply action is accessible ─────────────────────────────
  test("compose or reply action is accessible", async ({ page }) => {
    const hasComposeBtn = await page
      .getByRole("button", { name: /compose|new message|reply/i })
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasSendBtn = await page
      .getByRole("button", { name: /send/i })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasComposeText = await page
      .getByText(/compose|new message|write/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasComposeBtn || hasSendBtn || hasComposeText).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("inbox page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /Inbox/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
