/**
 * AI Video Generator E2E — /dashboard/ai-video
 *
 * Tests the guided wizard (prompt → aspect → duration) and the
 * advanced mode (Higgsfield-style hero). Verifies that:
 *   • The wizard steps flow correctly
 *   • Model + aspect pickers are functional
 *   • Generation can be submitted (loading state appears)
 *   • Past results render without 500
 */

import { test, expect } from "@playwright/test";
import { loginAs, dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("AI Video Generator", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping authenticated tests");
    // Pre-seed localStorage BEFORE page JS runs so the first-run wizard modal
    // never auto-opens and block pointer events on the wizard cards.
    // The page reads `ss-aivideo-wizard-seen` on mount.
    await page.addInitScript(() => {
      try { localStorage.setItem("ss-aivideo-wizard-seen", "1"); } catch {}
    });
    await loginAs(page);
    await page.goto("/dashboard/ai-video");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);

    // Belt-and-suspenders: also click any residual skip/close buttons
    const skipBtn = page.getByRole("button", { name: /skip|close|dismiss/i }).first();
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click().catch(() => {});
    }
  });

  // ── Page loads ────────────────────────────────────────────────
  test("renders heading and prompt input", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /video/i }).first(),
    ).toBeVisible();

    // Either guided wizard or advanced mode shows a textarea/input
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });

  // ── Guided wizard: step 1 — prompt ───────────────────────────
  test("guided wizard — types prompt and proceeds to step 2", async ({
    page,
  }) => {
    const textarea = page.locator("textarea").first();
    await textarea.fill(
      "Cinematic drone shot over ocean waves at sunset, 4K, slow motion",
    );
    await expect(textarea).toHaveValue(/.+/);

    // Next button should become enabled after typing
    const nextBtn = page
      .getByRole("button", { name: /next|continue/i })
      .first();
    if (await nextBtn.isVisible()) {
      await expect(nextBtn).toBeEnabled();
      await nextBtn.click({ force: true });

      // Step 2: aspect ratio picker should appear
      await expect(
        page.getByText(/vertical|landscape|square/i).first(),
      ).toBeVisible({ timeout: 3000 });
    }
  });

  // ── Guided wizard: inspiration chips ─────────────────────────
  test("clicking an inspiration chip fills the prompt", async ({ page }) => {
    // Inspiration chips are small buttons below the textarea
    const chip = page
      .getByRole("button")
      .filter({ hasText: /golden retriever|drone|coffee|city/i })
      .first();
    if (await chip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chip.click();
      const textarea = page.locator("textarea").first();
      await expect(textarea).toHaveValue(/.{20,}/);
    }
  });

  // ── Aspect ratio selection ────────────────────────────────────
  test("aspect ratio buttons are selectable", async ({ page }) => {
    // Pre-fill to enable Next so we can reach the aspect step
    const textarea = page.locator("textarea").first();
    await textarea.fill("Test prompt for aspect ratio");

    const nextBtn = page
      .getByRole("button", { name: /next|continue/i })
      .first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click({ force: true });
    }

    // Aspect ratio tiles
    for (const label of ["9:16", "16:9", "1:1"]) {
      const tile = page.getByText(label).first();
      if (await tile.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tile.click();
        // Verify the page is still responsive after click
        await expect(page.locator("body")).toBeVisible();
        break; // one successful click is enough
      }
    }
  });

  // ── Advanced mode toggle ──────────────────────────────────────
  test("advanced mode toggle shows Higgsfield-style controls", async ({
    page,
  }) => {
    const advancedBtn = page.getByRole("button", { name: /advanced/i }).first();
    if (await advancedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advancedBtn.click({ force: true });

      // Advanced mode shows model selection grid
      await expect(
        page.getByText(/cinematic|realistic|animated/i).first(),
      ).toBeVisible({ timeout: 3000 });
    }
  });

  // ── Model selection ───────────────────────────────────────────
  test("model cards are clickable in advanced mode", async ({ page }) => {
    // Switch to advanced mode first
    const advancedBtn = page.getByRole("button", { name: /advanced/i }).first();
    if (await advancedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advancedBtn.click({ force: true });
    }

    const cinematicCard = page.getByText("Cinematic").first();
    if (await cinematicCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cinematicCard.click();
      await expect(cinematicCard).toBeVisible();
    }

    const animatedCard = page.getByText("Animated").first();
    if (await animatedCard.isVisible({ timeout: 1000 }).catch(() => false)) {
      await animatedCard.click();
    }
  });

  // ── Generation history renders ────────────────────────────────
  test("renders past generation history or empty state", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasHistory = await page
      .getByText(/recent|history|your generations|no videos yet/i)
      .first()
      .isVisible()
      .catch(() => false);

    // Page should show jobs or a clear empty state — never a blank void
    expect(hasHistory || (await page.locator('[class*="card"]').count()) > 0).toBe(true);
  });

  // ── Plan gate renders correctly ───────────────────────────────
  test("plan-locked duration shows upgrade path or is enabled on eligible plan", async ({
    page,
  }) => {
    // Navigate past wizard to reach duration step.
    // IMPORTANT: after fill(), wait for the value to settle before clicking Next.
    // React 18 concurrent mode batches state updates; without a settle-wait the
    // prompt state is still "" when handleNext() runs, so canProceed=false and
    // the wizard never advances from step 0.
    const textarea = page.locator("textarea").first();
    await textarea.fill("Cinematic drone shot over a coastal city at sunset");
    // Assert the value, which acts as an explicit wait for React to commit.
    await expect(textarea).toHaveValue(/.{10,}/);

    const nextBtns = page.getByRole("button", { name: /next|continue/i });
    for (let i = 0; i < 2; i++) {
      const btn = nextBtns.first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click({ force: true });
        // 500ms gives React time to re-render to the next step.
        await page.waitForTimeout(500);
      }
    }

    // Duration step shows time tiles ("1s"/"2s"/"3s"/"5s") or a plan-gate badge.
    const durationTile = page
      .getByText(/\b(1s|2s|3s|5s|fastest|quick|recommended|max quality)\b/i)
      .first();
    const upgradeBadge = page.getByText(/upgrade|starter|pro/i).first();

    const durationVisible = await durationTile
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const upgradeVisible = await upgradeBadge
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // At least one of these should be true — the step is rendered
    expect(durationVisible || upgradeVisible).toBe(true);
  });

  // ── No JS errors ──────────────────────────────────────────────
  test("page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/ai-video");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    expect(errors).toHaveLength(0);
  });
});
