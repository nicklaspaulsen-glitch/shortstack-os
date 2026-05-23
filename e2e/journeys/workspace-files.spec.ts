// Workspace Files E2E — /dashboard/workspace/files

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Workspace Files — File Manager", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping authenticated tests");
    test.setTimeout(200_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tour_completed", "true");
        localStorage.setItem("cookie-consent", "accepted");
      } catch {}
    });
    await page.goto("/dashboard/workspace/files");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ────────────────────────────────────────
  test("workspace files page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/workspace/files");
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
  test("renders editorial header with Workspace eyebrow and Workspace files h1", async ({ page }) => {
    const eyebrow = page.getByText(/Workspace/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /Workspace files/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. File list or empty/upload state renders — never blank ───────────────
  test("file list or upload area is visible — never blank", async ({ page }) => {
    const hasSkeleton = await page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByText(/no files|upload.*file|drag.*drop|get started|nothing here/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasFiles = await page
      .locator('[class*="file"], table tbody tr, [class*="grid"] > *, [class*="card"]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasFiles).toBe(true);
  });

  // ── 4. Upload button is visible ─────────────────────────────────────────────
  test("upload button or upload drop zone is visible", async ({ page }) => {
    const uploadBtn = page
      .getByRole("button", { name: /upload|add file|new file|import/i })
      .first();

    const isVisible = await uploadBtn.isVisible({ timeout: 6000 }).catch(() => false);

    // Fallback: look for a file input or drop zone
    const dropZone = page
      .locator('input[type="file"], [class*="drop"], [class*="dropzone"], [class*="upload"]')
      .first();
    const dropVisible = await dropZone.isVisible({ timeout: 3000 }).catch(() => false);

    // Also check for a link-style upload trigger
    const uploadLink = page
      .getByRole("link", { name: /upload/i })
      .first();
    const linkVisible = await uploadLink.isVisible({ timeout: 2000 }).catch(() => false);

    expect(isVisible || dropVisible || linkVisible).toBe(true);
  });

  // ── 5. No 404 or error state ────────────────────────────────────────────────
  test("workspace files does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /files/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
