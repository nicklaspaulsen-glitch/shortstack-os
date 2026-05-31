/**
 * Projects E2E — /dashboard/projects
 *
 * Tests the Project Tracker page. Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Project Tracker" + h1 "Projects"
 *   • Project content or empty state is visible — never blank
 *   • A "create project" or "new project" button is visible
 *   • No 404 or generic error state
 *
 * No projects are created or modified in these tests.
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Projects — Project Tracker", () => {
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
    await page.goto("/dashboard/projects");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("projects page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/projects");
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
  test("renders editorial header with Project Tracker eyebrow and Projects h1", async ({ page }) => {
    const eyebrow = page.getByText(/Project Tracker/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Projects$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Project content or empty state is visible ─────────────────────────
  test("page shows project list, kanban board, or empty state — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator(".animate-pulse")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no projects|create your first|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasProjectContent = await page
      .getByText(/todo|in progress|done|backlog|project|task|milestone/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasCard = await page
      .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
      .filter({ has: page.locator("p, span, h3") })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasProjectContent || hasCard).toBe(true);
  });

  // ── 4. Create project / board button is visible ─────────────────────────
  test("create project or new project button is visible", async ({ page }) => {
    // Projects page uses "Board" as the unit — buttons are "New Board" / "Create board"
    const createBtn = page
      .getByRole("button", { name: /new project|create project|add project|\+ project|new board|create board/i })
      .first();

    const hasCreateBtn = await createBtn.isVisible({ timeout: 8000 }).catch(() => false);

    // Fallback: link with "new" or "create" text
    const hasCreateLink = await page
      .getByRole("link", { name: /new project|create project|new board|create board/i })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasCreateBtn || hasCreateLink).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("projects page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Projects$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
