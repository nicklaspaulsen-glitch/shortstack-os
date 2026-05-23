// Workspace Whiteboard E2E — /dashboard/workspace/whiteboard

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Workspace Whiteboard — Collaborative Canvas", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping authenticated tests");
    test.setTimeout(200_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tour_completed", "true");
        localStorage.setItem("cookie-consent", "accepted");
      } catch {}
    });
    await page.goto("/dashboard/workspace/whiteboard");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("workspace whiteboard page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/workspace/whiteboard");
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
  test("renders editorial header with Workspace eyebrow and Workspace Whiteboard h1", async ({ page }) => {
    const eyebrow = page.getByText(/Workspace/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Workspace Whiteboard/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Whiteboard canvas or placeholder is visible ─────────────────────────
  test("whiteboard canvas or placeholder area is visible", async ({ page }) => {
    // Give canvas-heavy libraries (Excalidraw, tldraw, etc.) extra time to mount
    await page.waitForTimeout(2000);

    const hasCanvas = await page
      .locator('canvas, [class*="canvas"], [class*="whiteboard"], [class*="board-container"]')
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    const hasPlaceholder = await page
      .getByText(/start drawing|create.*board|new whiteboard|open whiteboard|loading/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasIframe = await page
      .locator('iframe')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    expect(hasCanvas || hasPlaceholder || hasIframe).toBe(true);
  });

  // ── 4. No 404 or error state ────────────────────────────────────────────────
  test("workspace whiteboard does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /whiteboard/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // ── 5. Page does not remain in a loading state indefinitely ────────────────
  test("whiteboard page resolves out of loading state within timeout", async ({ page }) => {
    // Allow extra time for canvas-heavy libraries to initialize
    await page.waitForTimeout(3000);

    const stillLoading = await page
      .getByText(/^loading\.\.\.$/i)
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // A spinner alone is acceptable during init, but it must eventually resolve.
    // If the spinner is still showing after 3 s of extra wait, flag it as stuck.
    expect(stillLoading).toBe(false);
  });
});
