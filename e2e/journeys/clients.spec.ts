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

    // Success toast
    await expect(page.getByText(/client added/i)).toBeVisible({ timeout: 10_000 });

    // ── Verify new client appears in the table ──────────────────────────────
    await expect(page.getByText(SENTINEL_NAME).first()).toBeVisible({ timeout: 10_000 });

    // ── Clean up: deactivate (archive) the sentinel client ─────────────────
    // Select the row checkbox for the sentinel client
    const row = page.locator("tr, [data-testid='client-row'], .client-card").filter({
      has: page.getByText(SENTINEL_NAME),
    }).first();

    // Try selecting via checkbox on the row if present
    const checkbox = row.locator('input[type="checkbox"]').first();
    const hasCheckbox = await checkbox.count();
    if (hasCheckbox > 0) {
      await checkbox.check();
      // Use bulk action dropdown to deactivate
      await page.getByRole("button", { name: /bulk action|action/i }).first().click();
      await page.getByRole("option", { name: /deactivate/i }).click();
      // Confirm the browser dialog if one appears
      page.on("dialog", (d) => d.accept());
    } else {
      // Fallback: try opening the client record to deactivate it.
      // Guard with a count check — if there's no matching button (card UI
      // without an explicit "manage" CTA), skip cleanup gracefully.
      // The sentinel uses an @example.com address so it's harmless if left.
      const viewBtn = row.getByRole("button", { name: /view|open|manage/i }).first();
      if (await viewBtn.count() > 0) {
        await viewBtn.click();
      }
    }
  });
});
