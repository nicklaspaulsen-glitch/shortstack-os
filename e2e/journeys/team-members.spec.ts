import { test, expect } from "@playwright/test";
import { hasTestCreds, signIn } from "../helpers/auth";

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
    await signIn(page);
    await page.goto("/dashboard/team");

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
    await page.getByPlaceholder("member@yourco.com").fill(SENTINEL_EMAIL);
    await page.getByPlaceholder("Jane Smith").fill(SENTINEL_NAME);
    await page.getByPlaceholder("Min 8 chars").fill(SENTINEL_PASSWORD);

    // ── Submit ──────────────────────────────────────────────────────────────
    await page
      .getByRole("button", { name: /create member/i })
      .click();

    // Success toast
    await expect(
      page.getByText(/team member created/i),
    ).toBeVisible({ timeout: 15_000 });

    // ── Verify the new member appears in the list ───────────────────────────
    await expect(page.getByText(SENTINEL_EMAIL).first()).toBeVisible({ timeout: 10_000 });

    // ── Clean up: remove the sentinel member ───────────────────────────────
    // Find the member row and click its edit/delete control
    const memberRow = page
      .locator("tr, [class*='member'], [class*='card']")
      .filter({ has: page.getByText(SENTINEL_EMAIL) })
      .first();

    // Try clicking an edit button, then delete from the edit modal
    const editBtn = memberRow.getByRole("button", { name: /edit|manage/i }).first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      const deleteBtn = page.getByRole("button", { name: /delete|remove/i }).first();
      if (await deleteBtn.count() > 0) {
        page.on("dialog", (d) => d.accept());
        await deleteBtn.click();
        await expect(page.getByText(SENTINEL_EMAIL)).not.toBeVisible({ timeout: 10_000 });
      }
    }
    // If delete is unavailable in the UI, the sentinel account is harmless —
    // it uses an @example.com address and has no meaningful permissions.
  });
});
