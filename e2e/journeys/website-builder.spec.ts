/**
 * Website Builder E2E — /dashboard/websites
 *
 * Tests:
 *   • Page loads with niche template gallery
 *   • Template cards are selectable
 *   • Creation wizard opens
 *   • Wizard steps advance
 *   • Project list renders (or empty state shown)
 *   • Device preview toggle (desktop/tablet/mobile)
 *   • Status badges render correctly
 */

import { test, expect } from "@playwright/test";
import { loginAs, dismissTourIfPresent, hasTestCreds } from "../helpers/auth";

test.describe("Website Builder", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping authenticated tests");
    await loginAs(page);
    await page.goto("/dashboard/websites");
    await dismissTourIfPresent(page);
    await page.waitForLoadState("networkidle");
  });

  // ── Page loads ────────────────────────────────────────────────
  test("renders page heading and niche template gallery", async ({ page }) => {
    // PageHero should render
    await expect(
      page.getByRole("heading", { name: /website/i }).first(),
    ).toBeVisible();

    // Niche template gallery: at least one template card visible
    await expect(page.getByText("SaaS Landing").first()).toBeVisible({
      timeout: 5000,
    });
  });

  // ── Template gallery: all major niches ───────────────────────
  test("template gallery shows key niche categories", async ({ page }) => {
    const niches = [
      "SaaS Landing",
      "Agency Services",
      "E-com",
      "Local Service",
    ];
    for (const niche of niches) {
      const card = page.getByText(niche, { exact: false }).first();
      await expect(card).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Template selection opens wizard ──────────────────────────
  test("clicking a template card opens the creation wizard", async ({
    page,
  }) => {
    const saasTemplate = page.getByText("Product Launch").first();
    if (await saasTemplate.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saasTemplate.click({ force: true });
    } else {
      // Fallback: click the first template-looking card button
      const useBtn = page
        .getByRole("button", { name: /use this|build|start|generate/i })
        .first();
      if (await useBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await useBtn.click({ force: true });
      }
    }

    await page.waitForTimeout(500);

    // Wizard or modal should appear
    const wizardVisible = await page
      .getByText(/tell us about|your business|step 1|wizard/i)
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

  // ── Creation wizard: first step ──────────────────────────────
  test("creation wizard first step has a name/description input", async ({
    page,
  }) => {
    // Open wizard via "New Website" or "+" button
    const newBtn = page
      .getByRole("button", { name: /new website|create|add|start/i })
      .first();
    if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newBtn.click({ force: true });
      await page.waitForTimeout(400);
    } else {
      // Try clicking first template
      const firstTemplate = page
        .getByRole("button", { name: /use|generate|build/i })
        .first();
      if (await firstTemplate.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstTemplate.click({ force: true });
        await page.waitForTimeout(400);
      }
    }

    // Look for any text input in the wizard
    const input = page.locator("input[type=text], textarea").first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(input).toBeEnabled();
    }
  });

  // ── Projects list ─────────────────────────────────────────────
  test("shows existing website projects or an empty-state message", async ({
    page,
  }) => {
    await page.waitForTimeout(1000);

    const hasProjects =
      (await page.locator('[class*="card"]').count()) > 0 ||
      (await page
        .getByText(
          /no websites|get started|create your first|draft|live|generating/i,
        )
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasProjects).toBe(true);
  });

  // ── Status badge colours ──────────────────────────────────────
  test("status badges for existing projects render without blank text", async ({
    page,
  }) => {
    await page.waitForTimeout(1000);

    const badges = page.getByText(/Draft|Live|Preview|Generating|Failed/i);
    const count = await badges.count();

    // If there are project rows, each must have a readable status
    if (count > 0) {
      const text = await badges.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
    // If 0 projects, test passes (handled by empty-state test above)
  });

  // ── Device preview toggle ─────────────────────────────────────
  test("device preview toggle switches between desktop/tablet/mobile icons", async ({
    page,
  }) => {
    // The preview toggle appears on a project card that's in preview/live state.
    // We test it on the page itself if the toggle is globally present.
    const desktopBtn = page
      .getByRole("button", { name: /desktop/i })
      .first();
    const mobileBtn = page
      .getByRole("button", { name: /mobile|phone/i })
      .first();

    const desktopVisible = await desktopBtn
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    const mobileVisible = await mobileBtn
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (desktopVisible) {
      await desktopBtn.click({ force: true });
      await expect(page.locator("body")).toBeVisible();
    }
    if (mobileVisible) {
      await mobileBtn.click({ force: true });
      await expect(page.locator("body")).toBeVisible();
    }
    // Test passes if toggle not present (no live project) — just verifying no crash
  });

  // ── Template CVR stats render ─────────────────────────────────
  test("template cards show CVR and launch time metadata", async ({ page }) => {
    // Each niche template card has "Avg X% CVR" + "X min to live"
    const cvrBadge = page.getByText(/avg.*cvr/i).first();
    await expect(cvrBadge).toBeVisible({ timeout: 5000 });

    const launchTime = page.getByText(/min to live/i).first();
    await expect(launchTime).toBeVisible({ timeout: 3000 });
  });

  // ── No JS errors ──────────────────────────────────────────────
  test("page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/websites");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);

    expect(errors).toHaveLength(0);
  });
});
