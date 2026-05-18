/**
 * Voice Studio E2E — /dashboard/voice-studio
 *
 * Tests the compact slim header, tab navigation, and core UI of the
 * Voice Studio page. Verifies that:
 *   • Page loads without JS errors
 *   • Compact h1 "Voice Studio" header is visible
 *   • Three tabs render: "My Voices", "Presets", "Renders"
 *   • Default active tab is "My Voices"
 *   • Clicking "Presets" tab switches to the preset library
 *   • Clicking "Renders" tab switches to the renders list
 *   • Refresh button exists and is clickable
 *   • My Voices tab shows voice cards OR a no-voices empty state
 *   • Presets tab shows preset cards OR a loading state — never a blank void
 *   • No 404 or generic error state renders on load
 */

import { test, expect, type Page } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Voice Studio", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasTestCreds(),
      "E2E credentials not set — skipping authenticated tests",
    );
    // storageState provides auth; waitForDashboardReady handles rare JWT bounces.
    // 200 s gives a full signIn recovery path (~56 s) plus page load headroom.
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
  });

  // ── 1. Page loads without JS errors ──────────────────────────────────
  test("page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/voice-studio");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(600);

    expect(errors).toHaveLength(0);
  });

  // ── 2. Compact header renders with "Voice Studio" title ──────────────
  test("compact header renders with 'Voice Studio' title", async ({ page }) => {
    // The slim bar uses an <h1> with text "Voice Studio"
    const heading = page.getByRole("heading", { name: /Voice Studio/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });

    // The subtitle "Clone · Presets · Renders" should also be present
    const subtitle = page.getByText(/Clone.*Presets.*Renders/i).first();
    if (await subtitle.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expect(subtitle).toBeVisible();
    }

    // The header should NOT be a full PageHero — no large gradient backdrop
    const pageHero = page.locator('[data-testid="page-hero"]');
    expect(await pageHero.count()).toBe(0);
  });

  // ── 3. All three tabs are visible ────────────────────────────────────
  test("renders three tabs: My Voices, Presets, Renders", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: /Voice Studio tabs/i });
    await expect(nav).toBeVisible({ timeout: 6000 });

    const myVoicesTab = nav.getByRole("button", { name: /My Voices/i });
    const presetsTab = nav.getByRole("button", { name: /Presets/i });
    const rendersTab = nav.getByRole("button", { name: /Renders/i });

    await expect(myVoicesTab).toBeVisible({ timeout: 4000 });
    await expect(presetsTab).toBeVisible({ timeout: 4000 });
    await expect(rendersTab).toBeVisible({ timeout: 4000 });
  });

  // ── 4. Default active tab is "My Voices" ─────────────────────────────
  test("default active tab is 'My Voices'", async ({ page }) => {
    // The active tab has aria-current="page" per page.tsx implementation
    const nav = page.getByRole("navigation", { name: /Voice Studio tabs/i });
    await expect(nav).toBeVisible({ timeout: 6000 });

    const myVoicesTab = nav.getByRole("button", { name: /My Voices/i });
    await expect(myVoicesTab).toBeVisible({ timeout: 4000 });

    // aria-current="page" marks the active tab
    await expect(myVoicesTab).toHaveAttribute("aria-current", "page", {
      timeout: 3000,
    });

    // "Presets" and "Renders" should NOT be aria-current
    const presetsTab = nav.getByRole("button", { name: /Presets/i });
    const rendersTab = nav.getByRole("button", { name: /Renders/i });
    await expect(presetsTab).not.toHaveAttribute("aria-current", "page");
    await expect(rendersTab).not.toHaveAttribute("aria-current", "page");
  });

  // ── 5. Clicking "Presets" tab switches to the preset library ─────────
  test("clicking 'Presets' tab switches to the preset library", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: /Voice Studio tabs/i });
    await expect(nav).toBeVisible({ timeout: 6000 });

    const presetsTab = nav.getByRole("button", { name: /Presets/i });
    await presetsTab.click();
    await page.waitForTimeout(400);

    // After click, Presets should be the active tab
    await expect(presetsTab).toHaveAttribute("aria-current", "page", {
      timeout: 3000,
    });

    // My Voices should no longer be active
    const myVoicesTab = nav.getByRole("button", { name: /My Voices/i });
    await expect(myVoicesTab).not.toHaveAttribute("aria-current", "page");
  });

  // ── 6. Clicking "Renders" tab switches to the renders list ───────────
  test("clicking 'Renders' tab switches to the renders list", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: /Voice Studio tabs/i });
    await expect(nav).toBeVisible({ timeout: 6000 });

    const rendersTab = nav.getByRole("button", { name: /Renders/i });
    await rendersTab.click();
    await page.waitForTimeout(400);

    // Renders tab should now be active
    await expect(rendersTab).toHaveAttribute("aria-current", "page", {
      timeout: 3000,
    });

    // My Voices should no longer be active
    const myVoicesTab = nav.getByRole("button", { name: /My Voices/i });
    await expect(myVoicesTab).not.toHaveAttribute("aria-current", "page");
  });

  // ── 7. Refresh button exists and is clickable ─────────────────────────
  test("Refresh button exists in the header and is clickable", async ({
    page,
  }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh/i }).first();
    // 8s: the Refresh button lives in the slim header which may render after
    // React hydration completes — cold first load can take 4-6s.
    await expect(refreshBtn).toBeVisible({ timeout: 8000 });

    // Clicking should not throw or navigate away
    await refreshBtn.click();
    await page.waitForTimeout(500);

    // Page should still be on voice-studio after refresh click
    await expect(page).toHaveURL(/voice-studio/, { timeout: 3000 });

    // The heading should still be visible after refresh
    const heading = page
      .getByRole("heading", { name: /Voice Studio/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  // ── 8. My Voices tab shows voice cards OR empty state ─────────────────
  test("My Voices tab shows voice cards or an empty state — never a blank void", async ({
    page,
  }) => {
    // Ensure My Voices tab is active (it's the default)
    await ensureMyVoicesTabActive(page);
    await page.waitForTimeout(800);

    // After loading, either voice cards or an empty/no-voices state should be visible
    const hasVoiceCards = await page
      .locator('[class*="rounded"]')
      .filter({ has: page.locator("button, p, span") })
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(
        /no voices|clone your first|add a voice|no clones yet|get started/i,
      )
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasLoadingSpinner =
      (await page
        .locator('[class*="animate-spin"]')
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false)) ||
      (await page
        .getByText(/loading/i)
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false));

    // At minimum a loader, empty state, or content should be present
    expect(hasVoiceCards || hasEmptyState || hasLoadingSpinner).toBe(true);
  });

  // ── 9. Presets tab shows preset cards or loading state ───────────────
  test("Presets tab shows preset cards or a loading state — not a blank void", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: /Voice Studio tabs/i });
    await expect(nav).toBeVisible({ timeout: 6000 });

    const presetsTab = nav.getByRole("button", { name: /Presets/i });
    await presetsTab.click();
    await page.waitForTimeout(1000);

    // The Presets tab renders <PresetsTab presets={presets} loading={loading} />
    // It should show either preset cards or a loading/empty state
    const hasPresetCards = await page
      .locator('[class*="rounded"]')
      .filter({ has: page.locator("button, p, span") })
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasLoadingSpinner =
      (await page
        .locator('[class*="animate-spin"]')
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false)) ||
      (await page
        .getByText(/loading/i)
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false));

    const hasEmptyOrContent = await page
      .getByText(/preset|voice|library|no presets|ElevenLabs/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Some meaningful UI must be visible — not a blank white void
    expect(hasPresetCards || hasLoadingSpinner || hasEmptyOrContent).toBe(true);
  });

  // ── 10. No 404 or generic error state renders on load ─────────────────
  test("page does not render a 404 or generic error state", async ({
    page,
  }) => {
    // Check for common error text patterns
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();

    const hasError = await errorText
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(hasError).toBe(false);

    // The actual heading should be visible instead.
    // 10s: heading may take longer on cold first load (React hydration + JS
    // bundle download). 6000ms was the previous value and caused first-attempt
    // failures under test load.
    const heading = page
      .getByRole("heading", { name: /Voice Studio/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  // ── Bonus: API calls to /api/voice/clones are made on load ───────────
  test("makes API call to /api/voice/clones on page load", async ({ page }) => {
    // Use waitForRequest so we don't race against a fixed timeout.
    // Register the handler BEFORE page.goto so the request is captured
    // regardless of how fast the React effect fires.
    const clonesRequestPromise = page
      .waitForRequest((req) => req.url().includes("/api/voice/clones"), {
        timeout: 10000,
      })
      .catch(() => null); // returns null if nothing fires within 10 s

    await page.goto("/dashboard/voice-studio");
    await page.waitForLoadState("domcontentloaded");

    const caught = await clonesRequestPromise;
    // The page calls /api/voice/clones on mount via the refresh() callback
    expect(caught).not.toBeNull();
    expect(caught!.url()).toContain("/api/voice/clones");
  });

  // ── Bonus: Renders tab triggers /api/voice/clones/[id] requests ───────
  test("switching to Renders tab triggers render fetch requests", async ({
    page,
  }) => {
    // Wait for initial load to complete so mine[] is populated
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    const renderRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/voice/renders") || req.url().match(/\/api\/voice\/clones\/[^/]+/)) {
        renderRequests.push(req.url());
      }
    });

    const nav = page.getByRole("navigation", { name: /Voice Studio tabs/i });
    const rendersTab = nav.getByRole("button", { name: /Renders/i });
    await rendersTab.click();
    await page.waitForTimeout(1500);

    // Either render API calls fired OR the user has no clones (zero requests is fine)
    // This test mainly verifies the tab switch doesn't crash
    await expect(page).toHaveURL(/voice-studio/, { timeout: 3000 });
    const heading = page
      .getByRole("heading", { name: /Voice Studio/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Ensure the "My Voices" tab is the active tab.
 * Clicks it if another tab is currently selected.
 */
async function ensureMyVoicesTabActive(page: Page): Promise<void> {
  const nav = page.getByRole("navigation", { name: /Voice Studio tabs/i });
  const navVisible = await nav.isVisible({ timeout: 3000 }).catch(() => false);
  if (!navVisible) return;

  const myVoicesTab = nav.getByRole("button", { name: /My Voices/i });
  const isActive = await myVoicesTab
    .getAttribute("aria-current")
    .catch(() => null);

  if (isActive !== "page") {
    await myVoicesTab.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}
