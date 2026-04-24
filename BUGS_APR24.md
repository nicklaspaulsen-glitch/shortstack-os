# ShortStack OS — Bug Hunt Report (Apr 24, 2026)

**Branch:** `chore/bug-hunt-apr24`
**Mode:** Read-only audit. No code changed.
**Scope:** dashboard pages, API routes, TS compile, assets, deps, env, RLS.

## Summary

| Priority | Count | Description |
|---|---|---|
| P0 CRITICAL | 2 | Auth bypass / account-takeover |
| P1 Broken | 7 | Missing signature verification, no rate limits, unsigned inbound |
| P2 Missing error handling | 6 | Injection risks, missing try/catch, fragile parsing |
| P3 Code hygiene | 38 | TODOs, mock state, dead stubs, empty onClicks |
| P4 TS errors | 0 | `tsc --noEmit` is clean |
| Dependencies | 3 | 1 high (next), 1 high (basic-ftp), 1 moderate (postcss) |
| RLS gaps | 1 | `white_label_config` table without `ENABLE ROW LEVEL SECURITY` |

Sample sizes: 141 dashboard pages scanned, 250+ API routes scanned, 60 routes deep-read.

---

## P0 — CRITICAL (fix first)

### P0-1: `agent-restart` route has NO auth
**File:** `src/app/api/admin/agent-restart/route.ts:10-20`
Any unauthenticated user can `POST` and get `{ restarted: true }`. No session check, no `CRON_SECRET` bearer, no `service_role` gate. Even though the body does nothing today, the route advertises itself as `admin` and will likely be wired to a real deploy hook — that will ship an RCE-adjacent endpoint. Add `requireRole(["admin","founder"])` or `CRON_SECRET` now, before someone wires it.

### P0-2: Meta OAuth callback trusts `state.client_id` with no ownership check
**File:** `src/app/api/oauth/meta/callback/route.ts:16-17, 89-124`
`state` is parsed from the query string as raw JSON `{client_id, platform}` and then used directly to INSERT/UPDATE rows in `social_accounts` keyed by that `client_id`. There is:
1. **No CSRF nonce** — an attacker can craft a Meta OAuth URL with `state={"client_id":"VICTIM_UUID"}` and trick a victim into clicking it; the victim's Meta tokens get saved to the attacker's client record (or vice-versa).
2. **No ownership check** — the callback never verifies the currently-authenticated Supabase user owns `state.client_id`.
Fix: store state nonce in `oauth_states` table tied to the session, look up `client_id` from the stored row, not the query string.

---

## P1 — Broken

### P1-1: Webhook dev-fallback accepts all requests when secret unset
**Pattern:** `if (!secret) return true; // dev — accept`
- `src/app/api/webhooks/slack/route.ts:33-35`
- `src/app/api/webhooks/discord/route.ts:42-44`
- `src/app/api/webhooks/zernio/route.ts:28-30`
- `src/app/api/webhooks/elevenlabs/route.ts:22-25`

If the respective `_SIGNING_SECRET` env var is ever missing in production, the routes silently accept every payload as valid. Change to **fail-closed**: `if (!secret) return false;` and log a loud error. Compare to billing/stripe-connect which fail closed correctly.

### P1-2: Telegram webhook signature check is bypassed entirely when secret unset
**File:** `src/app/api/webhooks/telegram/route.ts` (around the `if (webhookSecret) { ... }` block in the handler)
The header check is only performed inside a truthy `if` — if `TELEGRAM_WEBHOOK_SECRET` is unset, the check is skipped entirely. Inverted logic: make the handler 400 when the secret is missing.

### P1-3: Resend inbound webhook is completely unsigned
**File:** `src/app/api/webhooks/resend/inbound/route.ts`
No HMAC header, no shared-secret check. Anyone who can reach the URL can POST fake inbound emails and corrupt the `conversations` / `messages` tables. Add Svix signature verification (Resend ships Svix headers for inbound).

