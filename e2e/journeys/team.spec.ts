/**
 * Team E2E — /dashboard/team
 */

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Team — Team Management", () => {
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
    await page.goto("/dashboard/team");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("team page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/team");
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
  test("renders editorial header with Team Management eyebrow and Team h1", async ({ page }) => {
    const eyebrow = page.getByText(/Team Management/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /^Team$/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Tab-pill tabs render: Members, Permissions, Roles ─────────────────
  test("renders tab-pill tabs including Members, Permissions, and Roles", async ({ page }) => {
    const membersTab = page.getByRole("button", { name: /^Members$/i }).first();
    await expect(membersTab).toBeVisible({ timeout: 8000 });

    const permissionsTab = page.getByRole("button", { name: /^Permissions$/i }).first();
    await expect(permissionsTab).toBeVisible({ timeout: 8000 });

    const rolesTab = page.getByRole("button", { name: /^Roles$/i }).first();
    await expect(rolesTab).toBeVisible({ timeout: 8000 });
  });

  // ── 4. Members tab is active by default ──────────────────────────────────
  test("Members tab is active by default", async ({ page }) => {
    const activeTab = page.locator(".tab-pill.active").first();
    await expect(activeTab).toBeVisible({ timeout: 8000 });

    const text = await activeTab.textContent();
    expect((text ?? "").toLowerCase()).toMatch(/member/i);
  });

  // ── 5. Member list or invite prompt renders — never blank ────────────────
  test("member list or invite prompt renders — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSkeleton = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no members|invite.*first|add.*team|empty/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasMemberRole = await page
      .getByText(/owner|admin|manager|creator|viewer/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasAvatar = await page
      .locator('[class*="avatar"], img[alt]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasContainer = await page
      .locator("[class*='glass'], [class*='rounded-xl']")
      .filter({ has: page.locator("button") })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmptyState || hasMemberRole || hasAvatar || hasContainer).toBe(true);
  });

  // ── 6. No 404 or generic error state ─────────────────────────────────────
  test("team page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/page not found|something went wrong|404 not found|error 404/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /^Team$/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
