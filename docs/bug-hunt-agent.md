# Bug-hunt agent — Ops docs

Two-tier observability for the OS. Tier 1 runs every night and is cheap; Tier 2
runs weekly and is expensive but thorough.

---

## Tier 1 — Nightly self-test cron

**Schedule:** 03:15 UTC every night (configured in `vercel.json`).
**Route:** `/api/cron/self-test`
**Fixtures:** `src/lib/self-test/routes-to-check.ts` (~40 routes)
**Results table:** `self_test_results` in Supabase
**Dashboard:** `/dashboard/admin/self-test` (admin-gated)

### How it works

1. Vercel cron hits `/api/cron/self-test` with `Authorization: Bearer $CRON_SECRET`.
2. The route mints a short-lived access token for `SELF_TEST_USER_ID` via a
   magic-link (service-role call to `supabase.auth.admin.generateLink`).
3. It iterates every fixture in `ROUTES_TO_CHECK`, hitting each route in
   sequence. For each:
   - Method + body as specified.
   - `authorization: Bearer <test user token>` if `auth_bearer: true`.
   - Header `x-self-test: 1` so downstream code can short-circuit side effects.
4. Status is compared against `expected_status` (single int or array).
5. If `expected_shape` is provided, the top-level keys of the JSON body are
   checked for presence only.
6. Each result is inserted into `self_test_results` immediately (partial runs
   survive a mid-run crash).
7. The route returns a JSON summary with counts + a list of failures.

### Guardrails

**No real-world side effects.** Every outbound-action check routes through:

- `test@example.com` — Resend accepts + silently drops (sandbox behaviour).
- `+15005550006` — Twilio magic "no-charge" test number.

The `x-self-test: 1` header lets individual routes check `req.headers.get("x-self-test")`
and bail before sending real messages. If you add a new route that does
outbound I/O, guard it:

```ts
if (req.headers.get("x-self-test") === "1") {
  return NextResponse.json({ _simulated: true }, { status: 200 });
}
```

**No auto-fix.** The cron is read-only — it only writes to `self_test_results`.
It does not modify any business data.

### Expected vs actual

- A single expected status is the strict pass-target.
- An array `[200, 401, 404]` means "any of these is fine". Use this for routes
  where the test user's auth state determines the realistic outcome.
- `expected_shape: ["id", "data"]` checks presence of those top-level keys on
  the JSON body. No type-checking, no nested paths.

### Interpreting the dashboard

- **Green banner + all rows green** → no action needed.
- **Red banner with N failing routes** → click "Failed" tab to see just the
  failures. Check the `error` column for the mismatch detail (`status_expected=200
  actual=500` or `shape_mismatch`).
- **Trend sparkline** — 14 most recent runs. Each bar is height-scaled by total
  checks run; red overlay is fail ratio.

### Skipping a check temporarily

Edit `src/lib/self-test/routes-to-check.ts` and add `skip_in_self_test: true`:

```ts
{
  path: "/api/something-known-broken",
  expected_status: 200,
  skip_in_self_test: true, // TODO(nicklas): re-enable after fixing issue #123
},
```

Commit with the TODO so you don't forget.

### Env vars Nicklas has to set

- `SELF_TEST_USER_ID` — UUID of a dedicated test user in Supabase.
- `SELF_TEST_USER_EMAIL` — that user's email (for the magic-link token mint).
- `CRON_SECRET` — already set, used by Vercel cron.

To create the test user, run in Supabase SQL editor:

```sql
-- Create a non-privileged test user. Plan-tier = "Starter" so paywall doesn't block.
-- Copy the returned `id` into SELF_TEST_USER_ID and the email into SELF_TEST_USER_EMAIL.
insert into auth.users (email, raw_user_meta_data, email_confirmed_at)
values ('self-test@shortstack.internal', '{}', now())
returning id, email;

-- Then upsert the profile:
insert into profiles (id, email, role, plan_tier, subscription_status, is_active)
values ('<UUID from above>', 'self-test@shortstack.internal', 'user', 'Starter', 'active', true);
```

### Running manually

From the admin dashboard, click "Run now" — you'll be prompted for `CRON_SECRET`
once (cached in localStorage).

