/**
 * Tier-1 self-test route fixtures.
 *
 * The nightly cron (`/api/cron/self-test`) iterates this list, hits each route
 * with the fixture payload, asserts response status + optional shape, and logs
 * the result into `self_test_results`.
 *
 * ─── GUARDRAIL ───
 * NOTHING IN THIS LIST MAY CAUSE REAL-WORLD SIDE EFFECTS.
 *   • Outbound email → must target `test@example.com` (Resend bounces silently)
 *   • Outbound SMS   → must target `+15005550006` (Twilio magic no-charge number)
 *   • Stripe charges → must use test-mode idempotency keys only; never live-mode
 *   • LLM calls      → fine to hit (metered), but keep prompts ≤ ~50 tokens
 *
 * If a route would fire a real action, either (a) mark it GET-only, (b) use
 * the sentinel emails/phones above, or (c) set `skip_in_self_test: true`.
 *
 * ─── EXPECTED-STATUS SEMANTICS ───
 * `expected_status` can be a single number or an array. The check passes if
 * `actual_status` matches one of them. Many endpoints that require real auth
 * should return 401 here (the cron runs with service-role token in
 * `SELF_TEST_USER_ID`'s context; unauth'd routes shouldn't be touched).
 *
 * `expected_shape` (optional) is a set of top-level keys we expect on the JSON
 * response body. Presence-check only, no type validation.
 */

export interface SelfTestCheck {
  /** Path under the origin, e.g. `/api/health`. No query string unless needed. */
  path: string;
  /** HTTP method. Defaults to GET if omitted. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body for POST/PUT/PATCH. */
  body?: unknown;
  /** Expected status or list of acceptable statuses. */
  expected_status: number | number[];
  /** Optional: top-level keys we expect on the response JSON. */
  expected_shape?: string[];
  /** If true, sends the service-role bearer token. Default false. */
  auth_bearer?: boolean;
  /** Human-readable note for the dashboard. */
  note?: string;
  /** If true, skip this check entirely (kept for doc / quick-disable). */
  skip_in_self_test?: boolean;
  /** Custom per-check timeout (ms). Default 10_000. */
  timeout_ms?: number;
}

// Sentinel values. DO NOT change without checking provider docs first.
export const SELF_TEST_SENTINEL_EMAIL = "test@example.com";
export const SELF_TEST_SENTINEL_PHONE = "+15005550006"; // Twilio magic "no-charge" test number
export const SELF_TEST_DUMMY_JOB_ID = "00000000-0000-0000-0000-000000000000";

