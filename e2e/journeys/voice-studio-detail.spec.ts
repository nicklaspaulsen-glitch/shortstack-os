/**
 * Voice Studio Detail E2E — /dashboard/voice-studio/[id]
 *
 * Tests the individual voice clone detail page reached by clicking a
 * clone label in the My Voices list. Verifies that:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Voice Settings" + h1 (clone label)
 *   • Back link navigates to /dashboard/voice-studio
 *   • Status chip is visible (training | ready | failed)
 *   • Test playback textarea is present and accepts input
 *   • No 404 or generic error state renders
 *
 * NOTE: most tests here depend on at least one user-owned voice clone
 * existing in the test account. If the account has no clones, tests that
 * require navigation to a detail page are conditionally skipped with a
 * clear message — they are never hard-failed.
 */

import { test, expect, type Page } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Voice Studio — clone detail page", () => {
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
    await page.goto("/dashboard/voice-studio");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Give the My Voices data fetch time to resolve before asserting clone links.
    await page.waitForTimeout(2000);
  });

  // ── Helper: find the first clone detail link and return its href ────────
  async function findFirstCloneHref(page: Page): Promise<string | null> {
    // CloneRow renders a Next.js <Link href="/dashboard/voice-studio/[id]">
    // which resolves to an <a> with the same href.
    const link = page
      .locator('a[href*="/dashboard/voice-studio/"]')
      .first();
    const visible = await link.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) return null;
    return link.getAttribute("href");
  }

  // ── 1. Clone label link is present on the My Voices list ────────────────
  test("My Voices list shows clickable links to clone detail pages", async ({ page }) => {
    // If the account has no clones, the empty state renders instead.
    // Test is informative only — we do not create clones via E2E to avoid side
    // effects on production data.
    const anyLink = page.locator('a[href*="/dashboard/voice-studio/"]').first();
    const hasAny = await anyLink.isVisible({ timeout: 6000 }).catch(() => false);

    const emptyState = page
      .getByText(/no clones yet|clone your first|add a voice|no voices/i)
      .first();
    const hasEmpty = await emptyState.isVisible({ timeout: 4000 }).catch(() => false);

    // Loading skeleton is also a valid state (page still fetching clones).
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Either a clone link, empty state, or loading skeleton — not a blank void.
    expect(hasAny || hasEmpty || hasSkeleton).toBe(true);
  });

  // ── 2. Navigating to a clone detail page loads without errors ────────────
  test("clone detail page loads without JS errors", async ({ page }) => {
    const href = await findFirstCloneHref(page);
    if (!href) {
      test.skip(true, "No voice clones in test account — skipping detail page test");
      return;
    }

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });

  // ── 3. Editorial header: eyebrow + h1 ────────────────────────────────────
  test("detail page renders editorial header with Voice Settings eyebrow", async ({ page }) => {
    const href = await findFirstCloneHref(page);
    if (!href) {
      test.skip(true, "No voice clones in test account — skipping detail page test");
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);

    // Eyebrow: italic/small text above the h1 reads "Voice Settings"
    const eyebrow = page.getByText(/Voice Settings/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1: the clone label (or fallback "Voice clone")
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // Must NOT be a full PageHero — the slim editorial bar only
    const pageHero = page.locator('[data-testid="page-hero"]');
    expect(await pageHero.count()).toBe(0);
  });

  // ── 4. Back link navigates to the My Voices list ─────────────────────────
  test("Back link navigates to /dashboard/voice-studio", async ({ page }) => {
    const href = await findFirstCloneHref(page);
    if (!href) {
      test.skip(true, "No voice clones in test account — skipping detail page test");
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);

    // The back arrow link points to /dashboard/voice-studio
    const backLink = page.locator('a[href="/dashboard/voice-studio"]').first();
    await expect(backLink).toBeVisible({ timeout: 8000 });

    await backLink.click();
    await page.waitForURL(/\/dashboard\/voice-studio$/, { timeout: 10_000 });

    // After back navigation the Voice Studio heading must be visible
    const vsHeading = page.getByRole("heading", { name: /Voice Studio/i }).first();
    await expect(vsHeading).toBeVisible({ timeout: 8000 });
  });

  // ── 5. Status chip is visible ────────────────────────────────────────────
  test("detail page shows a status chip (training | ready | failed)", async ({ page }) => {
    const href = await findFirstCloneHref(page);
    if (!href) {
      test.skip(true, "No voice clones in test account — skipping detail page test");
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);

    // A status chip with one of the three known values must be visible.
    const statusChip = page
      .getByText(/training|ready|failed/i)
      .first();
    await expect(statusChip).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Test playback textarea is present and accepts text ────────────────
  test("detail page shows a test-playback textarea that accepts input", async ({ page }) => {
    const href = await findFirstCloneHref(page);
    if (!href) {
      test.skip(true, "No voice clones in test account — skipping detail page test");
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);

    // The test playback section renders a <textarea> for the user to type text
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 8000 });

    // Fill it with a short phrase — must not throw or navigate away
    await textarea.fill("Hello, this is a voice test.");
    await expect(textarea).toHaveValue("Hello, this is a voice test.");

    // The Play / Generate button must be enabled once text is present
    const playBtn = page
      .getByRole("button", { name: /play|generate|test/i })
      .first();
    const isEnabled = await playBtn.isEnabled({ timeout: 3000 }).catch(() => false);
    // Guard: the button may not exist until the clone is "ready".
    // If visible, it must be enabled given non-empty text.
    if (await playBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      expect(isEnabled).toBe(true);
    }
  });

  // ── 7. No 404 or generic error state ────────────────────────────────────
  test("detail page does not render a 404 or generic error state", async ({ page }) => {
    const href = await findFirstCloneHref(page);
    if (!href) {
      test.skip(true, "No voice clones in test account — skipping detail page test");
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);

    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Voice Settings" eyebrow should be visible instead
    const eyebrow = page.getByText(/Voice Settings/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 10_000 });
  });

  // ── 8. URL structure is preserved on reload ──────────────────────────────
  test("direct navigation to a clone detail URL stays on that page", async ({ page }) => {
    const href = await findFirstCloneHref(page);
    if (!href) {
      test.skip(true, "No voice clones in test account — skipping detail page test");
      return;
    }

    // Navigate directly (not via click) — simulates a bookmark or shared link
    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);

    // URL must match the /dashboard/voice-studio/[id] pattern
    await expect(page).toHaveURL(/\/dashboard\/voice-studio\/[^/]+$/, { timeout: 8000 });

    // Editorial header must still be visible — not a redirect to the list
    const eyebrow = page.getByText(/Voice Settings/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });
  });
});