Or via curl:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/self-test
```

---

## Tier 2 — Weekly deep-run agent (SCAFFOLD ONLY)

**Status:** Scaffold committed, Playwright not yet wired up.
**Schedule (planned):** Saturday 02:00 UTC.
**Script:** `scripts/bug-hunt-deep-run.mjs`

### What it will do

1. Launch headless Chromium.
2. Sign in as a seeded test user (session token injected via localStorage).
3. Walk every dashboard page in `PAGES_TO_WALK` (hard-coded for now; move to
   `src/lib/self-test/pages-to-walk.ts` once we're happy with the list).
4. For each page:
   - `goto(..., { waitUntil: "networkidle" })` with a 20s timeout.
   - Capture HTTP status, console errors, `pageerror` events.
   - Scan body text for anomaly signatures: error boundaries, raw "404", "NaN",
     "undefined", `[object Object]`.
   - Screenshot full-page to `/tmp/bug-hunt/<name>.png`.
5. Summarize and file one GitHub issue per anomaly via `gh issue create`.

### Enabling Tier 2

1. Install Playwright:
   ```bash
   npm install --save-dev @playwright/test
   npx playwright install chromium
   ```
2. Seed or pick a dedicated test-walker user (separate from SELF_TEST_USER_ID —
   this one needs to be able to render full dashboards without hitting the
   paywall).
3. Export env for the runner:
   ```bash
   export BUG_HUNT_BASE_URL="https://shortstack.example.com"
   export BUG_HUNT_SESSION_TOKEN="<access_token from supabase magic link>"
   export GITHUB_TOKEN="<pat with issues:write on your repo>"
   ```
4. Smoke-test locally:
   ```bash
   node scripts/bug-hunt-deep-run.mjs --base-url=http://localhost:3000 --headed
   ```
5. Wire up as a GitHub Actions cron (`.github/workflows/bug-hunt-weekly.yml`) —
   Vercel Edge cron cannot run a headful browser, so this is NOT in `vercel.json`.

### Issue filing (TODO)

The scaffold currently prints anomalies to stdout. To file GitHub issues, add
inside `run()` after the walk:

```js
import { execSync } from "node:child_process";
for (const r of failing) {
  const title = `[bug-hunt] ${r.name} — ${r.status}`;
  const body = [
    `URL: ${r.url}`,
    `Duration: ${r.duration_ms}ms`,
    "",
    "Anomalies:",
    ...r.anomalies.map((a) => `- ${a.key}: ${a.detail}`),
  ].join("\n");
  execSync(`gh issue create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} --label bug-hunt`);
}
```

Dedupe by checking `gh issue list --label bug-hunt --state open --search <name>`
before creating — otherwise you'll get one new issue per week per broken page.

### Claude-powered triage (future)

Once the screenshots land in Supabase Storage, add a second pass:

```js
// Pseudocode
for (const r of failing) {
  const shotUrl = await uploadToStorage(`/tmp/bug-hunt/${r.name}.png`);
  const analysis = await anthropic.messages.create({
    model: "claude-opus-4-7",
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "url", url: shotUrl } },
        { type: "text", text: `This is ${r.name}. Anomalies: ${JSON.stringify(r.anomalies)}. What's wrong?` },
      ],
    }],
    max_tokens: 400,
  });
  // Append analysis.content[0].text to the GitHub issue.
}
```

---

## When to extend the fixture list

Add to `ROUTES_TO_CHECK` whenever you:

- Ship a new public `/api/*` route.
- Ship a new ops-critical POST that has a clear success/error contract.
- Hit a recurring bug in production that could have been caught by a contract
  check.

Don't add fixtures for:

- Streaming SSE routes (hard to shape-check; use a targeted e2e test instead).
- File-upload routes (need multipart; add a dedicated uploader test).
- One-off migration endpoints.

---

## Troubleshooting

**The cron returns 401.** `CRON_SECRET` header mismatch — check Vercel env.

**Every route returns 401 in results.** `SELF_TEST_USER_ID` is unset or the
magic-link mint failed. Check server logs for `[self-test] Could not mint token`.

**Everything times out.** `NEXT_PUBLIC_SITE_URL` is pointing to localhost from
the Vercel runtime. Set it to the production URL.

**The `/api/health` row is the only failure.** Almost certainly a degraded
integration (returns 503). Visit `/dashboard/system-status` for detail.
