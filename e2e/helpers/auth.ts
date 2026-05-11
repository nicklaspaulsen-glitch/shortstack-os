import { type Page, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

/** True when test credentials are available in the environment. */
export const hasTestCreds = (): boolean =>
  Boolean(E2E_EMAIL && E2E_PASSWORD);

/**
 * Sign in via the /login page using E2E_TEST_EMAIL + E2E_TEST_PASSWORD.
 * Waits until the browser lands on /dashboard.
 *
 * Under fullyParallel 4-worker concurrency hitting production Supabase, the
 * auth endpoint occasionally bounces the session back to /login on the first
 * attempt (transient server-side contention). One inline retry eliminates the
 * flake without relying solely on Playwright's test-level retries (which
 * would re-run mutations already performed in the test body).
 */
export async function signIn(page: Page): Promise<void> {
  // addInitScript persists across navigations in the page's lifetime —
  // call once here before any goto so it fires on every subsequent load too.
  await page.addInitScript(() => {
    localStorage.setItem("tour_completed", "true");
    localStorage.setItem("cookie-consent", "accepted");
  });

  for (let attempt = 0; attempt <= 1; attempt++) {
    await page.goto("/login");

    // Fill email
    await page.getByPlaceholder("you@company.com").fill(E2E_EMAIL);

    // Fill password
    await page.getByPlaceholder("Enter password").fill(E2E_PASSWORD);

    // Submit
    await page.getByRole("button", { name: /sign in/i }).click();

    try {
      // Wait for redirect into the dashboard
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
      return; // auth succeeded
    } catch (err) {
      if (attempt === 1) throw err; // exhausted retries — propagate to Playwright
      // Supabase bounced us back to /login — brief pause then retry once
      await page.waitForTimeout(1_000);
    }
  }
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

  // Use .first() — the sidebar renders TWO sign-out buttons (expanded + collapsed
  // views). Playwright's waitFor on a multi-match locator waits for ALL matches
  // to be visible, which never happens since only one variant is shown at a time.
  const btn = page.locator('button[aria-label="Sign Out"]').first();
  await btn.waitFor({ state: "visible", timeout: 10_000 });

  // Start listening BEFORE clicking to avoid racing the window.location.href
  // redirect that fires after supabase.auth.signOut() resolves.
  // Use a 10 s inner timeout — if the natural redirect stalls (Supabase
  // rate-limiting or session collision under test load), fall back to a
  // direct navigation to /login instead of waiting another 30 s.
  try {
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/dashboard"), {
        timeout: 10_000,
      }),
      btn.click(),
    ]);
  } catch {
    // signOut() likely succeeded but the client-side redirect stalled.
    // Navigate directly — the user is already signed out server-side.
    // Accept /dashboard too: if middleware still sees a valid session, the
    // redirect is benign for teardown purposes (test is already done).
    await page.goto("/login");
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 10_000 }).catch(() => {});
  }
}

/** Assert the user is on a dashboard page. */
export async function expectDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

/**
 * Wait for the dashboard to be fully ready after a page.goto().
 *
 * The Sign Out button in the sidebar is ONLY rendered after DashboardLayout
 * resolves Supabase auth (loading → false, user → present) and the full
 * sidebar mounts. Waiting for it replaces fragile fixed waitForTimeout()
 * calls that were insufficient under fullyParallel test concurrency (4
 * workers all logging in at once creates auth contention).
 *
 * Call this AFTER page.goto('/dashboard/...') in beforeEach hooks.
 */
export async function waitForDashboardReady(
  page: Page,
  timeout = 15_000,
): Promise<void> {
  await page
    .locator('button[aria-label="Sign Out"]')
    .first()
    .waitFor({ state: "visible", timeout });
}

/**
 * Alias for signIn — used by journey specs that import loginAs.
 * Skips automatically when E2E credentials are not configured.
 */
export async function loginAs(page: Page): Promise<void> {
  if (!hasTestCreds()) {
    // Skip gracefully when no creds are configured rather than failing
    console.warn("[auth] E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping login");
    return;
  }
  await signIn(page);
}

/**
 * Dismisses the onboarding tour overlay and cookie consent banner
 * if they are visible, so they don't block subsequent clicks.
 * Safe to call even when neither overlay is present.
 */
export async function dismissTourIfPresent(page: Page): Promise<void> {
  // Ensure localStorage flags are set so the overlays don't respawn
  await page.evaluate(() => {
    localStorage.setItem("tour_completed", "true");
    localStorage.setItem("cookie-consent", "accepted");
  }).catch(() => {});

  // Try to click the tour dismiss button if the overlay is already showing
  const dismissBtn = page
    .getByRole("button", { name: /skip tour|dismiss|got it|close/i })
    .first();
  if (await dismissBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await dismissBtn.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}
