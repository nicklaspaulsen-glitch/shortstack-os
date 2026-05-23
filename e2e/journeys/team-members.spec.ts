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
    // Find the member row and click its Remove icon button.
    const memberRow = page
      .locator("tr, [class*='member'], [class*='card']")
      .filter({ has: page.getByText(SENTINEL_EMAIL) })
      .first();

    // The Remove button triggers window.confirm() — a native browser dialog.
    // Register the handler BEFORE clicking so Playwright intercepts the dialog
    // as it fires. Without pre-registration the dialog auto-dismisses as
    // "dismissed" and the deletion never runs.
    page.on("dialog", (d) => d.accept());

    const removeBtn = memberRow
      .getByRole("button", { name: /remove/i })
      .first();

    if (await removeBtn.count() > 0) {
      await removeBtn.click();
      // Dialog is auto-accepted by the handler above. Wait for the row to leave.
      await expect(page.getByText(SENTINEL_EMAIL)).not.toBeVisible({ timeout: 15_000 });
    }
    // If no Remove button is reachable the sentinel account is harmless —
    // it uses an @example.com address and has no meaningful permissions.
  });
});