export const ROUTES_TO_CHECK: SelfTestCheck[] = [
  // ── Public / unauth health endpoints ─────────────────────────────────────
  {
    path: "/api/health",
    expected_status: [200, 503],
    expected_shape: ["status", "timestamp", "checks"],
    note: "Public uptime probe. 503 is acceptable (degraded ≠ broken).",
  },
  {
    path: "/api/health-check",
    expected_status: [200, 401, 404],
    note: "Alternate health endpoint (if present).",
  },

  // ── Auth-gated list endpoints (authed via SELF_TEST_USER_ID) ─────────────
  // 401 is in the expected list because mintSelfTestToken() returns null
  // when SELF_TEST_USER_ID env isn't set — the unauth'd 401 then proves
  // the auth gate is in place. A failing self-test on these routes means
  // the route DIDN'T 401 (potential regression in auth).
  {
    path: "/api/clients",
    auth_bearer: true,
    expected_status: [200, 401],
    note: "GET returns array (may be empty). 401 is fine if SELF_TEST_USER_ID isn't set.",
  },
  {
    path: "/api/leads",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/deals",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/content",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/content-library",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/content-plan",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/campaigns",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/conversations",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/triggers/list",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/workflows",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/sequences",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/crm",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/analytics",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/insights",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/notifications",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/reports",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/reviews",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/domains",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/invoices",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/profile",
    auth_bearer: true,
    expected_status: [200, 401],
  },
  {
    path: "/api/profiles",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/settings",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/billing",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/usage",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/system-status",
    auth_bearer: true,
    expected_status: [200, 401, 403],
    note: "Admin-only; test user isn't always admin. 401 (no token) and 403 (not admin) both fine.",
  },

  // ── POST endpoints with benign / sentinel payloads ───────────────────────
  {
    path: "/api/trinity/chat",
    method: "POST",
    auth_bearer: true,
    body: {
      message: "self-test ping — please respond with only 'ok'",
      stream: false,
    },
    expected_status: [200, 401, 404],
    note: "LLM call — short prompt, token cost minimal.",
    timeout_ms: 25_000,
  },
  {
    path: "/api/emails/send",
    method: "POST",
    auth_bearer: true,
    body: {
      to: SELF_TEST_SENTINEL_EMAIL,
      subject: "self-test (ignore)",
      html: "<p>self-test probe — do not reply</p>",
      _self_test: true,
    },
    expected_status: [200, 400, 401, 422],
    expected_shape: ["email_id"],
    note: `Routed to ${SELF_TEST_SENTINEL_EMAIL} — Resend accepts + silently drops.`,
  },
  {
    path: "/api/sms/send",
    method: "POST",
    auth_bearer: true,
    body: {
      to: SELF_TEST_SENTINEL_PHONE,
      body: "self-test",
      _self_test: true,
    },
    expected_status: [200, 400, 401, 404],
    note: `Twilio magic number ${SELF_TEST_SENTINEL_PHONE} — no charge.`,
  },
  // ── Dialer v1 (manual SMS / voice / DM) ────────────────────────────────
  {
    path: "/api/dialer/token",
    method: "POST",
    auth_bearer: true,
    expected_status: [200, 401, 503],
    note: "503 acceptable — TWILIO_API_KEY/TWILIO_TWIML_APP_SID may be unset in self-test env.",
  },
  {
    path: "/api/dialer/call",
    method: "POST",
    auth_bearer: true,
    body: {
      to: SELF_TEST_SENTINEL_PHONE,
      contact_name: "self-test",
      _self_test: true,
    },
    expected_status: [200, 400, 401, 403],
    note: `Records voice_calls row only — no actual dial. Twilio magic number ${SELF_TEST_SENTINEL_PHONE}.`,
  },
  {
    path: "/api/dialer/disposition",
    method: "POST",
    auth_bearer: true,
    body: {
      call_id: SELF_TEST_DUMMY_JOB_ID,
      disposition: "no_answer",
      notes: "self-test",
      _self_test: true,
    },
    expected_status: [200, 400, 401, 403],
    note: "Dummy call_id → expect 403 (call not found) or 401.",
  },
  {
    path: "/api/dialer/ai-polish",
    method: "POST",
    auth_bearer: true,
    body: { text: "ping", channel: "sms" },
    expected_status: [200, 400, 401, 503],
    timeout_ms: 25_000,
  },
  {
    path: "/api/sms/send-manual",
    method: "POST",
    auth_bearer: true,
    body: {
      to: SELF_TEST_SENTINEL_PHONE,
      body: "self-test",
      _self_test: true,
    },
    expected_status: [200, 400, 401, 402, 503],
    note: `Twilio magic number ${SELF_TEST_SENTINEL_PHONE} — no charge.`,
  },
  {
    path: "/api/sms/send-bulk",
    method: "POST",
    auth_bearer: true,
    body: {
      recipients: [{ to: SELF_TEST_SENTINEL_PHONE, first_name: "Test" }],
      template: "Hi {{first_name}}, self-test.",
      throttle_ms: 100,
      _self_test: true,
    },
    expected_status: [200, 400, 401, 402, 503],
    note: `Single-recipient bulk to magic number ${SELF_TEST_SENTINEL_PHONE}.`,
  },
  {
    path: "/api/dm/send-manual",
    method: "POST",
    auth_bearer: true,
    body: {
      platform: "instagram",
      handle: "selftest",
      message: "self-test",
      _self_test: true,
    },
    expected_status: [200, 400, 401, 502],
    note: "200 with queued=true expected when ZERNIO_API_KEY isn't set.",
  },
  {
    path: "/api/ai/generate",
    method: "POST",
    auth_bearer: true,
    body: { prompt: "ping", max_tokens: 5 },
    expected_status: [200, 400, 401, 404],
    timeout_ms: 25_000,
  },
  {
    path: "/api/copywriter",
    method: "POST",
    auth_bearer: true,
    body: { prompt: "self-test", max_tokens: 5 },
    expected_status: [200, 400, 401, 404],
    timeout_ms: 25_000,
  },
  {
    path: "/api/search",
    method: "POST",
    auth_bearer: true,
    body: { query: "self-test" },
    expected_status: [200, 400, 401, 404],
  },

  // ── Endpoints that SHOULD return an error for our fixture inputs ─────────
  {
    path: `/api/thumbnail/status?job_id=${SELF_TEST_DUMMY_JOB_ID}`,
    expected_status: [404, 200, 401],
    note: "Dummy job_id → expect 404 (or gracefully 200 with status=not_found).",
  },
  {
    path: "/api/webhooks/resend",
    method: "POST",
    body: {}, // empty payload
    expected_status: [400, 401, 403],
    note: "Empty payload — should reject with 400.",
  },
  {
    path: "/api/billing/webhook",
    method: "POST",
    body: {},
    expected_status: [400, 401, 403],
    note: "No stripe-signature header — must reject.",
  },
  {
    path: "/api/webhooks/twilio",
    method: "POST",
    body: {},
    expected_status: [400, 401, 403, 404],
  },

  // ── Admin / ops endpoints ────────────────────────────────────────────────
  {
    path: "/api/admin/self-test/latest",
    auth_bearer: true,
    expected_status: [200, 401, 403],
    note: "Self-read — our own dashboard API.",
  },
  {
    path: "/api/audit-log",
    auth_bearer: true,
    expected_status: [200, 401, 403, 404],
  },

  // ── Integration presence pings (no payload, just liveness) ───────────────
  {
    path: "/api/integrations",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },
  {
    path: "/api/oauth/status",
    auth_bearer: true,
    expected_status: [200, 401, 404],
  },

  // ── Nango integration (Google Ads — first migrated provider) ─────────────
  // 503 acceptable when NANGO_SECRET_KEY isn't set in the test env. 401 when
  // self-test runs unauth'd (default). 200 once the env is configured AND
  // SELF_TEST_USER_ID has a session.
  {
    path: "/api/integrations/nango/connect/google-ads",
    auth_bearer: true,
    expected_status: [200, 401, 404, 503],
    note: "Nango Google Ads connect prep — auth-gated; 503 if NANGO_SECRET_KEY missing.",
  },
  {
    path: "/api/integrations/nango/disconnect/google-ads",
    method: "POST",
    auth_bearer: true,
    body: {},
    expected_status: [200, 400, 401, 404, 503],
    note: "Nango Google Ads disconnect — empty body OK; idempotent on missing connection.",
  },
  {
    path: "/api/integrations/nango/connections",
    auth_bearer: true,
    expected_status: [200, 401],
    note: "Lists current user's Nango connections. 401 when self-test runs unauth'd; 200 with [] when authed but nothing connected.",
  },
  {
    path: "/api/integrations/nango/finalize",
    method: "POST",
    auth_bearer: true,
    body: {}, // empty payload — must reject as 400 (missing integrationId) or 401 (no auth)
    expected_status: [400, 401],
    note: "Finalize handler validates body shape — empty body must be rejected, never silently accepted.",
  },

  // ── Social Studio (MVP — calendar/lineup, AI upload, trends, stats, commenters) ──
  {
    path: "/api/social/lineup",
    auth_bearer: true,
    expected_status: [200, 401],
    note: "Lineup feed — auth-gated. 200 returns { posts, stats }.",
  },
  {
    path: "/api/social/auto-upload",
    method: "POST",
    auth_bearer: true,
    body: {}, // empty payload — must reject (no media + no text)
    expected_status: [400, 401],
    note: "AI auto-upload — empty body rejected before AI is called.",
  },
  {
    path: "/api/social/schedule",
    method: "POST",
    auth_bearer: true,
    body: {}, // empty payload — must reject (no platforms + no caption)
    expected_status: [400, 401],
    note: "Schedule post — required-field validation (platforms[] + caption).",
  },
  {
    path: "/api/social/trends",
    auth_bearer: true,
    expected_status: [200, 401, 429],
    note: "Trends + content ideas. 429 acceptable when rate-limited.",
  },
  {
    path: "/api/social/stats",
    auth_bearer: true,
    expected_status: [200, 401],
    note: "Aggregated post performance — 200 with empty arrays for new accounts.",
  },
  {
    path: "/api/social/top-commenters",
    auth_bearer: true,
    expected_status: [200, 401],
    note: "Top commenters list — 200 with empty array until Zernio webhooks land.",
  },

  // ── GHL Phase 2 builders: Courses / Funnels / A/B Tests ─────────────────
  {
    path: "/api/courses",
    auth_bearer: true,
    expected_status: [200, 401],
    note: "Course list — owner-scoped; 401 when self-test runs unauth'd.",
  },
  {
    path: "/api/courses",
    method: "POST",
    auth_bearer: true,
    body: {},
    expected_status: [400, 401],
    note: "Course create — title required.",
  },
  {
    path: "/api/funnels",
    auth_bearer: true,
    expected_status: [200, 401],
    note: "Funnel list — owner-scoped.",
  },
  {
    path: "/api/funnels",
    method: "POST",
    auth_bearer: true,
    body: {},
    expected_status: [400, 401],
    note: "Funnel create — name required.",
  },
  {
    path: "/api/ab-tests",
    auth_bearer: true,
    expected_status: [200, 401],
    note: "A/B test list — owner-scoped.",
  },
  {
    path: "/api/ab-tests",
    method: "POST",
    auth_bearer: true,
    body: {},
    expected_status: [400, 401],
    note: "A/B test create — required-field validation.",
  },
  {
    path: "/api/f/__nope__/__missing__/event",
    method: "POST",
    body: { event_type: "view", visitor_id: "self-test" },
    expected_status: [404, 400],
    note: "Public funnel-event endpoint — unknown slug must 404, not 500.",
  },
];

/** Total count helper for the dashboard. */
export const SELF_TEST_ROUTE_COUNT = ROUTES_TO_CHECK.filter((r) => !r.skip_in_self_test).length;
