import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import {
  ROUTES_TO_CHECK,
  type SelfTestCheck,
} from "@/lib/self-test/routes-to-check";

/**
 * Tier-1 nightly self-test cron.
 *
 * Runs every night at 03:15 UTC (offset from token-refresh which uses 03:00).
 * For each fixture in `ROUTES_TO_CHECK`:
 *   1. Hits the route with fixture data.
 *   2. Compares actual vs expected status.
 *   3. If `expected_shape` is provided, checks top-level keys on the JSON body.
 *   4. Logs the result to `self_test_results`.
 *
 * ─── GUARDRAILS ───
 * - MUST have `CRON_SECRET` in the Authorization header (Vercel cron adds this
 *   automatically for the scheduled invocation; also used by the admin "Run
 *   now" button).
 * - DOES NOT modify any table other than `self_test_results`. This is a
 *   read-only observability job.
 * - Outbound side effects (emails, SMS) are routed through sentinel addresses
 *   defined in `routes-to-check.ts`.
 */
export const maxDuration = 300; // 5 minutes — we iterate ~40 routes
export const dynamic = "force-dynamic";

interface CheckResult {
  route_path: string;
  method: string;
  expected_status: number | number[];
  actual_status: number | null;
  ok: boolean;
  response_shape_match: boolean | null;
  error_text: string | null;
  duration_ms: number;
}

function statusMatches(expected: number | number[], actual: number): boolean {
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
}

function shapeMatches(expected: string[] | undefined, body: unknown): boolean | null {
  if (!expected || expected.length === 0) return null;
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;
  return expected.every((key) => key in obj);
}

async function runOneCheck(
  origin: string,
  token: string | null,
  check: SelfTestCheck,
): Promise<CheckResult> {
  const method = check.method || "GET";
  const url = `${origin}${check.path}`;
  const timeout = check.timeout_ms ?? 10_000;
  const started = Date.now();

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-self-test": "1", // lets downstream routes short-circuit real side effects if they want
  };
  if (check.auth_bearer && token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body:
        method !== "GET" && method !== "DELETE" && check.body !== undefined
          ? JSON.stringify(check.body)
          : undefined,
      signal: AbortSignal.timeout(timeout),
    });
    const duration = Date.now() - started;
    let body: unknown = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        body = await res.json();
      } catch {
        // body wasn't valid JSON — leave as null, shape check will fail
      }
    }
    const statusOk = statusMatches(check.expected_status, res.status);
    // Shape check only applies on 2xx responses. A 401/403/404/5xx body
    // never contains the success-path keys (it's an error envelope), so
    // shape-checking it is meaningless and would always fail when the
    // route is correctly auth-gated. The expected_shape describes the
    // happy path payload, not error responses.
    const isSuccess = res.status >= 200 && res.status < 300;
    const shapeOk = isSuccess ? shapeMatches(check.expected_shape, body) : null;
    const ok = statusOk && (shapeOk === null || shapeOk === true);
    return {
      route_path: check.path,
      method,
      expected_status: check.expected_status,
      actual_status: res.status,
      ok,
      response_shape_match: shapeOk,
      error_text: ok
        ? null
        : `status_expected=${JSON.stringify(check.expected_status)} actual=${res.status}${
            shapeOk === false ? " shape_mismatch" : ""
          }`,
      duration_ms: duration,
    };
  } catch (err) {
    const duration = Date.now() - started;
    return {
      route_path: check.path,
      method,
      expected_status: check.expected_status,
      actual_status: null,
      ok: false,
      response_shape_match: null,
      error_text: String(err).slice(0, 500),
      duration_ms: duration,
    };
  }
}

/**
 * Mint a short-lived JWT for the self-test user via the service-role client.
 * Returns null if SELF_TEST_USER_ID is not configured (checks will still run
 * but auth'd routes will return 401, which the fixtures tolerate).
 */
async function mintSelfTestToken(): Promise<string | null> {
  const userId = process.env.SELF_TEST_USER_ID;
  if (!userId) return null;

  try {
    const supabase = createServiceClient();
    // `generateLink` returns a magic-link URL containing an access_token we can
    // extract. This is simpler + safer than exposing a custom JWT signer.
    const { data, error } = await (supabase.auth as unknown as {
      admin: {
        generateLink: (p: { type: string; email: string }) => Promise<{
          data: { properties?: { action_link?: string; hashed_token?: string }; user?: { email?: string } } | null;
          error: Error | null;
        }>;
      };
    }).admin.generateLink({
      type: "magiclink",
      email: process.env.SELF_TEST_USER_EMAIL || "",
    });

    if (error || !data?.properties?.action_link) {
      console.warn("[self-test] Could not mint token:", error?.message);
      return null;
    }

    // Parse access_token out of the magic link fragment (Supabase returns
    // `...#access_token=...&refresh_token=...`)
    const link = data.properties.action_link;
    const hashIdx = link.indexOf("#");
    if (hashIdx === -1) return null;
    const params = new URLSearchParams(link.slice(hashIdx + 1));
    return params.get("access_token");
  } catch (err) {
    console.warn("[self-test] Token mint threw:", err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // ── Auth ──
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = randomUUID();
  const runStartedAt = new Date().toISOString();
  // Origin priority: explicit app URL → site URL → host header. Avoid
  // VERCEL_URL because that's the per-deployment URL which carries
  // deployment-protection auth — it 401s every public route. The
  // canonical app URL routes through CDN where protection is off.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${request.headers.get("host")}`;
  const normalizedOrigin = origin.startsWith("http") ? origin : `https://${origin}`;

  const token = await mintSelfTestToken();

  const supabase = createServiceClient();
  const results: CheckResult[] = [];
  let passed = 0;
  let failed = 0;

  // Run checks serially to avoid overwhelming any single route. The whole
  // sweep should fit in ~60s even with 40 routes + 10s timeouts.
  for (const check of ROUTES_TO_CHECK) {
    if (check.skip_in_self_test) continue;
    const result = await runOneCheck(normalizedOrigin, token, check);
    results.push(result);
    if (result.ok) passed++;
    else failed++;

    // Log each result immediately — if the cron crashes mid-run we still have
    // partial data for debugging.
    await supabase.from("self_test_results").insert({
      run_id: runId,
      run_started_at: runStartedAt,
      route_path: result.route_path,
      method: result.method,
      expected_status:
        typeof result.expected_status === "number"
          ? result.expected_status
          : result.expected_status[0] ?? null,
      actual_status: result.actual_status,
      ok: result.ok,
      response_shape_match: result.response_shape_match,
      error_text: result.error_text,
      duration_ms: result.duration_ms,
    });
  }

  return NextResponse.json({
    success: true,
    run_id: runId,
    total: results.length,
    passed,
    failed,
    duration_ms: results.reduce((sum, r) => sum + r.duration_ms, 0),
    failures: results.filter((r) => !r.ok).map((r) => ({
      route: r.route_path,
      method: r.method,
      actual: r.actual_status,
      expected: r.expected_status,
      error: r.error_text,
    })),
  });
}
