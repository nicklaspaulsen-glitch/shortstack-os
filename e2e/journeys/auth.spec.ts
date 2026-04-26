import { test, expect } from "@playwright/test";
import { hasTestCreds, signIn, signOut, expectDashboard } from "../helpers/auth";

test.describe("auth journey", () => {
  test.beforeEach(() => {
    if (!hasTestCreds()) {
      test.skip(
        true,
        "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping auth tests",
      );
    }
  });

  test("sign in lands on dashboard", async ({ page }) => {
    await signIn(page);
    await expectDashboard(page);

    // At least one landmark that only authenticated users see
    await expect(
      page.getByRole("navigation").or(page.getByText(/dashboard/i).first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("sign out redirects to login", async ({ page }) => {
    await signIn(page);
    await expectDashboard(page);
    await signOut(page);

    // After sign-out the app must not be on a dashboard route
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5_000 });
  });
});
