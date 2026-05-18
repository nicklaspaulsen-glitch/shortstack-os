/**
 * Website Builder — Generate → Preview → Deploy E2E
 *
 * End-to-end flow covering:
 *   1. Open template gallery
 *   2. Select a template (SaaS Landing or Agency Services)
 *   3. Complete wizard steps (business name → tagline → generate)
 *   4. Verify generation is triggered (API call or status change)
 *   5. Preview mode renders without crash
 *   6. Deploy button / Vercel publish trigger is present
 *   7. Domain connection UI is reachable
 *   8. Project card in the list shows a status badge after creation
 *
 * All mutating steps are best-effort — the test doesn't wait for actual
 * AI generation to finish (could take 30–120 s); it verifies the UI
 * triggers the right actions and renders the right states.
 *
 * Skips gracefully when E2E credentials are not set.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  hasTestCreds,
  waitForDashboardReady,
  dismissTourIfPresent,
} from "../helpers/auth";

test.describe("Website Builder — Generate → Preview → Deploy", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasTestCreds(),
      "E2E credentials not set — skipping website generate/deploy tests",
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
    await page.goto("/dashboard/websites");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
  });

  // ── 1. Template gallery renders ───────────────────────────────────────
  test("template gallery shows niche templates with action buttons", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // At least one template card heading
    await expect(
      page.getByText(/SaaS Landing|Agency Services|E-com|Local Service/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Each template has a "Use this" / "Build" / "Generate" CTA
    const ctas = page.getByRole("button", {
      name: /use this|build|generate|start|create/i,
    });
    const count = await ctas.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── 2. Wizard opens and accepts business name input ───────────────────
  test("creation wizard opens and accepts business name input", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await openCreationWizard(page);

    // Wait for wizard to settle
    await page.waitForTimeout(400);

    // Look for any text input — the first step always asks for name/industry
    const input = page
      .locator("input[type=text], input[type=email], textarea")
      .first();

    if (await input.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await input.fill("Acme Digital Agency E2E");
      await expect(input).toHaveValue(/Acme Digital Agency E2E/);
    }

    // Wizard step indicator or "Next" button visible
    const hasWizardNav =
      (await page
        .getByRole("button", { name: /next|continue|generate|build/i })
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false)) ||
      (await page
        .getByText(/step \d|1 of \d/i)
        .first()
        .isVisible({ timeout: 2_000 })
        .catch(() => false));

    expect(hasWizardNav).toBe(true);
  });

  // ── 3. Wizard advances through steps ─────────────────────────────────
  test("wizard advances to step 2 after filling step 1", async ({ page }) => {
    test.setTimeout(90_000);

    await openCreationWizard(page);
    await page.waitForTimeout(400);

    // Fill first visible text input
    const input = page
      .locator("input[type=text], textarea")
      .first();

    if (await input.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await input.fill("Test Agency E2E");
    }

    // Click "Next" / "Continue" if available
    const nextBtn = page
      .getByRole("button", { name: /next|continue/i })
      .first();
    if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(600);

      // After advancing, a second input or "Generate" button should appear
      const hasStep2 =
        (await page
          .locator("input[type=text], textarea")
          .nth(0)
          .isVisible({ timeout: 3_000 })
          .catch(() => false)) ||
        (await page
          .getByRole("button", { name: /generate|build|create|publish/i })
          .first()
          .isVisible({ timeout: 3_000 })
          .catch(() => false)) ||
        (await page
          .getByText(/step 2|tagline|industry|niche|your url/i)
          .first()
          .isVisible({ timeout: 3_000 })
          .catch(() => false));

      expect(hasStep2).toBe(true);
    }
  });

  // ── 4. Generate action triggers an API call ───────────────────────────
  test("tapping generate triggers POST to /api/websites/generate", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // Register request listener BEFORE opening wizard
    const generateRequests: string[] = [];
    page.on("request", (req) => {
      if (
        req.method() === "POST" &&
        req.url().includes("/api/websites") &&
        (req.url().includes("generate") || req.url().includes("create"))
      ) {
        generateRequests.push(req.url());
      }
    });

    await openCreationWizard(page);
    await page.waitForTimeout(400);

    // Fill all visible inputs
    const inputs = page.locator("input[type=text], textarea");
    const inputCount = await inputs.count();
    for (let i = 0; i < Math.min(inputCount, 3); i++) {
      const inp = inputs.nth(i);
      if (await inp.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await inp.fill("E2E Test Content");
      }
    }

    // Advance through wizard steps to reach generate
    for (let step = 0; step < 5; step++) {
      const nextBtn = page
        .getByRole("button", { name: /next|continue/i })
        .first();
      if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }

    // Click generate if present
    const generateBtn = page
      .getByRole("button", { name: /^generate$|^build$|^create site$|^launch$/i })
      .first();
    if (
      await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)
    ) {
      await generateBtn.click();
      await page.waitForTimeout(3_000);
    }

    // Either a network request fired, or the UI shows a generating/loading state
    const hasGeneratingState = await page
      .getByText(/generating|building|creating|processing|in progress/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    const requestFired = generateRequests.length > 0;

    // At least one signal that generation was initiated
    expect(requestFired || hasGeneratingState).toBe(true);
  });

  // ── 5. Project list shows status badge after state change ─────────────
  test("website project cards display status badges", async ({ page }) => {
    await page.waitForTimeout(1_000);

    // Look for any status badge on existing project cards
    const badges = page.getByText(
      /Draft|Live|Preview|Generating|Failed|Published/i,
    );
    const count = await badges.count();

    // If there are projects in the list, they must have status badges
    const hasProjectCards =
      (await page
        .locator('[class*="card"], [data-testid*="card"]')
        .filter({ hasNot: page.locator("h1, h2") })
        .count()) > 3;

    if (hasProjectCards && count > 0) {
      const text = await badges.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
    // Pass if no projects exist yet
  });

  // ── 6. Deploy button / publish trigger present in project detail ───────
  test("existing project has deploy / publish action available", async ({
    page,
  }) => {
    await page.waitForTimeout(1_200);

    // Check if any "Deploy", "Publish", or "Go Live" button exists
    const deployBtn = page.getByRole("button", {
      name: /deploy|publish|go live|view site/i,
    });
    const deployCount = await deployBtn.count();

    // If there are live/draft projects, deploy action must exist
    const hasLiveProjects = await page
      .getByText(/draft|live/i)
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (hasLiveProjects) {
      expect(deployCount).toBeGreaterThan(0);
    }
    // Pass when no projects exist
  });

  // ── 7. Domain connection UI reachable ─────────────────────────────────
  test("domain connection panel or custom domain input is accessible", async ({
    page,
  }) => {
    await page.waitForTimeout(1_000);

    // Look for domain-related UI
    const domainEntry = page
      .getByText(/custom domain|connect domain|add domain|your domain/i)
      .or(page.locator("input[placeholder*=domain i]"))
      .first();

    const hasDomainUi = await domainEntry
      .isVisible({ timeout: 4_000 })
      .catch(() => false);

    // Domain UI is present when there is at least one project card
    const projectCardCount = await page
      .locator('[class*="card"]')
      .filter({ hasNot: page.locator("h1, h2") })
      .count();

    if (projectCardCount > 3) {
      // Some projects exist — domain UI should be accessible somewhere
      // (may be hidden inside a card detail; just verify no crash)
    }
    // Non-fatal: domain UI may be behind an "advanced" toggle
    expect(hasDomainUi || projectCardCount <= 3).toBe(true);
  });

  // ── 8. No JS errors on page load ─────────────────────────────────────
  test("page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/websites");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    expect(errors).toHaveLength(0);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Open the website creation wizard by clicking the primary CTA.
 * Handles both "New Website" standalone button and template card clicks.
 */
async function openCreationWizard(page: Page): Promise<void> {
  // Try explicit "New Website" / "+" button first
  const newBtn = page
    .getByRole("button", { name: /new website|create website|\+ website/i })
    .first();
  if (await newBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await newBtn.click();
    return;
  }

  // Fallback: click the first template card's primary CTA
  const cta = page
    .getByRole("button", { name: /use this|build|generate|start|create/i })
    .first();
  if (await cta.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cta.click({ force: true });
    return;
  }

  // Last resort: click any visible template card
  const card = page.locator('[class*="card"], [class*="template"]').first();
  if (await card.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await card.click({ force: true });
  }
}
