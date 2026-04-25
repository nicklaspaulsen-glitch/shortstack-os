# ShortStack OS — Security Patterns

> Reference doc for the auth-gate categories, signed-state OAuth pattern,
> and lazy SDK init pattern used across the codebase. Captures lessons
> from the Apr 27 round-9 bug hunt that closed 5 CRITICAL OAuth IDORs and
> the f29606e auto-configure IDOR.
>
> Read this BEFORE adding a new API route, OAuth provider, or webhook.

## Auth-gate categories — every route falls into one

When you write a new `src/app/api/**/route.ts`, identify which category
it falls into and apply the matching gate.

| Category | Gate pattern | Example |
|---|---|---|
| **User-scoped** (read/write per-user data) | `createServerSupabase()` + RLS | `/api/clients/[id]/files` |
| **User-scoped (service client)** | `createServiceClient()` + manual `auth.uid()` ownership check | `/api/admin/*` |
| **Webhook** | Signature validation (HMAC, Svix, or Bearer token), fail-closed in prod | `/api/webhooks/elevenlabs` |
| **Cron** | `Authorization: Bearer ${CRON_SECRET}` (server-side env, NOT NEXT_PUBLIC) | `/api/cron/daily-brief` |
| **Public** | Rate-limit + bounded payload + record-existence check on any FK | `/api/funnels/analytics` |

The agent that audits this is at `.claude/agents/api-auth-gate-auditor.md`
— invoke it after adding routes.

## User-scoped routes

### Default: RLS via `createServerSupabase()`

Server component or route handler:

```ts
const supabase = createServerSupabase();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// RLS enforces ownership — no manual check needed.
const { data } = await supabase.from("foo").select().eq("id", id).single();
```

### When you need the service client

Use the service client only when:
- Iterating across all users (e.g. cron broadcasts)
- Writing to system tables (e.g. `trinity_log`)
- Bypassing RLS for an audited reason (e.g. webhook upserts cross-tenant)

Always pair with a **manual ownership check** before mutating per-user data:

