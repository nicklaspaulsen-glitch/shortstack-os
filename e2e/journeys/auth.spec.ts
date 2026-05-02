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

  test("sign in with invalid credentials shows an error", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("you@company.com").fill("invalid@example.com");
    await page.getByPlaceholder("Enter password").fill("wrongpassword123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Supabase surfaces the error as a toast — Sonner / react-hot-toast
    // renders it in a visually-promoted element. We match on common
    // error substrings that Supabase returns for bad creds.
    const errorToast = page
      .getByText(/invalid login credentials|invalid email or password|email not confirmed/i)
      .first();

    await expect(errorToast).toBeVisible({ timeout: 10_000 });

    // Must remain on /login — never redirect to dashboard
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5_000 });
  });

  test("sign out redirects to login", async ({ page }) => {
    await signIn(page);
    await expectDashboard(page);
    await signOut(page);

    // After sign-out the app must not be on a dashboard route
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5_000 });
  });
});
