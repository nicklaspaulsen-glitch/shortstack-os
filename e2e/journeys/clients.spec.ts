import { test, expect } from "@playwright/test";
import { hasTestCreds, signIn } from "../helpers/auth";

const SENTINEL_NAME = `E2E Test Client ${Date.now()}`;
const SENTINEL_EMAIL = `e2e-client-${Date.now()}@example.com`;
const CONTACT_NAME = "E2E Automation";

test.describe("clients journey", () => {
  test.beforeEach(() => {
    if (!hasTestCreds()) {
      test.skip(
        true,
        "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping client tests",
      );
    }
  });

  test("add client and clean up", async ({ page }) => {
    // Production round-trips are slow: signIn ≈ 20s, API ≈ 5s, cleanup ≈ 10s.
    // Give this test its own budget well above the global 60s default.
    test.setTimeout(120_000);

    await signIn(page);
    await page.goto("/dashboard/clients");

    // ── Open the Add Client modal ──────────────────────────────────────────
    await page
      .getByRole("button", { name: /add client/i })
      .first()
      .click();

    // Modal should appear with its title
    await expect(
      page.getByRole("heading", { name: /add client/i }),
    ).toBeVisible({ timeout: 8_000 });

    // ── Fill the form ───────────────────────────────────────────────────────
    // Target inputs by their stable IDs — labels contain a nested <span>*</span>
    // which can make getByLabel fragile. Also wait for the first input to be
    // interactive so any modal mount animation has completed.
    await page.locator("#client-business-name").waitFor({ state: "visible", timeout: 8_000 });
    await page.locator("#client-business-name").fill(SENTINEL_NAME);
    await page.locator("#client-contact-name").fill(CONTACT_NAME);
    await page.locator("#client-email").fill(SENTINEL_EMAIL);

    // ── Submit ──────────────────────────────────────────────────────────────
    // The "Add Client" submit button sits below the fold in a tall modal on a
    // 720px viewport. Use page.evaluate to fire the native DOM .click() which
    // bypasses Playwright's viewport constraint entirely — the browser handles
    // the event exactly as if a user clicked it.
    const submitBtn = page
      .getByRole("button", { name: /^add client$/i })
      .last();
    await submitBtn.evaluate((el) => (el as HTMLButtonElement).click());

    // Success toast — production API can be slow; use a generous timeout.
    await expect(page.getByText(/client added/i)).toBeVisible({ timeout: 20_000 });

    // ── Verify new client appears in the table ──────────────────────────────
    await expect(page.getByText(SENTINEL_NAME).first()).toBeVisible({ timeout: 15_000 });

    // ── Clean up: delete the sentinel client ──────────────────────────────
    // The clients DataTable uses a custom <button> element for row selection
    // (not a native input[type="checkbox"]). Strategy:
    //   1. Find the sentinel's <tr> row.
    //   2. Click the first button in the row — that is the selection toggle
    //      rendered by the "select" column.
    //   3. The bulk-actions bar appears with Email / SMS / Deactivate / Delete.
    //   4. Register the dialog handler BEFORE clicking Delete, because
    //      handleBulkAction("delete") fires window.confirm synchronously.
    //   5. Confirm the dialog to complete the delete.
    const sentinelRow = page
      .locator("tr")
      .filter({ has: page.getByText(SENTINEL_NAME) })
      .first();

    if (await sentinelRow.count() > 0) {
      // Click the selection toggle (first button = custom checkbox substitute)
      await sentinelRow.locator("button").first().click();

      // Register dialog handler BEFORE clicking Delete — confirm fires
      // synchronously inside the click handler and we must be listening first.
      page.on("dialog", (d) => d.accept());

      const deleteBtn = page.getByRole("button", { name: /^delete$/i }).first();
      if (await deleteBtn.count() > 0) {
        await deleteBtn.click();
        await expect(page.getByText(SENTINEL_NAME)).not.toBeVisible({ timeout: 10_000 });
      }
    }
    // If the delete path is unavailable, the sentinel is harmless —
    // it uses an @example.com address and has no real permissions.
  });
});
