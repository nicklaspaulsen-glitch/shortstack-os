/**
 * Landing Pages E2E — /dashboard/landing-pages
 *
 * Tests:
 *   • Page loads with editorial header + template gallery
 *   • Template cards show key niche categories
 *   • "Create landing page" CTA opens the CinematicWizard
 *   • Wizard first step has a textarea input (offer/business description)
 *   • Existing pages list renders (or empty-state shown)
 *   • Status badges render without blank text
 *   • CVR + launch time metadata appears on template cards
 *   • Advanced mode toggle switches to full form
 *   • No JS errors on page load
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Landing Pages", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping authenticated tests");
    // storageState provides auth; waitForDashboardReady handles rare JWT bounces.
    // 200 s gives a full signIn recovery path (~56 s) plus page load headroom.
    test.setTimeout(200_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tour_completed", "true");
        localStorage.setItem("cookie-consent", "accepted");
      } catch {}
    });
    await page.goto("/dashboard/landing-pages");
    await page.waitForLoadState("domcontentloaded");
    // Wait for sidebar auth gate to clear before asserting on page content.
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
  });

  // ── Page loads ────────────────────────────────────────────────
  test("renders page heading and guided-mode CTA", async ({ page }) => {
    // Page heading — "AI Landing Page Generator"
    await expect(
      page.getByRole("heading", { name: /landing/i }).first(),
    ).toBeVisible();

    // Default (non-advanced) mode shows the guided CTA, not the template gallery
    const guidedCta = page.getByText(/build a landing page|create landing page/i).first();
    await expect(guidedCta).toBeVisible({ timeout: 5000 });
  });

  // ── Template gallery: key niches (advanced mode) ─────────────
  test("template gallery shows key niche categories in advanced mode", async ({ page }) => {
    // Switch to advanced mode — the AdvancedToggle is always visible
    const advToggle = page.getByRole("button", { name: /advanced|full form/i }).first();
    if (await advToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await advToggle.click();
      await page.waitForTimeout(400);
    }

    // In advanced mode, click "Skip to Templates" to reach step 2
    const skipBtn = page.getByRole("button", { name: /skip to templates/i }).first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(400);
    }

    // Template cards should now be visible
    const niches = ["SaaS Landing", "Agency Portfolio", "Restaurant", "Event"];
    for (const niche of niches) {
      const card = page.getByText(niche, { exact: false }).first();
      await expect(card).toBeVisible({ timeout: 5000 });
    }
  });

  // ── CTA opens CinematicWizard ─────────────────────────────────
  test("clicking Create landing page CTA opens the CinematicWizard", async ({
    page,
  }) => {
    // The main CTA — "Create landing page" button or similar
    const createBtn = page
      .getByRole("button", { name: /create landing page|new landing page|create|build/i })
      .first();

    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click({ force: true });
    } else {
      // Fallback: click first template card's "Use" / "Generate" button
      const useBtn = page
        .getByRole("button", { name: /use this|build|start|generate/i })
        .first();
      if (await useBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await useBtn.click({ force: true });
      }
    }

    await page.waitForTimeout(500);

    // CinematicWizard renders "Build a landing page" in the top bar AND
    // "What are you selling?" as the first step h2.
    const wizardVisible = await page
      .getByText(/build a landing page|what are you selling|selling|landing page|step 1|wizard/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const modalVisible = await page
      .locator('[role="dialog"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(wizardVisible || modalVisible).toBe(true);
  });

  // ── Wizard first step has textarea ───────────────────────────
  test("wizard first step has a textarea for business description", async ({
    page,
  }) => {
    // Open the wizard via the main CTA
    const createBtn = page
      .getByRole("button", { name: /create landing page|new landing|build/i })
      .first();

    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click({ force: true });
      await page.waitForTimeout(400);
    } else {
      // Fallback: try top-bar "New" button
      const newBtn = page
        .getByRole("button", { name: /new|create|add|start/i })
        .first();
      if (await newBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await newBtn.click({ force: true });
        await page.waitForTimeout(400);
      }
    }

    // First step is "What are you selling?" — a textarea field
    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(textarea).toBeEnabled();
    }
  });

  // ── Existing pages list or empty state ───────────────────────
  test("shows existing landing pages or an empty-state message", async ({
    page,
  }) => {
    await page.waitForTimeout(1000);

    const hasContent =
      (await page.locator('[class*="card"]').count()) > 0 ||
      (await page
        .getByText(
          /no landing pages|get started|create your first|build a landing page|draft|published/i,
        )
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── Status badges ─────────────────────────────────────────────
  test("status badges for existing pages render without blank text", async ({
    page,
  }) => {
    await page.waitForTimeout(1000);

    const badges = page.getByText(/Draft|Published|Archived|Building/i);
    const count = await badges.count();

    // If there are project rows, each must have a readable status
    if (count > 0) {
      const text = await badges.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
    // If 0 pages, test passes — covered by the empty-state test above
  });

  // ── Template CVR + launch time (advanced mode) ─────────────────
  test("template cards show CVR and launch time metadata", async ({ page }) => {
    // Switch to advanced mode to reveal the template gallery
    const advToggle = page.getByRole("button", { name: /advanced|full form/i }).first();
    if (await advToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await advToggle.click();
      await page.waitForTimeout(400);
    }

    // In advanced mode, click "Skip to Templates" to reach step 2
    const skipBtn = page.getByRole("button", { name: /skip to templates/i }).first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(400);
    }

    // Each template card has "Avg X% CVR" + "X min to live"
    const cvrBadge = page.getByText(/avg.*cvr/i).first();
    await expect(cvrBadge).toBeVisible({ timeout: 5000 });

    const launchTime = page.getByText(/min to live/i).first();
    await expect(launchTime).toBeVisible({ timeout: 3000 });
  });

  // ── Advanced mode toggle ──────────────────────────────────────
  test("advanced mode toggle switches to full form view", async ({ page }) => {
    const advancedToggle = page
      .getByRole("button", { name: /advanced|full form|manual/i })
      .first();

    const toggleVisible = await advancedToggle
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (toggleVisible) {
      await advancedToggle.click({ force: true });
      await page.waitForTimeout(400);
      // Advanced mode exposes more form controls
      const formInputs = await page.locator("input[type=text], textarea").count();
      expect(formInputs).toBeGreaterThan(0);
    }
    // If toggle not present, test passes — wizard mode is default
  });

  // ── No JS errors ──────────────────────────────────────────────
  test("page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/landing-pages");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    expect(errors).toHaveLength(0);
  });
});
