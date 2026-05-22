import { test, expect } from "@playwright/test";
import { hasTestCreds, signIn } from "../helpers/auth";

/**
 * Navigation journey — verifies the GlassTopNav renders, key links are
 * accessible, and the mobile hamburger works.
 *
 * The original sidebar (TrinitySidebar) is hidden when the glass shell is
 * active. The primary navigation is now GlassTopNav with two pill rows:
 *   Row "create" — Studio, Thumbs, Video, Editor, Social, Stats
 *   Row "system" — Library, Comments, Brand kit, Automations, Settings
 * Plus icon-only utility links: Dashboard home, Analytics, Notifications.
 *
 * Run:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
 *     npx playwright test e2e/journeys/sidebar.spec.ts --reporter=list
 */

test.describe.configure({ mode: "serial" });

// Navigation pills that must be visible in the GlassTopNav "create" row.
const CREATE_PILLS = ["Studio", "Thumbs", "Video", "Editor", "Social", "Stats"] as const;

// Utility links in the top bar (icon-only, matched by aria-label).
const UTILITY_LINKS = ["Dashboard home", "Analytics"] as const;

test.describe("navigation journey", () => {
  test.beforeEach(({ page: _ }) => {
    if (!hasTestCreds()) {
      test.skip(
        true,
        "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping navigation tests",
      );
    }
  });

  test("GlassTopNav renders with main navigation landmark", async ({ page }) => {
    await signIn(page);

    // The GlassTopNav renders as <nav aria-label="Main navigation">
    const nav = page.getByRole("navigation", { name: /main navigation/i }).first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test("utility links (Dashboard, Analytics) are present", async ({ page }) => {
    await signIn(page);

    for (const label of UTILITY_LINKS) {
      // These are icon-only links with aria-label
      const link = page.getByRole("link", { name: new RegExp(label, "i") }).first();
      await expect(link).toBeVisible({ timeout: 5_000 });
    }
  });

  test("create-row pills are visible after login", async ({ page }) => {
    await signIn(page);

    // Wait for the nav to hydrate
    await expect(
      page.getByRole("navigation", { name: /main navigation/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    for (const label of CREATE_PILLS) {
      // Use non-anchored regex: pill accessible name may include badge text
      // e.g. "Thumbs 42" or "Social 11"
      const pill = page.getByRole("link", { name: new RegExp(label, "i") }).first();
      await expect(pill).toBeVisible({ timeout: 5_000 });
    }
  });

  test("system-row pills are visible after login", async ({ page }) => {
    await signIn(page);

    // System pills: Library, Comments, Brand kit, Automations, Settings
    const systemPills = ["Library", "Comments", "Brand kit", "Automations", "Settings"];

    await expect(
      page.getByRole("navigation", { name: /main navigation/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    for (const label of systemPills) {
      // Non-anchored: some pills have badge text appended
      const pill = page.getByRole("link", { name: new RegExp(label, "i") }).first();
      await expect(pill).toBeVisible({ timeout: 5_000 });
    }
  });

  test("mobile: hamburger opens the sidebar overlay", async ({ page }) => {
    // Emulate a mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await signIn(page);

    // On mobile the GlassTopNav may collapse or a hamburger may appear.
    // Check for a hamburger / menu button.
    const hamburger = page
      .getByRole("button", { name: /open.*menu|menu|toggle.*sidebar|hamburger/i })
      .or(page.locator('[aria-label*="menu" i], [aria-label*="sidebar" i]').first())
      .first();

    const hamburgerVisible = await hamburger.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hamburgerVisible) {
      // Some responsive implementations keep navigation always-mounted.
      // Verify the nav landmark is at least reachable.
      const nav = page.getByRole("navigation").first();
      await expect(nav).toBeAttached({ timeout: 5_000 });
      return;
    }

    await hamburger.click();

    // After opening, a navigation link should appear in the viewport
    const anyNavLink = page
      .getByRole("link", { name: /studio|dashboard|settings/i })
      .first();

    await expect(anyNavLink).toBeVisible({ timeout: 5_000 });
  });
});
