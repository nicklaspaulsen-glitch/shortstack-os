# Telegram Multi-Tenancy Audit

*Date: 2026-04-23*
*Auditor: Claude (Opus 4.7, 1M context)*
*Scope: `src/app/api/webhooks/telegram/`, `src/app/api/telegram/`, `src/lib/telegram/`, `src/lib/services/trinity.ts`, every cron that touches Telegram, the `telegram_routines` / `clients` tables and their RLS.*

---

## Executive summary

**Verdict: FAIL (for multi-tenant SaaS), with isolated CONCERNS on the per-client product bot path.**

The Telegram surface is actually two different systems living in the same codebase, and only one of them attempts tenant isolation:

1. **Admin bot** (Nicklas's "Trinity" bot that runs the ShortStack agency OS from Telegram) — single-tenant by design. It is wired entirely through `process.env.TELEGRAM_BOT_TOKEN` and `process.env.TELEGRAM_CHAT_ID`, with no per-user mapping. Every cron job that pings Telegram pings the one admin chat. If the product is resold as a SaaS, every customer's OS would DM *Nicklas's personal chat* with their data.
2. **Per-client product bot** (`/api/telegram/client-bot`, `/api/telegram/setup-bot`) — designed to give each agency's *client* a personal bot that can query *their own* project status. Has per-client token storage, per-client webhook secret, and scoped queries. Before today's fixes this path had two CRITICAL holes (cross-tenant bot-token overwrite + missing webhook secret issuance) plus the backing DB columns were never deployed. Post-fix it is now usable.

Net effect: today, no agency user other than Nicklas has a Telegram bot. Nothing leaks between "agency users" because no multi-tenant agency-owner bot exists yet. But the admin bot surface would leak wholesale if the stack were ever deployed per-tenant without reworking the env-based config into a DB-backed mapping. The preset / per-user bot feature *must* be designed around this finding, not bolted on top.

---

## Per-checklist verdict

### 1. Token storage

**Verdict: FAIL for admin bot, PARTIAL for per-client bot.**

- Admin bot: `process.env.TELEGRAM_BOT_TOKEN` is read in ~30 files
  (`src/lib/services/trinity.ts:130,152`, every cron under
  `src/app/api/cron/**/route.ts`, `src/app/api/webhooks/telegram/route.ts`,
  etc.). A single token for the entire deployment — not per-user.
- Per-client bot: stored on `clients.telegram_bot_token`
  (migration `supabase/migrations/20260413_new_columns.sql:20-22`, also
  `supabase/migrations/20260423_telegram_client_bot_columns.sql` applied
  during this audit because the 0413 migration was never deployed).
  Looked up strictly by `clients.id` in
  `src/app/api/telegram/client-bot/route.ts:30-34`.

### 2. Token usage in webhooks

**Verdict: PARTIAL.**

- `src/app/api/webhooks/telegram/route.ts` (admin webhook) does validate the
  Telegram `x-telegram-bot-api-secret-token` header against
  `process.env.TELEGRAM_WEBHOOK_SECRET` (lines 8-14). Good as a single-tenant
  anti-forgery check. There is no per-user bot here so no multi-tenant
  dispatch.
- `src/app/api/telegram/webhook/route.ts` is a **duplicate** admin webhook —
  same env-based token, same chat-id gate. Likely legacy. Flagged below.
- `src/app/api/telegram/client-bot/route.ts:42-71` correctly uses a per-row
  stored secret (`telegram_webhook_secret`) and constant-time compares.
  The bot this routes to is selected strictly by `?client_id=` query param,
  so the resolution is deterministic per inbound request. PASS.

### 3. `user_id` / `owner_user_id` scoping on webhook writes

**Verdict: FAIL (admin webhook), PASS (per-client webhook).**

- `src/app/api/webhooks/telegram/route.ts:119` inserts into `trinity_log`
  with no `user_id`. Same at :170, :184. `trinity_log.user_id` is nullable,
  so these rows end up globally un-owned. Ditto for the reminder insert
  at :119 where the `chat_id` goes into the `result` JSON instead of
  linking to a user row.
- `src/app/api/telegram/webhook/route.ts` (legacy duplicate) similarly
  writes nothing scoped.
- **Mitigation already present**: the inbound-message upsert into
  `conversations` at `src/app/api/webhooks/telegram/route.ts:52-60`
  correctly scopes to `process.env.TELEGRAM_OWNER_USER_ID`. But:
  - `TELEGRAM_OWNER_USER_ID` is a *single* env var, so in a multi-tenant
    deploy this is still single-tenant.
  - The fallback path (no `TELEGRAM_OWNER_USER_ID` set) silently skips the
    log instead of failing, which loses data in dev.
- `src/app/api/telegram/client-bot/route.ts` PASSES: every query (`tasks`,
  `invoices`, `content`, `trinity_log`) is `.eq("client_id", clientId)`.

### 4. RLS policies

**Verdict: PASS for `telegram_routines`, CONCERNS for downstream tables.**

Current policies (from `pg_policies`, 2026-04-23):

| Table                   | Policy                              | Scope |
|-------------------------|-------------------------------------|-------|
| `telegram_routines`     | `auth.uid() = user_id`, cmd=ALL     | **PASS** — tenant-safe |
| `conversations`         | `user_id = auth.uid()`, cmd=ALL     | PASS |
| `conversation_messages` | joined via `conversations.user_id`  | PASS |
| `briefings`             | `user_id = auth.uid()`, cmd=ALL     | PASS |
| `trinity_log`           | admin role ALL, self SELECT only    | CONCERNS — writes happen via service role with no `user_id`, and the only non-admin policy is SELECT, so a non-admin user can't see their own Trinity actions |
| `leads`                 | admin/team_member role ALL          | FAIL for SaaS — role-based, not user_id-based |
| `outreach_log`          | admin/team_member role ALL          | FAIL for SaaS — role-based, not user_id-based |
| `clients`               | admin ALL, self SELECT where `profile_id = auth.uid()` | PASS for reads, write path bypasses RLS via service role |

The service role is used in every webhook and cron, which bypasses RLS.
That is the correct pattern — it means every write must carry the correct
`user_id` at the application layer. The admin Telegram webhook does not do
that (see checklist item 3).

### 5. Admin bot separation

**Verdict: FAIL in environment design, PASS in token hygiene.**

- Admin bot is `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (see
  `.env.example:50-53`).
- Per-client bots store their own token on `clients.telegram_bot_token`.
  These do not share state in DB.
- BUT the single admin token is used across every cron + every admin
  webhook. There is no DB row that lists *which* token belongs to the
  admin bot — it is defined purely by "whatever `process.env` resolves
  to at request time." If a new agency user signs up and wants their own
  admin bot, the entire deployment would need separate env vars per user,
  which does not scale.
- Nothing prevents a client's bot from accidentally being pointed at the
  admin webhook URL, but the admin webhook's allowed-chat-id check at
  `src/app/api/webhooks/telegram/route.ts:40-43` would silently ignore
  messages from any chat other than `TELEGRAM_CHAT_ID`.

### 6. Sending outbound

**Verdict: FAIL for admin bot, PASS for per-client bot.**

- `sendTelegramMessage(chatId, text)` in `src/lib/services/trinity.ts:129`
  ALWAYS uses `process.env.TELEGRAM_BOT_TOKEN`. Every cron calls
  this function, meaning every scheduled message goes out through the
  admin bot to whatever `chat_id` is passed (which is always
  `process.env.TELEGRAM_CHAT_ID`).
- `src/app/api/telegram/routines/[id]/run-now/route.ts:36-65` also uses
  the env-based `TELEGRAM_CHAT_ID`, despite looking up the routine by
  user. So a user running their own routine sends to *the admin chat*.
  This is the clearest smoking gun for the "per-user isolation isn't
  real" claim. This is a big fix (needs per-user chat-id column and a
  per-user token column), documented below.
- Per-client bot replies at `src/app/api/telegram/client-bot/route.ts:197`
  use `client.telegram_bot_token` looked up from the row keyed on the
  signed webhook. PASS.

### 7. Webhook secret rotation

**Verdict: PASS for per-client bot (post-fix), N/A for admin bot.**

- Per-client: `telegram_webhook_secret` column is a simple text column.
  Rotating means updating the row and calling `setWebhook` again with the
  new secret. Post-fix, `setup-bot/route.ts` generates a fresh
  32-byte hex secret on every POST and stores it. Re-POST rotates.
- Admin bot: the secret is `TELEGRAM_WEBHOOK_SECRET` env var. Rotation
  requires env var change + redeploy + `setWebhook` call. Not a regression
  in single-tenant mode but cannot be self-serve.

### 8. Preset system (future)

**Verdict: UNKNOWN — not yet implemented. Isolation model prescribed below.**

The Telegram Bot dashboard page (`src/app/dashboard/telegram-bot/page.tsx`)
shows a settings tab that reads `process.env.TELEGRAM_BOT_TOKEN` and
`process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID` (lines 772, 791). As soon as
the preset / per-user bot feature is built, those references must move
to DB columns on `profiles` (or a new `telegram_user_config` table) with
RLS `auth.uid() = user_id`, and every `sendTelegramMessage` callsite must
be migrated to look up `(token, chat_id)` from the DB keyed by the
resolved owner.

---

## CRITICAL findings

### C1. `/api/telegram/setup-bot` allowed any authed user to overwrite any client's bot token (FIXED this audit)

**Before**: `POST /api/telegram/setup-bot` required auth but did not verify
`clients.profile_id === user.id`. Any logged-in agency user could
`POST { client_id, bot_token }` for another agency's client and take over
their bot. Same issue on DELETE.

**Fix applied**: added an ownership check before the update. See
`src/app/api/telegram/setup-bot/route.ts:27-38` (POST) and `:97-108`
(DELETE) — both now `.maybeSingle()` the client row and return 403 if
`profile_id !== user.id`. Effort: ~25 lines.

### C2. `/api/telegram/setup-bot` did not issue a webhook secret (FIXED this audit)

**Before**: the POST handler called Telegram `setWebhook` with only
`{ url }` — no `secret_token`. Meanwhile `/api/telegram/client-bot`
enforces a stored `telegram_webhook_secret` and 503s if missing. Net
effect: every new client bot registered after the client-bot handler was
hardened would register successfully but never be reachable.

**Fix applied**: generate `crypto.randomBytes(32).toString("hex")`, pass
it as `secret_token` to Telegram, store on the client row. See
`src/app/api/telegram/setup-bot/route.ts:56-80`. Effort: ~6 lines.

### C3. `clients.telegram_bot_token`, `telegram_bot_username`, `telegram_chat_id` missing from live DB (FIXED this audit)

**Before**: migration `20260413_new_columns.sql` tried to add these
columns but they were absent from the live schema as of 2026-04-23.
`setup-bot` and `client-bot` both SELECT/UPDATE these columns — every
request would throw a column-does-not-exist error.

**Fix applied**: migration
`supabase/migrations/20260423_telegram_client_bot_columns.sql` applied
via the Supabase MCP. Idempotent — no-op if the columns exist. Effort:
~20 lines SQL.

---

## Big fixes documented but NOT applied

### B1. Admin bot is single-tenant by env vars

To turn the admin bot into per-agency-user, we need:

- A new `telegram_user_bots` table (`user_id uuid PK references profiles`,
  `bot_token text`, `bot_username text`, `chat_id text`,
  `webhook_secret text`, `created_at`, `updated_at`) with RLS
  `auth.uid() = user_id`.
- Per-user webhook URL (e.g. `/api/telegram/owner-bot?user_id=<uuid>`
  or better, resolve user from Telegram `message.from.id` against a
  stored `telegram_user_id` column).
- Replace every `process.env.TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`
  read with a DB lookup keyed by owner.
- Every cron that currently iterates over "the admin" becomes "for each
  user with a configured bot".
- Rotate the `telegram_webhook_secret` per user; allow the dashboard to
  re-register.

Effort: ~4-8 hours (touch every cron + every `sendTelegramMessage`
callsite + new migration + dashboard UI).

### B2. Admin webhook writes to `trinity_log` without `user_id`

`src/app/api/webhooks/telegram/route.ts:119-192` inserts trinity_log rows
with no `user_id`. Easy fix once B1 lands: pass the resolved owner id
into the insert payload. Until then, each insert should at least carry
`user_id: process.env.TELEGRAM_OWNER_USER_ID` to match what the
`upsertInboundMessage` path already does.

Effort: ~30 min (3 insert sites + 1 update site).

### B3. Duplicate admin webhook route

`src/app/api/telegram/webhook/route.ts` and
`src/app/api/webhooks/telegram/route.ts` both exist and both handle admin
bot inbound messages, with overlapping/diverging logic. Pick one (keep
`/api/webhooks/telegram`, it has the conversations integration) and
delete or redirect the other. Effort: ~15 min after confirming
@BotFather's registered webhook URL.

### B4. `/api/telegram/routines/[id]/run-now` sends to env `TELEGRAM_CHAT_ID`

`src/app/api/telegram/routines/[id]/run-now/route.ts:36` — the routine is
per-user but the chat id is global. Symptom: User A's "test" button
messages Nicklas's chat. Fix is part of B1.

### B5. `leads` and `outreach_log` RLS is role-based not user-based

`leads_admin_team` and `outreach_admin_team` policies grant ALL to any
row in `user_roles` with `admin` or `team_member`. No `user_id` column
scoping. Fine for a single-agency OS, FAIL for multi-tenant. Fix is
broader than the Telegram surface and covered in the main multi-tenancy
refactor work.

---

## Isolation model

### Current state (pre-multi-tenant)

```
                     ┌─────────────────────────┐
                     │  process.env            │
                     │    TELEGRAM_BOT_TOKEN   │
                     │    TELEGRAM_CHAT_ID     │
                     │    TELEGRAM_WEBHOOK_    │
                     │    SECRET               │
                     │    TELEGRAM_OWNER_      │
                     │    USER_ID (optional)   │
                     └───────────┬─────────────┘
                                 │
      ┌──────────────────────────┼──────────────────────────┐
      │                          │                          │
      ▼                          ▼                          ▼
┌───────────┐         ┌───────────────────┐     ┌─────────────────────┐
│ admin bot │         │ every cron *.ts   │     │ every webhook that  │
│ (single   │         │ sends through     │     │ needs to notify     │
│ Telegram  │         │ sendTelegram-     │     │ uses the same env   │
│ token)    │         │ Message(chatId)   │     │ token + chat id     │
└─────┬─────┘         └───────────────────┘     └─────────────────────┘
      │
      │ inbound
      ▼
┌──────────────────────────────────┐
│ /api/webhooks/telegram/route.ts  │──► trinity_log (no user_id)
│  • validates env webhook secret  │──► conversations (scoped to
│  • gates by TELEGRAM_CHAT_ID     │       TELEGRAM_OWNER_USER_ID)
│  • service role → writes global  │──► sendTelegramMessage() back
└──────────────────────────────────┘

                    ===========================

                     ┌─────────────────────────┐
                     │      clients table      │
                     │  per-row:               │
                     │    telegram_bot_token   │
                     │    telegram_chat_id     │
                     │    telegram_webhook_    │
                     │    secret               │
                     │  RLS clients_own keyed  │
                     │  on profile_id          │
                     └───────────┬─────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────┐
│ /api/telegram/client-bot?client_id=<uuid>     │
│  • look up row by client_id                   │
│  • constant-time compare secret_token header  │
│    against row.telegram_webhook_secret        │
│  • queries scoped .eq("client_id", clientId)  │
│  • reply via row.telegram_bot_token           │
└───────────────────────────────────────────────┘
```

### Target state (to enable preset / per-user bot)

```
                     ┌─────────────────────────────┐
                     │    telegram_user_bots       │
                     │  per-row:                   │
                     │    user_id (PK, FK profiles)│
                     │    bot_token                │
                     │    bot_username             │
                     │    chat_id                  │
                     │    webhook_secret           │
                     │    telegram_user_id (to     │
                     │      resolve from.from.id)  │
                     │  RLS auth.uid() = user_id   │
                     └───────────┬─────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────┐
│ /api/webhooks/telegram?user_id=<uuid>   OR               │
│ /api/webhooks/telegram   (resolve by from.id lookup)     │
│   • per-user webhook secret check                         │
│   • resolve ownerUserId = row.user_id                     │
│   • every write: { user_id: ownerUserId, ... }            │
│   • trinity_log insert: { user_id: ownerUserId, ... }     │
│   • outbound: sendTelegramMessage(row.bot_token,          │
│                                    row.chat_id, text)     │
└───────────────────────────────────────────────────────────┘

Every cron that currently uses env becomes:

  for each row in telegram_user_bots:
      build briefing scoped to row.user_id
      sendTelegramMessage(row.bot_token, row.chat_id, briefing)
```

The per-client bot path does not change — it is already correctly
isolated. The admin bot path gets reparented to per-user.

---

## What to verify going forward

Before merging any Telegram feature, run through this checklist:

- [ ] **Token source**: the outbound call reads the bot token from a
      row in a DB table keyed by the resolved owner, not from
      `process.env.TELEGRAM_BOT_TOKEN`.
- [ ] **Chat id source**: same — not `process.env.TELEGRAM_CHAT_ID`.
- [ ] **Webhook secret**: inbound webhook constant-time compares the
      `x-telegram-bot-api-secret-token` header against a per-row stored
      secret. No shared secret.
- [ ] **Owner resolution**: inbound webhook resolves the owner by either
      (a) a URL query param verified against the row's webhook secret,
      or (b) `message.from.id` looked up in a mapping table. Never by
      env var.
- [ ] **Writes carry `user_id`**: every `.insert()` into
      `trinity_log`, `conversations`, `conversation_messages`,
      `briefings`, `leads`, etc. includes the resolved `user_id`.
      Add this to the PR checklist.
- [ ] **RLS policies**: any new table added for Telegram must have
      `row level security` enabled with a policy like
      `using (auth.uid() = user_id)`. Template:
      ```sql
      alter table telegram_<thing> enable row level security;
      create policy "users manage own <thing>"
        on telegram_<thing> for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
      ```
- [ ] **Rotation**: there is a way to regenerate the webhook secret
      (and, ideally, the bot token itself) from the dashboard without
      touching env vars or redeploying.
- [ ] **Ownership on mutations**: any API route that updates per-user
      or per-client Telegram config verifies `profile_id == auth.uid()`
      BEFORE the update. Never trust `client_id` or `user_id` from the
      request body alone.
- [ ] **No cross-bot env var reads**: run
      `rg "process\\.env\\.TELEGRAM" src/` — the only results should
      be in the per-user-bot resolution helper, not scattered across
      individual cron/webhook handlers.

---

## Files audited

- `src/app/api/webhooks/telegram/route.ts` (admin webhook + Trinity handler)
- `src/app/api/telegram/webhook/route.ts` (duplicate admin webhook — flagged)
- `src/app/api/telegram/setup/route.ts` (admin webhook registration)
- `src/app/api/telegram/setup-bot/route.ts` (per-client webhook registration — **fixed**)
- `src/app/api/telegram/client-bot/route.ts` (per-client inbound handler)
- `src/app/api/telegram/routines/route.ts`
- `src/app/api/telegram/routines/[id]/route.ts`
- `src/app/api/telegram/routines/[id]/run-now/route.ts`
- `src/lib/services/trinity.ts` (`sendTelegramMessage`, `deleteTelegramMessage`)
- `src/lib/telegram/should-send-routine.ts`
- `src/lib/conversations.ts` (`upsertInboundMessage`, `resolveUserIdForChannel`)
- `src/app/api/cron/daily-brief/route.ts` (representative cron, pattern shared with ~20 others)
- `src/app/dashboard/telegram-bot/page.tsx` (dashboard UI)
- `supabase/migrations/20260413_new_columns.sql`
- `supabase/migrations/20260418_telegram_routines.sql`
- `supabase/migrations/20260423_telegram_client_bot_columns.sql` (new, applied this audit)
- `pg_policies` for `telegram_routines`, `conversations`, `conversation_messages`, `trinity_log`, `leads`, `outreach_log`, `briefings`, `clients`
