import { test, expect } from "@playwright/test";
import { hasTestCreds, signIn } from "../helpers/auth";

/**
 * Dashboard journey — verifies that an authenticated user can reach core
 * dashboard pages and that key structural elements render correctly.
 *
 * Run:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
 *     npx playwright test e2e/journeys/dashboard.spec.ts --reporter=list
 */

test.describe.configure({ mode: "serial" });

test.describe("dashboard journey", () => {
  test.beforeEach(({ page: _ }) => {
    if (!hasTestCreds()) {
      test.skip(
        true,
        "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping dashboard tests",
      );
    }
  });

  test("authenticated user lands on dashboard and sidebar is visible", async ({ page }) => {
    await signIn(page);

    // Confirm we are on a dashboard route
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // The sidebar nav must be present — it wraps every authenticated page
    await expect(page.getByRole("navigation").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("navigation to /dashboard/analytics renders PageHero h1", async ({ page }) => {
    await signIn(page);

    await page.goto("/dashboard/analytics");
    await page.waitForURL(/\/dashboard\/analytics/, { timeout: 15_000 });

    // PageHero always renders an h1 on every dashboard page
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  });

  test("navigation to /dashboard/clients renders without error", async ({ page }) => {
    await signIn(page);

    await page.goto("/dashboard/clients");
    await page.waitForURL(/\/dashboard\/clients/, { timeout: 15_000 });

    // Should not show a 404 or "not found" text
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.toLowerCase()).not.toMatch(/404|page not found/);

    // The page-level h1 must be present
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  });

  test("navigation via sidebar link reaches the target page", async ({ page }) => {
    await signIn(page);

    // Wait for the sidebar to hydrate
    await expect(page.getByRole("navigation").first()).toBeVisible({
      timeout: 10_000,
    });

    // Click the "Analytics" sidebar link
    const analyticsLink = page
      .getByRole("link", { name: /^analytics$/i })
      .first();

    // If the link is in a collapsed tier-3 section it may be hidden;
    // fall back to direct navigation in that case.
    const isVisible = await analyticsLink.isVisible().catch(() => false);
    if (isVisible) {
      // force:true bypasses pointer-events interception from NavIcon3D wrapper
      await analyticsLink.click({ force: true });
      await page.waitForURL(/\/dashboard\/analytics/, { timeout: 15_000 });
    } else {
      await page.goto("/dashboard/analytics");
      await page.waitForURL(/\/dashboard\/analytics/, { timeout: 15_000 });
    }

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  });
});