### P1-4: Public `/api/forms/submit` has no rate limit / CAPTCHA
**File:** `src/app/api/forms/submit/route.ts`
Writes to `leads`, fires workflow triggers, pings Telegram. Trivially abused for DB bloat + Telegram spam to the founder's chat. Needs Upstash ratelimit (1/sec per IP) + honeypot or hCaptcha.

### P1-5: Password reset has no rate limit (email enum + spam)
**File:** `src/app/api/auth/reset-password/route.ts`
No IP/email throttle. Allows email enumeration (different response shape for existing vs non-existing emails) and lets an attacker SMTP-spam any address in the user table. Needs 3/hour per email, 10/hour per IP.

### P1-6: Twilio voice webhooks don't verify X-Twilio-Signature
**File:** `src/app/api/twilio/voice-webhook/route.ts`
No `twilio.validateRequest(authToken, signature, url, params)` call. Anyone can POST fake TwiML triggers, spoof incoming calls, and drain Twilio balance via voice IVR replay. Same for `voice-actions/route.ts`.

### P1-7: `activity-log` page is permanently empty
**File:** `src/app/dashboard/activity-log/page.tsx:41-43`
`const INITIAL_LOGS = [];` with `// TODO: Load from /api/activity-log once endpoint is wired`. Menu item is live, page renders empty. Either hide the nav link or wire the route.

---

## P2 — Missing error handling / input validation

