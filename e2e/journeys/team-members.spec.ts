import { test, expect } from "@playwright/test";
import { hasTestCreds, signIn, waitForDashboardReady } from "../helpers/auth";

const SENTINEL_EMAIL = `e2e-member-${Date.now()}@example.com`;
const SENTINEL_NAME = "E2E Test Member";
const SENTINEL_PASSWORD = "E2eTestPass!99";

test.describe("team members journey", () => {
  test.beforeEach(() => {
    if (!hasTestCreds()) {
      test.skip(
        true,
        "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping team tests",
      );
    }
  });

  test("invite team member and clean up", async ({ page }) => {
    // Production round-trips are slow: signIn ≈ 20s, API ≈ 5s, cleanup ≈ 10s.
    // Give this test its own budget well above the global 60s default.
    test.setTimeout(120_000);

    await signIn(page);
    await page.goto("/dashboard/team");
    // Wait for DashboardLayout to fully mount before interacting with the page.
    await waitForDashboardReady(page);

    // ── Open invite modal ──────────────────────────────────────────────────
    await page
      .getByRole("button", { name: /invite member/i })
      .first()
      .click();

    // Modal heading: "Create Team Member"
    await expect(
      page.getByRole("heading", { name: /create team member/i }),
    ).toBeVisible({ timeout: 8_000 });

    // ── Fill the form ───────────────────────────────────────────────────────
    // Click each input before filling to ensure React controlled-input events
    // fire correctly. React's synthetic onChange is wired to the native
    // `input` event — Playwright's fill() triggers it, but clicking first
    // ensures focus is properly set and React's event delegation picks up each
    // change immediately.
    const emailInput = page.getByPlaceholder("member@yourco.com");
    await emailInput.click();
    await emailInput.fill(SENTINEL_EMAIL);

    const nameInput = page.getByPlaceholder("Jane Smith");
    await nameInput.click();
    await nameInput.fill(SENTINEL_NAME);

    const passwordInput = page.getByPlaceholder("Min 8 chars");
    await passwordInput.click();
    await passwordInput.fill(SENTINEL_PASSWORD);
    // Tab out of the password field: fires blur → React flushes any pending
    // batched state updates → button disabled prop re-evaluates.
    await page.keyboard.press("Tab");

    // ── Submit ──────────────────────────────────────────────────────────────
    // Wait for React to re-render with non-empty email + password before
    // clicking. The 5 s timeout is generous — the re-render is usually <50 ms.
    const createMemberBtn = page.getByRole("button", { name: /create member/i });
    await expect(createMemberBtn).toBeEnabled({ timeout: 5_000 });
    await createMemberBtn.click();

    // Success toast — Supabase user creation can take several seconds in production.
    await expect(
      page.getByText(/team member created/i),
    ).toBeVisible({ timeout: 25_000 });

    // ── Verify the new member appears in the list ───────────────────────────
    await expect(page.getByText(SENTINEL_EMAIL).first()).toBeVisible({ timeout: 15_000 });

    // ── Clean up: remove the sentinel member ───────────────────────────────
    // Find the member row and click its edit/delete control
    const memberRow = page
      .locator("tr, [class*='member'], [class*='card']")
      .filter({ has: page.getByText(SENTINEL_EMAIL) })
      .first();

    // Clean up: click the "Remove" icon button directly on the member row.
    // Scoped to the row so we don't accidentally grab a Remove button that
    // sits behind an open modal backdrop (which would cause an intercept error).
    //
    // The app uses a custom React confirmation modal, not window.confirm, so
    // page.on("dialog") doesn't help — we explicitly look for and click the
    // confirmation button after the Remove click.
    const removeBtn = memberRow
      .getByRole("button", { name: /remove/i })
      .first();
    const removeBtnCount = await removeBtn.count();
    if (removeBtnCount > 0) {
      await removeBtn.click();
      // Handle custom React confirmation modal if it appears.
      const confirmBtn = page
        .getByRole("button", { name: /confirm|yes|yes,?\s*remove|delete member/i })
        .first();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await expect(page.getByText(SENTINEL_EMAIL)).not.toBeVisible({ timeout: 10_000 });
    } else {
      // Remove button not found in the row — try the edit modal path as fallback.
      const editBtn = memberRow.getByRole("button", { name: /edit|manage/i }).first();
      if (await editBtn.count() > 0) {
        await editBtn.click();
        // Scope deleteBtn inside the modal overlay to avoid the row's Remove button.
        const modal = page.locator('[role="dialog"], .fixed.inset-0').first();
        const deleteBtn = modal
          .getByRole("button", { name: /delete|remove member/i })
          .first();
        if (await deleteBtn.count() > 0) {
          await deleteBtn.click();
          const confirmBtn = page
            .getByRole("button", { name: /confirm|yes|yes,?\s*remove/i })
            .first();
          if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await confirmBtn.click();
          }
          await expect(page.getByText(SENTINEL_EMAIL)).not.toBeVisible({ timeout: 10_000 });
        }
      }
    }
    // If no delete path is reachable, the sentinel account is harmless —
    // it uses an @example.com address and has no meaningful permissions.
  });
});
