import { test, expect } from "@playwright/test";
import { signOut } from "../helpers/auth";

/**
 * API health-check journey — verifies that GET /api/health returns a valid
 * response and that the root page is reachable.
 *
 * These tests are intentionally auth-free: they exercise publicly-reachable
 * endpoints so they can run in CI without E2E credentials.
 *
 * Run:
 *   npx playwright test e2e/journeys/api-health.spec.ts --reporter=list
 */

test.describe("API health checks (no auth required)", () => {
  test("GET /api/health returns 200 or 503 with a valid JSON body", async ({ request }) => {
    const res = await request.get("/api/health");

    // The endpoint returns 200 (healthy) or 503 (degraded) — both are valid
    // responses from a running server. A 404 or 5xx crash would be the bug.
    expect([200, 503], `Unexpected status ${res.status()}`).toContain(res.status());

    const body = await res.json();

    // Shape assertions — the contract defined in src/app/api/health/route.ts
    expect(body).toHaveProperty("status");
    expect(["healthy", "degraded"]).toContain(body.status);
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("checks");
    expect(typeof body.checks).toBe("object");

    // Log the full check breakdown for CI visibility
    // eslint-disable-next-line no-console
    console.log(
      `[api-health] status=${body.status} checks=${JSON.stringify(body.checks)} uptime=${body.uptime}s memory=${body.memory_mb}MB`,
    );
  });

  test("root page (/) responds with 200 — server is up", async ({ request }) => {
    // A basic reachability check. A 200 means Next.js is serving the app.
    // Redirects (301/302) are also acceptable (e.g. / → /login).
    const res = await request.get("/", { maxRedirects: 5 });

    expect(res.status()).toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(400);
  });

  test("/login page renders HTML without error", async ({ page }) => {
    // storageState provides a valid session — sign out first so /login is
    // reachable (middleware redirects authenticated users to /dashboard).
    await signOut(page);
    await page.goto("/login");
    await page.waitForURL(/\/login/, { timeout: 15_000 });

    // The login form must contain at least an email input
    await expect(page.getByPlaceholder("you@company.com")).toBeVisible({
      timeout: 10_000,
    });

    // No 404 / crash text
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.toLowerCase()).not.toMatch(/404|page not found|application error/);
  });
});
