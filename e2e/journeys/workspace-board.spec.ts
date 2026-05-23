// Workspace Board E2E — /dashboard/workspace/board

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Workspace Board — Kanban Task Board", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping authenticated tests");
    test.setTimeout(200_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tour_completed", "true");
        localStorage.setItem("cookie-consent", "accepted");
      } catch {}
    });
    await page.goto("/dashboard/workspace/board");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("workspace board page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/workspace/board");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const filtered = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection") &&
        !e.includes("hydration"),
    );
    expect(filtered).toHaveLength(0);
  });

  // ── 2. Editorial header: eyebrow + h1 ──────────────────────────────────────
  test("renders editorial header with Workspace eyebrow and Board h1", async ({ page }) => {
    const eyebrow = page.getByText(/Workspace/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Board$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Kanban columns or empty state visible ────────────────────────────────
  test("kanban board columns or empty state are visible", async ({ page }) => {
    const hasColumns = await page
      .getByText(/backlog|todo|in progress|done|review|complete/i)
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no tasks|create.*task|add.*task|nothing here|get started/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasBoardContainer = await page
      .locator('[class*="board"], [class*="kanban"], [class*="column"], [class*="lane"]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasColumns || hasEmpty || hasBoardContainer).toBe(true);
  });

  // ── 4. Create task / card button is visible ─────────────────────────────────
  test("create task or add card button is visible on the board", async ({ page }) => {
    const createBtn = page
      .getByRole("button", { name: /add task|create task|new task|add card|new card|create|add/i })
      .first();

    const isVisible = await createBtn.isVisible({ timeout: 6000 }).catch(() => false);

    // Fallback: look for a "+" icon button or inline add row
    const plusBtn = page
      .locator('button[aria-label*="add"], button[aria-label*="create"], button[title*="add"]')
      .first();
    const plusVisible = await plusBtn.isVisible({ timeout: 3000 }).catch(() => false);

    expect(isVisible || plusVisible).toBe(true);
  });

  // ── 5. No 404 or error state ────────────────────────────────────────────────
  test("workspace board does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /board/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
