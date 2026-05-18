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

    // Short-circuit: if the server already redirected to /dashboard
    // (storageState JWT is still valid and the app redirects authenticated
    // users away from /login), we're already signed in — no form to fill.
    if (page.url().includes("/dashboard")) return;

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
 * Sign out by navigating to the server-side sign-out route.
 * The /api/auth/signout GET route clears all Supabase auth cookies and
 * redirects to /login — no UI button required.
 * Waits until the browser lands on /login.
 */
export async function signOut(page: Page): Promise<void> {
  // Navigate to the server-side sign-out endpoint — clears cookies + redirects.
  // This is more reliable than hunting for a UI button whose placement changes
  // across sidebar iterations.
  await page.goto("/api/auth/signout");

  // The route redirects to /login. Wait for the redirect to complete.
  await page.waitForURL(/\/(login)/, { timeout: 15_000 }).catch(async () => {
    // Fallback: if the redirect stalled, navigate directly.
    await page.goto("/login");
    await page.waitForURL(/\/login/, { timeout: 5_000 }).catch(() => {});
  });
}

/** Assert the user is on a dashboard page. */
export async function expectDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

/**
 * Wait for the dashboard to be fully ready after a page.goto().
 *
 * Waits for the main navigation (sidebar) to be visible, which confirms
 * DashboardLayout has resolved Supabase auth and the sidebar has mounted.
 *
 * If the page ends up on /login during the wait (Supabase SSR bounced the
 * session), re-authenticate inline and retry.
 *
 * Call this AFTER page.goto('/dashboard/...') or signIn() in tests.
 */
export async function waitForDashboardReady(
  page: Page,
  timeout = 20_000,
): Promise<void> {
  // The trinity sidebar renders a <nav> once hydrated. Waiting for it
  // confirms the sidebar + layout are fully mounted.
  //
  // Default is 20 s. Most tests see the nav in 1-3 s on a warm Vercel
  // function, so the extra headroom costs nothing in the happy path.
  // The budget matters for two edge cases:
  //   1. Spec uses waitUntil:"domcontentloaded" (returns before React mounts)
  //      — the nav can take 5-10 s to appear when the function is cold.
  //   2. Late tests in a long suite hit the function after 20+ prior requests
  //      — occasional scheduling jitter pushes hydration past the old 5 s cap.
  // /login detection is still instant: any URL that doesn't include /login
  // after <timeout> ms triggers the immediate throw below, so we don't burn
  // the full 20 s on a genuine session-expired redirect.
  const nav = page.getByRole("navigation").first();

  try {
    await nav.waitFor({ state: "visible", timeout });
  } catch {
    // If the session was lost and we're on /login, re-authenticate inline.
    if (page.url().includes("/login")) {
      await signIn(page);
      // After signIn() redirects to /dashboard, give the nav 15 s to hydrate.
      // The dashboard needs to fetch Supabase session + mount DashboardLayout,
      // so be generous here while keeping the initial detection fast above.
      await nav.waitFor({ state: "visible", timeout: 15_000 });
    } else {
      throw new Error(
        `waitForDashboardReady timed out after ${timeout}ms ` +
        `(URL: ${page.url()}). Navigation never appeared.`,
      );
    }
  }
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
    // noWaitAfter prevents Playwright from waiting the full test-level 200 s for
    // any pending Next.js router refresh triggered by the dismiss click (e.g. the
    // token-usage badge "Dismiss for this session" button calls router.refresh()).
    // 3 s is generous for a pure DOM dismiss; the catch swallows errors cleanly.
    await dismissBtn.click({ timeout: 3_000, noWaitAfter: true }).catch(() => {});
    // Wrap in catch: if the test timeout fires and Playwright closes the page
    // mid-wait, the "Target page closed" error is swallowed cleanly.
    await page.waitForTimeout(200).catch(() => {});
  }
}
