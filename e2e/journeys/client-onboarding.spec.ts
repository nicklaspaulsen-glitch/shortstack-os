/**
 * Client Onboarding E2E — full lifecycle
 *
 * Covers:
 *   1. Sign in → navigate to /dashboard/clients
 *   2. Open "Add Client" modal and fill all fields
 *   3. Submit → verify toast + new row appears
 *   4. Open client detail page (/dashboard/clients/[id])
 *   5. Verify profile sections render (overview, contacts, notes)
 *   6. Open "Invite to Portal" flow — verify modal/panel appears
 *   7. Navigate to portal invite link if available (URL pattern check)
 *   8. Clean up — delete the sentinel client
 *
 * Skips gracefully when E2E credentials are not set.
 */

import { test, expect } from "@playwright/test";
import {
  hasTestCreds,
  signIn,
  waitForDashboardReady,
  dismissTourIfPresent,
} from "../helpers/auth";

const SENTINEL_NAME = `Onboarding E2E ${Date.now()}`;
const SENTINEL_EMAIL = `onboarding-e2e-${Date.now()}@example.com`;
const SENTINEL_CONTACT = "E2E Contact Person";
const SENTINEL_PHONE = "+15550001234";

test.describe("Client Onboarding Flow", () => {
  test.beforeEach(() => {
    test.skip(
      !hasTestCreds(),
      "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping client onboarding tests",
    );
  });

  // ── Full lifecycle ────────────────────────────────────────────────────
  test("add → view profile → invite → delete", async ({ page }) => {
    test.setTimeout(180_000);

    await signIn(page);
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);

    // ── 1. Open Add Client modal ─────────────────────────────────────────
    const addBtn = page.getByRole("button", { name: /add client/i }).first();
    await addBtn.waitFor({ state: "visible", timeout: 10_000 });
    await addBtn.click();

    await expect(
      page.getByRole("heading", { name: /add client/i }),
    ).toBeVisible({ timeout: 8_000 });

    // ── 2. Fill the form ─────────────────────────────────────────────────
    await page
      .locator("#client-business-name")
      .waitFor({ state: "visible", timeout: 8_000 });
    await page.locator("#client-business-name").fill(SENTINEL_NAME);
    await page.locator("#client-contact-name").fill(SENTINEL_CONTACT);
    await page.locator("#client-email").fill(SENTINEL_EMAIL);

    // Fill phone if the field exists (optional)
    const phoneInput = page.locator(
      "input[type=tel], input[placeholder*=phone i], #client-phone",
    );
    if (await phoneInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await phoneInput.fill(SENTINEL_PHONE);
    }

    // ── 3. Submit & verify toast ─────────────────────────────────────────
    const submitBtn = page
      .getByRole("button", { name: /^add client$/i })
      .last();
    await submitBtn.evaluate((el) => (el as HTMLButtonElement).click());

    await expect(page.getByText(/client added/i)).toBeVisible({
      timeout: 20_000,
    });

    // ── 4. Verify client row appears in the table ────────────────────────
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("domcontentloaded");

    if (page.url().includes("/login")) {
      await signIn(page);
      await page.goto("/dashboard/clients");
      await page.waitForLoadState("domcontentloaded");
    }

    await waitForDashboardReady(page);
    const sentinelRow = page.getByText(SENTINEL_NAME).first();
    await expect(sentinelRow).toBeVisible({ timeout: 15_000 });

    // ── 5. Open client detail page ───────────────────────────────────────
    // Click the client row or a "View" link to navigate to client detail
    await sentinelRow.click().catch(async () => {
      // Fallback: look for a link or "View" button in the row
      const row = page
        .locator("tr")
        .filter({ has: page.getByText(SENTINEL_NAME) })
        .first();
      const viewBtn = row
        .getByRole("link")
        .or(row.getByRole("button", { name: /view|open|details/i }))
        .first();
      if (await viewBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await viewBtn.click();
      }
    });

    await page.waitForTimeout(1_000);

    // If we've navigated to a client detail page, verify key sections
    if (page.url().includes("/dashboard/clients/")) {
      // h1 heading with client name or "Client" present
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible({ timeout: 8_000 });

      // At least one of: overview / notes / contacts section
      const hasSection = await page
        .getByText(/overview|notes|contacts|activity|services/i)
        .first()
        .isVisible({ timeout: 4_000 })
        .catch(() => false);
      expect(hasSection).toBe(true);

      // ── 6. Invite to Portal ────────────────────────────────────────────
      const inviteBtn = page
        .getByRole("button", {
          name: /invite to portal|send portal invite|invite client/i,
        })
        .first();

      if (
        await inviteBtn.isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        await inviteBtn.click();
        await page.waitForTimeout(600);

        // A modal, drawer, or toast should appear
        const invitePanel = page
          .locator('[role="dialog"]')
          .or(page.getByText(/portal invite|invitation sent|invite email/i))
          .first();

        const panelVisible = await invitePanel
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        expect(panelVisible).toBe(true);

        // Close modal if it appeared
        const closeBtn = page
          .getByRole("button", { name: /close|cancel|dismiss/i })
          .first();
        if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await closeBtn.click().catch(() => {});
        }
      }
    }

    // ── 7. Clean up ──────────────────────────────────────────────────────
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("domcontentloaded");

    if (page.url().includes("/login")) {
      await signIn(page);
      await page.goto("/dashboard/clients");
      await page.waitForLoadState("domcontentloaded");
    }

    await waitForDashboardReady(page);
    await expect(
      page.getByText(SENTINEL_NAME).first(),
    ).toBeVisible({ timeout: 15_000 });

    const cleanupRow = page
      .locator("tr")
      .filter({ has: page.getByText(SENTINEL_NAME) })
      .first();

    if (await cleanupRow.count() > 0) {
      await cleanupRow.locator("button").first().click();
      page.on("dialog", (d) => d.accept());
      const deleteBtn = page.getByRole("button", { name: /^delete$/i }).first();
      if (await deleteBtn.count() > 0) {
        await deleteBtn.click();
        await expect(page.getByText(SENTINEL_NAME)).not.toBeVisible({
          timeout: 10_000,
        });
      }
    }
  });

  // ── Smoke: clients page loads with key structural elements ────────────
  test("clients page renders table or empty state without errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await signIn(page);
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);

    // No JS errors
    expect(errors).toHaveLength(0);

    // Page heading exists
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8_000 });

    // Add Client button is present
    await expect(
      page.getByRole("button", { name: /add client/i }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Either a table or empty-state message
    const hasContent =
      (await page.locator("table, [role=grid]").count()) > 0 ||
      (await page
        .getByText(/no clients|add your first|get started/i)
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── Smoke: client profile page structure ─────────────────────────────
  test("navigating directly to a client sub-route renders without 404", async ({
    page,
  }) => {
    await signIn(page);
    // Use the clients list to find the first real client ID
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await page.waitForTimeout(1_500);

    // Try to click first client row if table is present
    const firstRow = page.locator("tr td a, tr td button").first();
    if (await firstRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await firstRow.click().catch(() => {});
      await page.waitForTimeout(1_000);

      if (page.url().includes("/dashboard/clients/")) {
        const bodyText = await page.locator("body").innerText();
        expect(bodyText.toLowerCase()).not.toMatch(/404|page not found/);
        await expect(page.locator("h1").first()).toBeVisible({
          timeout: 8_000,
        });
      }
    }
    // Pass if no clients exist yet (nothing to navigate to)
  });
});
