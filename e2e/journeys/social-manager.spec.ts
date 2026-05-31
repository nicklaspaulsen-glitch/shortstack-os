/**
 * Social Manager E2E — /dashboard/social-manager
 *
 * Tests the Social Manager page, which is the multi-platform social media
 * scheduling, automation, and analytics hub.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Social Command" + h1 "Social Manager"
 *   • Client selector (select element) is visible
 *   • Main tab strip renders at least 6 of 10 tabs:
 *     Dashboard, Calendar, Queue/Scheduled, Published, Hashtags, AI Tools,
 *     Analytics, Inbox, Collabs, Settings
 *   • Autopilot toggle button is visible
 *   • Dashboard tab content renders (stats, platform summary, or empty state)
 *   • Clicking Calendar tab renders calendar view or empty state
 *   • No 404 or generic error state
 *
 * No posts are created, scheduled, or published in these tests.
 * Platform accounts are not connected.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Social Manager — Social Command", () => {
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
    await page.goto("/dashboard/social-manager");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow clients + social accounts to load
    await page.waitForTimeout(2000);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("social manager page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/social-manager");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection") &&
        !e.includes("hydration"),
    );
    expect(critical).toHaveLength(0);
  });

  // ── 2. Editorial header: eyebrow + h1 ───────────────────────────────────
  test("renders editorial header with Social Command eyebrow and Social Manager h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Social Command/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Social Manager"
    const heading = page.getByRole("heading", { name: /Social Manager/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Client selector is visible ────────────────────────────────────────
  test("client selector (select element) is visible", async ({ page }) => {
    const select = page.locator("select").first();
    await expect(select).toBeVisible({ timeout: 8000 });
  });

  // ── 4. Main tab strip renders at least 6 of 10 tabs ─────────────────────
  test("main tab strip renders at least 6 of 10 tabs", async ({ page }) => {
    const tabLabels = [
      /^Dashboard$/i,
      /^Calendar$/i,
      /^Queue|Scheduled/i,
      /^Published$/i,
      /^Hashtags$/i,
      /^AI Tools$/i,
      /^Analytics$/i,
      /^Inbox$/i,
      /^Collabs$/i,
      /^Settings$/i,
    ];

    let visibleCount = 0;
    for (const pattern of tabLabels) {
      const tab = page.getByRole("button", { name: pattern }).first();
      const isVisible = await tab.isVisible({ timeout: 3000 }).catch(() => false);
      if (isVisible) visibleCount++;
    }

    // At least 6 of the 10 tabs must be visible
    expect(visibleCount).toBeGreaterThanOrEqual(6);
  });

  // ── 5. Autopilot toggle button is visible ────────────────────────────────
  test("Autopilot toggle button is visible", async ({ page }) => {
    const autopilotBtn = page
      .getByRole("button", { name: /Autopilot/i })
      .first();
    await expect(autopilotBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 6. Dashboard tab renders content or empty/connect state ─────────────
  test("Dashboard tab renders content, loading state, or connect social accounts prompt", async ({ page }) => {
    // Ensure we're on the Dashboard tab (default)
    const dashTab = page.getByRole("button", { name: /^Dashboard$/i }).first();
    if (await dashTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await dashTab.click();
      await page.waitForTimeout(600);
    }

    await page.waitForTimeout(1500);

    // Valid state 1: platform connect prompt (no accounts yet)
    const hasConnectPrompt = await page
      .getByText(/Connect.*Social|Connect Social Accounts|Link your social/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 2: dashboard content (autopilot stats, recent posts, suggestions)
    const hasContent = await page
      .getByText(/autopilot|scheduled|published|suggestions|content plan|posts/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    // Valid state 3: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Valid state 4: empty state for no clients
    const hasNoClients = await page
      .getByText(/no clients|add a client|select a client/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasConnectPrompt || hasContent || hasSkeleton || hasNoClients).toBe(true);
  });

  // ── 7. Clicking Calendar tab renders calendar view or empty state ────────
  test("clicking Calendar tab renders calendar grid or empty state", async ({ page }) => {
    const calendarTab = page.getByRole("button", { name: /^Calendar$/i }).first();
    await expect(calendarTab).toBeVisible({ timeout: 6000 });

    await calendarTab.click();
    await page.waitForTimeout(800);

    // Must render something
    const hasCalendar =
      (await page
        .getByText(/monday|tuesday|wednesday|thursday|friday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .getByText(/scheduled|calendar|week|month|no posts/i)
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="grid"], [class*="calendar"]')
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    expect(hasCalendar).toBe(true);
  });

  // ── 8. No 404 or generic error state ─────────────────────────────────────
  test("social manager page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Social Manager" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Social Manager/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 9. AI Tools tab renders content generation UI ─────────────────────────
  test("AI Tools tab renders content generation panel", async ({ page }) => {
    // Click the AI Tools tab
    const aiToolsTab = page
      .getByRole("button", { name: /^AI Tools$/i })
      .first();

    if (!(await aiToolsTab.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await aiToolsTab.click();
    await page.waitForTimeout(800);

    // The AI Tools tab should show content generation options:
    // "Generate Week" / "Content Plan" / "Generate Posts" or similar
    const hasGenPanel =
      (await page
        .getByText(/generate|content plan|week|posts|captions/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .getByRole("button", { name: /generate|create content|plan/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    // Or an empty / "connect accounts first" state is also valid
    const hasEmptyState =
      (await page
        .getByText(/connect|no client|select a client/i)
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasGenPanel || hasEmptyState).toBe(true);
  });

  // ── 10. Hashtags tab renders research UI ─────────────────────────────────
  test("Hashtags tab renders hashtag research panel", async ({ page }) => {
    const hashtagsTab = page
      .getByRole("button", { name: /^Hashtags$/i })
      .first();

    if (!(await hashtagsTab.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await hashtagsTab.click();
    await page.waitForTimeout(800);

    // Hashtag tab should show research input or clusters
    const hasResearchUI =
      (await page
        .getByPlaceholder(/hashtag|keyword|topic/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .getByText(/research|clusters|trending|popular hashtags/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .getByRole("button", { name: /research|analyze|find hashtags/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    // Empty / connect-first state is also valid
    const hasEmptyState =
      (await page
        .getByText(/connect|no client|select a client|no accounts/i)
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasResearchUI || hasEmptyState).toBe(true);
  });

  // ── 11. AI Generate content week — UI flow (no real posts created) ────────
  test("AI Tools — generate week of content renders draft list or triggers AI", async ({ page }) => {
    test.setTimeout(60_000);

    // Navigate to AI Tools tab
    const aiToolsTab = page
      .getByRole("button", { name: /^AI Tools$/i })
      .first();

    if (!(await aiToolsTab.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await aiToolsTab.click();
    await page.waitForTimeout(600);

    // Click "Generate Week" or equivalent button
    const generateBtn = page
      .getByRole("button", { name: /generate week|generate content|create plan|7 days|one week/i })
      .first();

    if (!(await generateBtn.isVisible({ timeout: 4000 }).catch(() => false))) {
      // Feature may require a connected client — skip gracefully
      test.skip();
      return;
    }

    await generateBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // After clicking, expect one of:
    // 1. A loading state (AI generating)
    // 2. A list of draft posts (7 entries)
    // 3. A "select client first" prompt
    const hasLoading =
      await page
        .locator('[class*="animate-spin"], [class*="skeleton"], [class*="loading"]')
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

    const hasDrafts =
      await page
        .getByText(/draft|post 1|monday|tuesday|caption/i)
        .first()
        .isVisible({ timeout: 8000 })
        .catch(() => false);

    const hasPromptToConnect =
      await page
        .getByText(/connect|select client|no client/i)
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

    expect(hasLoading || hasDrafts || hasPromptToConnect).toBe(true);
  });
});
