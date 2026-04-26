# Multi-Tenant Webhook Secrets

**Status:** Design-only (sec/batch-4 deferred item #3)
**Author:** Security audit batch 4

---

## Current State

Every inbound webhook provider uses a single shared secret stored as a Vercel
environment variable:

| Provider    | Env var                         | Route                                  |
|-------------|---------------------------------|----------------------------------------|
| Stripe      | `STRIPE_BILLING_WEBHOOK_SECRET` | `/api/billing/webhook`                 |
| Stripe Conn | `STRIPE_CONNECT_WEBHOOK_SECRET` | `/api/webhooks/stripe-connect`         |
| ElevenLabs  | `ELEVENLABS_WEBHOOK_SECRET`     | `/api/webhooks/elevenlabs`             |
| Resend      | `RESEND_WEBHOOK_SECRET`         | `/api/webhooks/resend`                 |
| Telegram    | `TELEGRAM_WEBHOOK_SECRET`       | `/api/telegram/webhook`                |
| Twilio SMS  | `TWILIO_AUTH_TOKEN`             | `/api/twilio/sms-webhook`              |
| Twilio Voice| `TWILIO_AUTH_TOKEN`             | `/api/twilio/voice-webhook`            |

**Risk:** If a single tenant's integration is compromised and an attacker
obtains a shared secret, they can forge webhook events for every tenant on the
platform. Revoking the secret requires a Vercel env-var rotation that affects
every tenant simultaneously.

Note: Stripe's shared-secret model is somewhat less critical because Stripe
itself generates the secret per-endpoint (not per-tenant) and Connect events
already carry `event.account` for tenant isolation. The highest-value targets
for per-tenant rotation are ElevenLabs (call outcomes) and Resend (email events
that can trigger workflow automations).

---

## Target State

Each tenant has their own webhook secret for the providers they use. Secrets are
stored in the `clients` table (or a dedicated `webhook_secrets` table) rather
than in Vercel env vars. The webhook route looks up the correct secret per
incoming request before verifying the signature.

### Schema option A — column on `clients`

```sql
alter table public.clients
  add column if not exists elevenlabs_webhook_secret text,
  add column if not exists resend_webhook_secret      text;
```

Pros: minimal schema change, co-located with other client config.
Cons: broadens the `clients` table; secrets visible to any code that selects `*`.

### Schema option B — dedicated `webhook_secrets` table (recommended)

```sql
create table public.webhook_secrets (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete cascade,
  provider    text not null,              -- 'elevenlabs' | 'resend' | 'twilio' | ...
  secret      text not null,             -- raw secret, encrypted at rest by Supabase
  created_at  timestamptz default now(),
  rotated_at  timestamptz,
  unique (profile_id, provider)
);
-- RLS: profiles can read/write their own rows; service role bypasses.
alter table public.webhook_secrets enable row level security;
create policy webhook_secrets_own on public.webhook_secrets
  for all using (auth.uid() = profile_id);
```

Pros: separation of concerns; easy to rotate individual secrets; can add
`rotated_at` audit trail; doesn't pollute `clients`.
Cons: extra join on every webhook request.

### Lookup pattern in webhook routes

```typescript
// Instead of:
const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;

// Look up per-tenant:
// 1. Parse enough of the payload to identify the tenant (e.g. account_id
//    present in the POST body or a query-string hint registered at setup time).
// 2. Query webhook_secrets for that tenant + provider.
// 3. Verify signature against the tenant secret.
// 4. Fall back to the platform-level env var for backwards compat during
//    the migration window.

async function getTenantSecret(
  supabase: SupabaseClient,
  profileId: string,
  provider: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("webhook_secrets")
    .select("secret")
    .eq("profile_id", profileId)
    .eq("provider", provider)
    .maybeSingle();
  return data?.secret ?? null;
}
```

---

## Migration Sequence

### Phase 1 — Schema (no behavioral change)

1. Create the `webhook_secrets` table via migration.
2. Add a "Rotate webhook secret" button to the settings UI for each integration.
3. When a tenant clicks Rotate: generate a new HMAC secret server-side, store
   it in `webhook_secrets`, return it once to the user to copy into the provider
   dashboard.

### Phase 2 — Dual-mode validation (safe rollout)

Update each webhook route to:
1. Attempt to resolve the tenant from request context (query param, payload field,
   or header set by the provider).
2. If a tenant-specific secret exists in `webhook_secrets`, verify against that.
3. Otherwise fall back to the platform env var.

This allows gradual migration: tenants who have rotated to per-tenant secrets
use their own; others continue using the platform secret.

### Phase 3 — Enforce per-tenant

Once all tenants have rotated:
1. Remove the platform-level env var fallback from each route.
2. Return 503 if no tenant secret is found (same fail-closed pattern as the
   batch-4 fix applied to Stripe routes).
3. Archive the old platform env vars from Vercel (keep in 1Password for 90 days).

---

## Open Questions

1. **Tenant identification before signature check** — For ElevenLabs the
   `conversation_id` is in the payload, but we need to query the tenant from
   `voice_calls` which requires knowing the secret first (chicken-and-egg).
   Options: (a) pass `?profile_id=` as a query param in the webhook registration
   URL, (b) parse the raw payload before verifying to get an identifying field,
   (c) keep ElevenLabs on the platform secret and only do per-tenant for Resend.

2. **Secret generation** — Use `crypto.randomBytes(32).toString('hex')` (256-bit
   HMAC key). Ensure it is never logged or returned in API responses beyond the
   initial registration.

3. **UI surface** — Settings > Integrations > [Provider] > "Webhook Secret"
   section with a one-time-reveal copy button and a Rotate action.

4. **Audit trail** — Log secret rotations to `trinity_log` with `action_type =
   'webhook_secret_rotated'` (no secret value in the log).
