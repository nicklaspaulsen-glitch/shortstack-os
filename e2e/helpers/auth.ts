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
  // `signIn` waits only for the URL to change to /dashboard — React may still
  // be hydrating. Wait for 'load' (all scripts fetched + executed) so the
  // sidebar's onClick handler is actually attached before we click.
  // Soft-fail: if the page never fully settles (Supabase realtime keep-alive),
  // proceed anyway rather than timing out here.
  await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});

  const btn = page.locator('button[aria-label="Sign Out"]');
  await btn.waitFor({ state: "visible", timeout: 10_000 });

  // Start listening BEFORE clicking to avoid racing the window.location.href
  // redirect that fires after supabase.auth.signOut() resolves.
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/dashboard"), {
      timeout: 30_000,
    }),
    btn.click(),
  ]);
}

/** Assert the user is on a dashboard page. */
export async function expectDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}