```ts
const service = createServiceClient();
const supabase = createServerSupabase();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Manual ownership check — service client doesn't enforce RLS.
const { data: foo } = await service.from("foo").select("profile_id").eq("id", id).single();
if (!foo || foo.profile_id !== user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### IDOR red flags

- Reading `user_id` / `client_id` / `lead_id` / `profile_id` from request body without verifying caller owns it
- `createServiceClient()` with no auth gate at all
- `.eq("id", id)` without an additional `.eq("profile_id", user.id)` filter
- Trusting query-string identifiers in webhook callbacks (the OAuth IDOR class)

The router-friendly fix uses helpers from `src/lib/security/require-owned-client.ts`:
- `getEffectiveOwnerId(supabase, userId)` — resolves team_member to parent agency
- `requireOwnedClient(supabase, userId, clientId)` — does the lookup + check

## Webhook routes

Every `/api/webhooks/*` route MUST validate signatures in production. The
`fail-closed-in-prod / fail-open-in-dev` pattern is intentional — devs
running locally without all secrets shouldn't be blocked, but Vercel
production must reject unsigned requests.

### HMAC pattern (ElevenLabs, custom)

```ts
const secret = process.env.X_WEBHOOK_SECRET;
if (!secret) {
  console.error("[webhooks/x] X_WEBHOOK_SECRET not set — rejecting");
  return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
}

const rawBody = await request.text();
const sig = request.headers.get("x-signature") || "";
const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

const providedBuf = Buffer.from(sig, "hex");
const expectedBuf = Buffer.from(expected, "hex");
if (
  providedBuf.length !== expectedBuf.length ||
  !crypto.timingSafeEqual(providedBuf, expectedBuf)
) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

### Svix pattern (Resend)

See `/api/webhooks/resend/route.ts`. Use `Webhook.verify()` from `svix`.

### Bearer token pattern (Resend inbound, GHL legacy)

See `/api/webhooks/resend/inbound/route.ts`. Use the existing
`WEBHOOK_SECRET` env var, accept either `Authorization: Bearer <token>`
or `?key=<token>` query param.

### Twilio HMAC-SHA1

See `src/lib/services/voice-calls.ts → validateTwilioSignature()`.
URL + sorted POST params hashed with the auth token.

## Cron routes

```ts
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... cron logic
}
```

**NEVER**:
- Read `process.env.NEXT_PUBLIC_CRON_SECRET` (browser-exposed, banned per the Apr 19 rotation bug)
- Add new entries to `vercel.json` without confirming the handler exists at the matching path (phantom crons fire silently in prod)

The agent that audits this is at `.claude/agents/cron-handler-validator.md`.

## Public endpoints

Narrow set of routes that intentionally accept anonymous POSTs:
- `/api/health`
- `/api/og/*` (image generators)
- Webhook routes (covered separately)
- Lead-magnet form submissions (`/api/funnels/analytics`, `/api/surveys/submit`)
- Payment provider webhooks (signed)

For each public POST, apply ALL of these:

1. **Rate limit** — IP-based sliding window (see `funnels/analytics` for
   the in-memory pattern). 20-30 req/min/IP is typical.
2. **Bounded payload** — cap any user-controlled JSON metadata at 4KB
   (return 413 if larger). Cap string IDs at 128 chars.
3. **Record-existence check** — verify any FK in the payload (funnel_id,
   client_id) actually points at a real, published record. Reject 404
   otherwise. This stops attackers from flooding the table with rows
   for arbitrary or victim UUIDs.
4. **Validation** — strict allowlist on enum-like fields (e.g.
   `event_type ∈ {view, click, submit, purchase}`).

## OAuth — signed state pattern

> The Apr 27 round-9 finding: every OAuth start route except `/api/oauth/meta`
> accepted `client_id` from the query string with no auth and encoded it as
> plain JSON in the `state` parameter. The callback JSON.parse'd it and
> saved tokens against `state.client_id`. Anyone who knew a victim's UUID
> could craft a Google/LinkedIn/TikTok/Discord install URL, complete with
> their own provider account, and the resulting access_token rows landed
> at the victim's tenant.

### The pattern (use `lib/oauth-state.ts`)

**Start route** (`/api/oauth/<provider>/route.ts`):

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import { signOAuthState, canUserWriteForClient } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  // 1. Require auth
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 2. Verify caller can write for the target client_id
  const allowed = await canUserWriteForClient(supabase, user.id, clientId);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // 3. Sign state (HMAC-SHA256, 10-min TTL, embedded uid)
  const state = signOAuthState({ client_id: clientId, platform: "<x>", uid: user.id });

  return NextResponse.redirect(`https://provider.example.com/oauth?...&state=${encodeURIComponent(state)}`);
}
```

**Callback route** (`/api/oauth/<provider>/callback/route.ts`):

```ts
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyOAuthState } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const stateStr = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirectBack("denied");

  // 1. Verify signature + TTL — rejects forged / replayed state
  const verified = verifyOAuthState(stateStr);
  if (!verified) return redirectBack("invalid_state");

  // 2. Re-check session matches the user that initiated the flow
  // (not always required for cross-device flows like Discord — see below)
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== verified.uid) return redirectBack("auth_mismatch");

  // 3. NOW it's safe to use verified.client_id and verified.platform
  // ... token exchange + DB write
}
```

### When to skip the session-match check

The Discord callbacks (`/api/integrations/discord/callback`,
`/api/discord/bot-added`) **don't** enforce `user.id === verified.uid`
because Discord installs are often cross-device — user clicks "Add to
server" on phone, completes on desktop. The HMAC-signed state alone is
sufficient because attacker can't forge it without `OAUTH_STATE_SECRET`.

The Meta/Google/LinkedIn/TikTok callbacks **do** enforce session match
because the entire flow happens in one browser session.

## Module-level SDK init — BANNED

> Lesson from the Stripe v18 build break (commit `971352c`): module-level
> `new Stripe(process.env.X || "")` throws on Stripe v18+ because the
> SDK rejects empty-string apiKey at construction time. This crashed
> Vercel's page-data-collection during build. Same class of bug for any
> SDK that validates input at construction.

### Pattern: lazy singleton getter

```ts
// src/lib/stripe/client.ts
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2024-09-30.acacia" });
  }
  return _stripe;
}
```

Routes call `getStripe()` inside their handler (or at first use), not
at module top.

### Same pattern for Anthropic, Resend, ElevenLabs

- Anthropic: `import { anthropic } from "@/lib/ai/claude-helpers"`
- Stripe: `getStripe()` from `@/lib/stripe/client`
- Resend / SendGrid: lazy getters in `src/lib/email/*`

### Supabase browser client — special case

The `@supabase/ssr` SDK throws on undefined env vars. During SSG
prerender of "use client" dashboard pages, env vars from
`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` may not be set on Preview
deploys. The fix in `src/lib/supabase/client.ts` (commit `d4d1d57`)
returns an ephemeral non-cached placeholder client during SSG when env
vars are missing — real client constructed at runtime in the browser.

## Common attack scenarios to watch for

### IDOR via body-supplied identifier

```ts
// BAD — accepts user_id from request body
const { user_id, content } = await request.json();
await supabase.from("posts").insert({ user_id, content });
```

```ts
// GOOD — derives user_id from session
const supabase = createServerSupabase();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return 401;
const { content } = await request.json();
await supabase.from("posts").insert({ user_id: user.id, content });
```

### State-confusion CSRF in OAuth callbacks

Already covered in detail above. Use `signOAuthState` / `verifyOAuthState`.

### XML/SQL injection via dynamic interpolation

`/api/twilio/voice-webhook` interpolates `client.businessName` and
`From` / `To` into TwiML. We `xmlEscape()` everything before interpolation.
Same pattern for any HTML/XML/SQL — escape at the boundary.

### Webhook replay attacks

ElevenLabs HMAC includes a timestamp; we reject signatures older than
5 minutes. Stripe / Svix do the same automatically. For custom HMAC,
add timestamp validation:

```ts
const ts = Number(parts.t);
if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > 300) {
  return NextResponse.json({ error: "Timestamp out of window" }, { status: 401 });
}
```

## Audit cadence

- **Per-PR**: GitHub Action `claude-code-security-review` runs on every PR
  (config in `.github/workflows/security-review.yml`). Comments findings
  directly on the PR.
- **Manual deep audit**: invoke `@api-auth-gate-auditor` agent. Spot-checks
  every route in `src/app/api/**`. Run after large API additions.
- **Cron audit**: invoke `@cron-handler-validator`. Run after any
  `vercel.json` cron change.
- **RLS check on a new table**: invoke `/rls-check <table>` slash command.
- **Sidebar / route consistency**: invoke `@sidebar-route-sync` after
  adding or removing dashboard pages.

## Required env vars (security-relevant)

| Var | Purpose | Fail-closed in prod? |
|---|---|---|
| `OAUTH_STATE_SECRET` | HMAC for OAuth state (lib/oauth-state.ts) | Yes |
| `CRON_SECRET` | Bearer auth for /api/cron/* | Yes |
| `WEBHOOK_SECRET` | Generic inbound webhook auth | Yes |
| `RESEND_WEBHOOK_SECRET` | Svix verification for Resend | Yes |
| `ELEVENLABS_WEBHOOK_SECRET` | HMAC for ElevenLabs ConvAI | Yes |
| `TWILIO_AUTH_TOKEN` | HMAC-SHA1 for Twilio | Yes (warn-only in dev) |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS bypass for service client | N/A (server-only) |

NEXT_PUBLIC_ env vars are exposed to the browser. **Never** put a secret
in a NEXT_PUBLIC_ var. The `NEXT_PUBLIC_CRON_SECRET` bug fixed Apr 19 was
caused by exactly this mistake.

## Related files

- `src/lib/oauth-state.ts` — sign/verify OAuth state
- `src/lib/security/require-owned-client.ts` — ownership helpers
- `src/lib/services/voice-calls.ts` — Twilio HMAC-SHA1 + helpers
- `src/lib/stripe/client.ts` — lazy Stripe singleton (template for SDK init)
- `.github/workflows/security-review.yml` — CI security review
- `.claude/agents/api-auth-gate-auditor.md` — auth gate auditor
- `.claude/agents/cron-handler-validator.md` — cron auditor
- `.claude/commands/rls-check.md` — `/rls-check` slash command