### P2-1: Twilio TwiML XML injection via `businessName`
**File:** `src/app/api/twilio/voice-webhook/route.ts:~112`
`client.businessName` is string-interpolated directly into the returned `<Say>` tag. Any `<`, `>`, `&`, `"`, `'` in a client's business name breaks the TwiML or injects attributes. Escape with a helper (`text.replace(/[<>&"']/g, ...)`) before embedding.

### P2-2: Meta callback swallows JSON parse error silently
**File:** `src/app/api/oauth/meta/callback/route.ts:17`
`try { state = JSON.parse(stateStr || "{}"); } catch {}` — leaves `state.client_id = ""`, flow proceeds and no-ops. Should redirect with `?error=bad_state`.

### P2-3: OAuth callbacks use `console.error` instead of error table
**Files:** `src/app/api/oauth/meta/callback/route.ts:69,82,86` and others
Auth failures end up only in Vercel logs. No `error_logs` table entry for SLA/alert. Low priority but makes debugging prod OAuth very hard.

### P2-4: `fetch()` without timeout in webhooks / workflow triggers
**Pattern:** multiple webhook routes `await fetch(url)` with no `AbortSignal.timeout(5000)`.
- `src/app/api/forms/submit/route.ts` (workflow trigger chain)
- `src/app/api/oauth/meta/callback/route.ts:25,35,42,46,58,75,79`
If Meta's API hangs, the entire route hangs → Vercel 10s timeout → 504. Wrap external calls with 5s AbortSignal.

### P2-5: Public form submit doesn't validate UTF-8 / field lengths
**File:** `src/app/api/forms/submit/route.ts`
Body fields go straight into Supabase. No zod schema, no max length. A 10MB string in `message` will balloon the DB.

### P2-6: `@supabase/supabase-js` service client instantiated per request (no reuse)
Multiple routes call `createServiceClient()` on every request, which instantiates a new client. Acceptable but wasteful for hot endpoints like `/api/forms/submit`.

---

## P3 — Code hygiene / dead code / TODOs

Below is a partial list; full TODO grep returned ~60 matches.

### Dashboard pages with mock/empty state instead of real data
- `src/app/dashboard/activity-log/page.tsx:41-43` — `INITIAL_LOGS = []`
- `src/app/dashboard/api-docs/page.tsx:70-71` — `INITIAL_API_KEYS = []`
- `src/app/dashboard/settings/page.tsx:158` — hardcoded `sessions` mock
- `src/app/dashboard/brand-kit/page.tsx` — mock kits + TODO to load from `/api/brand-kits`
- `src/app/dashboard/design/page.tsx` — TODO to load projects from `/api/design`

### Thumbnail generator — many AI TODOs, UI without backend
**File:** `src/app/dashboard/thumbnail-generator/page.tsx`
- Lines 2283, 2289, 2452, 2505, 2518, 2538, 2550, 2617, 2627, 2647, 2699, 2844, 6572, 6724, 7189, 7241, 7731 — "TODO: wire to AI endpoint"
- Multiple empty `onClick={() => {}}` handlers on feature buttons

### Empty onClick / `console.log`-only handlers across dashboard
- `src/app/dashboard/workflows/page.tsx` — a handful of buttons with `console.log("TODO")`
- `src/app/dashboard/campaigns/page.tsx` — export button `onClick` is stub
- `src/app/dashboard/funnels/page.tsx` — "Publish" button empty

### Dead / stub API routes (scaffolded but unreachable or TODO)
- `src/app/api/admin/agent-restart/route.ts` — TODO stub (see P0-1)
- Routes under `src/app/api/stubs/*` and some scaffolds from the apr-24 "stubs→pages" commit `e8ae175`

### Misc
- `src/app/api/oauth/meta/callback/route.ts:16` — default `platform: "facebook"` used in state; platform is never read anywhere
- Several routes still import `NextRequest` but use no request-specific features → could use `Request`.

---

## P4 — TypeScript errors

```
$ npx tsc --noEmit
(0 errors)
```

The project compiles cleanly. No type regressions introduced by the apr-24 sprints.

---

## Dependencies — `npm audit --production`

Top by severity:

| Package | Severity | CVEs | Fix |
|---|---|---|---|
| `next` (direct) | **high** | DoS, HTTP smuggling, deserialization (multiple) | upgrade to `>=15.5.10` |
| `basic-ftp` (transitive) | **high** | CRLF injection, DoS (CVSS 8.2/8.6/7.5) | check which dep pulls it (likely `@napi-rs/canvas` or similar) |
| `postcss` (via `next`) | moderate | XSS | pinned via next; resolves with next upgrade |

Run `npm audit fix` for the transitive ones; `next` requires a major bump.

---

## Environment variables — referenced but not in `.env.example`

Grep found 39 `process.env.XXX` references without matching keys in `.env.example`. Highlights (non-exhaustive):

- `CRON_SECRET` — used by multiple cron/bearer routes (documented in MEMORY as "to rotate"; add to `.env.example`)
- `META_APP_ID`, `META_APP_SECRET` — Meta OAuth
- `TELEGRAM_WEBHOOK_SECRET`
- `SLACK_SIGNING_SECRET`
- `DISCORD_SIGNING_SECRET`
- `ELEVENLABS_WEBHOOK_SECRET`
- `ZERNIO_WEBHOOK_SECRET`
- `RUNPOD_API_KEY`
- `STRIPE_CONNECT_CLIENT_ID`
- `SMTP_PASS` (flagged in MEMORY as urgent rotate)
- `NEXT_PUBLIC_APP_URL` — used as OAuth redirect base; undocumented
- `RESEND_WEBHOOK_SECRET` — referenced but webhook doesn't actually check it (see P1-3)

Full list available in the raw grep; recommend adding all to `.env.example` with empty values and comments.

---

## Public assets / broken images

Random sample of `<img>` / `Image` references vs `public/` tree: no 404s detected in the 20+ references spot-checked. Asset naming is consistent (`/logo.svg`, `/integrations/meta.svg`, etc.). No issues found.

---

## Supabase RLS gaps

`supabase/migrations/*.sql` — every `CREATE TABLE` was diffed against subsequent `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements.

**One gap found:**
- `white_label_config` — `supabase/migrations/20260415_feature_tables.sql:153` creates the table but no RLS enable statement follows. Any `anon`/`authenticated` client with the row's PK can read/write it, including `primary_color`, `logo_url`, and any JSONB policy overrides.

All other tables have RLS enabled.

---

## Notes for follow-up

1. **Start with P0-1 and P0-2** — both are small patches with big risk reduction.
2. **P1-1 through P1-3** can be resolved with one shared helper `verifyOrFail(secret, sig, body)` that fails closed.
3. **Next.js upgrade** — coordinate with Vercel `next` deps; check `next/font` / `next/image` breaking changes.
4. **White-label RLS** — two-line migration, ship same PR.

End of report.
