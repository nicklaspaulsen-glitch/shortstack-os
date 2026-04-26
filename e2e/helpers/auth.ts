import { type Page, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

/** True when test credentials are available in the environment. */
export const hasTestCreds = (): boolean =>
  Boolean(E2E_EMAIL && E2E_PASSWORD);

/**
 * Sign in via the /login page using E2E_TEST_EMAIL + E2E_TEST_PASSWORD.
 * Waits until the browser lands on /dashboard.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");

  // Fill email
  await page.getByPlaceholder("you@company.com").fill(E2E_EMAIL);

  // Fill password
  await page.getByPlaceholder("Enter password").fill(E2E_PASSWORD);

  // Submit
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect into the dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

/**
 * Sign out via the sidebar sign-out button.
 * Waits until the browser lands on /login.
 */
export async function signOut(page: Page): Promise<void> {
  // The sidebar renders a sign-out button at the bottom
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/(login|$)/, { timeout: 10_000 });
}

/** Assert the user is on a dashboard page. */
export async function expectDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}
