import { test, expect } from "@playwright/test";
import { signIn, hasTestCreds } from "../helpers/auth";

/**
 * Integration health audit.
 *
 * Hits `/api/integrations/health` (admin/founder-only) and produces a
 * structured report of every integration's live state. Designed to answer
 * "which integrations are bugging or not configured?" in one run instead
 * of clicking 14 manage buttons by hand.
 *
 * Run:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
 *     npx playwright test e2e/journeys/integration-health-audit.spec.ts \
 *       --reporter=list
 *
 * Run against staging:
 *   PLAYWRIGHT_BASE_URL=https://staging... npx playwright test ...
 */

interface HealthResult {
  id: string;
  status: "connected" | "error" | "not_configured";
  detail?: string;
  missing?: string[];
}

interface HealthResponse {
  success: boolean;
  results?: HealthResult[];
  error?: string;
}

// Display order: errors first (most important), then unconfigured, then green.
const STATUS_RANK: Record<HealthResult["status"], number> = {
  error: 0,
  not_configured: 1,
  connected: 2,
};

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function formatRow(r: HealthResult): string {
  const icon = r.status === "connected" ? "OK   " : r.status === "error" ? "FAIL " : "MISS ";
  const id = pad(r.id, 22);
  const detail = r.status === "not_configured"
    ? `missing: ${(r.missing ?? []).join(", ") || "(unknown)"}`
    : (r.detail ?? "");
  return `  ${icon} ${id} ${detail}`;
}

test.describe("Integration health audit", () => {
  test.skip(!hasTestCreds(), "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run");

  test("every integration reports its real status", async ({ page, request }) => {
    // Sign in via the UI so the request below carries Supabase auth cookies.
    await signIn(page);

    // Hit the audit endpoint. Cookies set by signIn are automatically attached
    // to `page.request` (same context).
    const res = await page.request.get("/api/integrations/health");

    expect(res.ok(), `Audit endpoint returned ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as HealthResponse;
    expect(body.success, body.error ?? "unexpected response shape").toBeTruthy();
    expect(body.results, "Expected a results array").toBeDefined();

    const results = (body.results ?? []).slice().sort((a, b) => {
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      return rank !== 0 ? rank : a.id.localeCompare(b.id);
    });

    const errors = results.filter(r => r.status === "error");
    const missing = results.filter(r => r.status === "not_configured");
    const ok = results.filter(r => r.status === "connected");

    // Print a structured report. Visible in --reporter=list output and
    // captured in HTML reports under "Test attachments" (we attach JSON too).
    const lines = [
      "",
      "==================================================",
      "  INTEGRATION HEALTH AUDIT",
      "==================================================",
      `  Total: ${results.length}`,
      `   - connected:      ${ok.length}`,
      `   - error:          ${errors.length}`,
      `   - not_configured: ${missing.length}`,
      "",
      "ERRORS (live keys but provider rejected)",
      ...errors.map(formatRow),
      "",
      "NOT CONFIGURED (env vars missing)",
      ...missing.map(formatRow),
      "",
      "CONNECTED",
      ...ok.map(formatRow),
      "==================================================",
      "",
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    // Attach machine-readable JSON for CI dashboards / further processing.
    await test.info().attach("integration-health.json", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });

    // Soft-fail: integrations in `error` state are real bugs (live keys but
    // provider rejected). `not_configured` is acceptable in dev — env vars may
    // be intentionally absent. Tweak this assertion based on how strict you
    // want CI to be.
    expect(
      errors,
      `Integrations rejecting their keys: ${errors.map(e => `${e.id} (${e.detail})`).join(", ")}`
    ).toEqual([]);
  });
});
