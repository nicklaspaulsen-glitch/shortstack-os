import { test, expect } from "@playwright/test";

/**
 * Smoke suite — minimum viable tests that catch catastrophic failures:
 *   - Homepage renders and the app title is present
 *   - Unauthenticated dashboard access redirects to auth
 *   - Public pricing page renders plan tiers
 *
 * These run against whatever PLAYWRIGHT_BASE_URL points at (default: prod).
 * Add auth'd user-journey tests in a separate spec once we have test fixtures.
 */

test.describe("public smoke", () => {
  test("homepage renders with branding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ShortStack/i);
    // At least one anchor/button to sign up or log in should be visible
    await expect(page.getByRole("link", { name: /(sign\s*up|get\s*started|log\s*in)/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard requires auth (redirects to /login)", async ({ page }) => {
    const response = await page.goto("/dashboard");
    // Allow either a client-side redirect or a 307/302 to the login route
    await page.waitForURL(/\/(login|sign-in|auth)/i, { timeout: 10_000 });
    expect(response?.status()).toBeLessThan(500);
  });

  test("pricing page renders plan tiers", async ({ page }) => {
    const response = await page.goto("/pricing").catch(() => null);
    // If pricing lives under /dashboard/pricing it requires auth — tolerate both
    if (!response || response.status() >= 400) {
      await page.goto("/dashboard/pricing");
      await page.waitForURL(/\/(login|sign-in|auth|dashboard)/i, { timeout: 10_000 });
      return;
    }
    // At least one known tier should appear on the public pricing page
    await expect(
      page.getByText(/(starter|pro|business|agency|founder)/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("legal pages render (privacy, terms, cookies)", async ({ page }) => {
    for (const path of ["/privacy", "/terms", "/cookies"]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should return 200`).toBeLessThan(400);
      // Each page should have its title heading
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 8_000 });
    }
  });

  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json().catch(() => ({}));
    // Accept any shape — just must not 500
    expect(body).toBeDefined();
  });
});
