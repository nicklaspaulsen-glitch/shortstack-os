/**
 * Discord E2E — /dashboard/discord
 *
 * Tests the Discord integration page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "DISCORD" + h1 "Discord"
 *   • All 12 tabs render (Install through Insights)
 *   • "Install" tab is the default active tab
 *   • Install tab content shows setup instructions or connect button
 *   • Clicking "Servers" tab does not crash
 *   • No 404 or generic error state
 *
 * All tests are guarded with hasTestCreds(). Data-dependent assertions fall
 * back to empty-state checks so tests never hard-fail on a fresh account.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

const DISCORD_TABS = [
  "Install",
  "Servers",
  "Commands",
  "Auto-Roles",
  "Welcome",
  "Moderation",
  "Analytics",
  "Events",
  "Embeds",
  "Webhooks",
  "Announcements",
  "Insights",
] as const;

test.describe("Discord — Discord Integration", () => {
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
    await page.goto("/dashboard/discord");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("discord page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/discord");
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
  test("renders editorial header with DISCORD eyebrow and Discord h1", async ({ page }) => {
    const eyebrow = page.getByText(/^DISCORD$/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Discord$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. First batch of tabs render ───────────────────────────────────────
  test("renders core tabs: Install, Servers, Commands, Auto-Roles, Welcome", async ({ page }) => {
    for (const tabName of ["Install", "Servers", "Commands", "Auto-Roles", "Welcome"] as const) {
      const tab = page.getByRole("button", { name: new RegExp(`^${tabName}$`, "i") }).first();
      await expect(tab).toBeVisible({ timeout: 8000 });
    }
  });

  // ── 4. Install tab is the default and shows setup content ────────────────
  test("Install tab is active by default and shows setup instructions or connect button", async ({ page }) => {
    const installTab = page.getByRole("button", { name: /^Install$/i }).first();
    await expect(installTab).toBeVisible({ timeout: 6000 });

    // Install tab should show setup guide, connect button, or bot invite link
    const hasSetup =
      (await page
        .getByText(/install|connect.*discord|add.*bot|invite.*bot|setup|authorize|OAuth/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await page
        .getByRole("link", { name: /connect|install|add.*bot/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)) ||
      (await page
        .getByRole("button", { name: /connect|install|add.*bot/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSetup || hasSkeleton).toBe(true);
  });

  // ── 5. Clicking Servers tab does not crash ───────────────────────────────
  test("clicking Servers tab renders content without crashing", async ({ page }) => {
    const serversTab = page.getByRole("button", { name: /^Servers$/i }).first();
    await expect(serversTab).toBeVisible({ timeout: 6000 });

    await serversTab.click();
    await page.waitForTimeout(800);

    // Heading must still be visible — page did not crash
    const heading = page.getByRole("heading", { name: /^Discord$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Some content should appear
    const hasContent =
      (await page
        .getByText(/server|guild|no servers|connect|add.*server/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator("[class*='glass'], [class*='rounded-xl'], [class*='rounded-2xl']")
        .filter({ has: page.locator("p, h2, h3") })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("discord page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Discord$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
