import { test, expect } from "@playwright/test";
import { hasTestCreds, signIn } from "../helpers/auth";

/**
 * Self-test journey.
 *
 * Prerequisites beyond standard E2E creds:
 *   - The signed-in account must have role = "admin" in the DB.
 *   - E2E_CRON_SECRET must match the CRON_SECRET env var on the server.
 *     The page prompts for it via window.prompt() if not cached in
 *     localStorage; we inject it via page.evaluate() before clicking
 *     "Run now" so the test is fully autonomous.
 */
const CRON_SECRET = process.env.E2E_CRON_SECRET ?? "";

test.describe("self-test journey", () => {
  test.beforeEach(() => {
    if (!hasTestCreds()) {
      test.skip(
        true,
        "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping self-test",
      );
    }
    if (!CRON_SECRET) {
      test.skip(
        true,
        "E2E_CRON_SECRET not set — skipping self-test (cannot authenticate the cron run)",
      );
    }
  });

  test("run self-test sweep and verify results", async ({ page }) => {
    await signIn(page);
    await page.goto("/dashboard/admin/self-test");

    // Guard: page redirects non-admins. If we land elsewhere, skip gracefully.
    const url = page.url();
    if (!url.includes("/admin/self-test")) {
      test.skip(true, "Test account is not an admin — skipping self-test");
      return;
    }

    // Inject CRON_SECRET into localStorage so window.prompt() is bypassed.
    await page.evaluate((secret: string) => {
      localStorage.setItem("self_test_cron_secret", secret);
    }, CRON_SECRET);

    // Click "Run now"
    await page.getByRole("button", { name: /run now/i }).click();

    // Wait for the button to switch to "Running…" state (confirms the request fired)
    await expect(page.getByRole("button", { name: /running/i })).toBeVisible({
      timeout: 5_000,
    });

    // Wait for the sweep to complete — the success toast appears when done.
    // The sweep can take up to 2 minutes in production.
    await expect(
      page.getByText(/done —/i),
    ).toBeVisible({ timeout: 120_000 });

    // Re-read the result summary from the verdict banner.
    // The banner shows "{passed}/{total} passed · last run …"
    const summary = page.getByText(/passed · last run/i).first();
    await expect(summary).toBeVisible({ timeout: 10_000 });

    // Extract the numbers: "{passed}/{total} passed"
    const summaryText = await summary.textContent();
    const match = summaryText?.match(/(\d+)\/(\d+)\s+passed/);

    if (match) {
      const passed = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);

      // Sanity check: at least 30 routes tested (the suite covers ~100+)
      expect(total).toBeGreaterThanOrEqual(30);

      // Failing count = total - passed — must be zero for a green run
      const failing = total - passed;
      expect(failing).toBe(0);
    } else {
      // If we can't parse the summary, at least confirm the "All routes green" banner
      await expect(
        page.getByText(/all routes green/i),
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
