# Cron Tenant Scoping Design

**Status:** Design-only (sec/batch-4 deferred item #4)
**Author:** Security audit batch 4

---

## Problem

Two cron routes aggregate data cross-tenant without a per-tenant loop, meaning
the brief sent to the agency owner shows global platform totals rather than
data scoped to that owner's clients and leads.

The third cron (`daily-briefing`) already implements the correct pattern:
it iterates `profiles WHERE role='admin' AND is_active=true` and calls
`generateDailyBriefing(service, profile.id)` once per tenant.

---

## Affected Files

| Route | File | Issue |
|-------|------|-------|
| `/api/cron/daily-brief` | `src/app/api/cron/daily-brief/route.ts` | Queries `outreach_log`, `leads`, `content_calendar` without a `user_id` filter. Sends one Telegram message to the shared `TELEGRAM_CHAT_ID`. |
| `/api/cron/weekly-digest` | `src/app/api/cron/weekly-digest/route.ts` | Queries `leads`, `outreach_log`, `deals`, `clients`, `invoices`, `trinity_log` without tenant scope. Sends one Telegram message to the shared `TELEGRAM_CHAT_ID`. |

Both routes also reference the existing `daily-briefing` counterpart:

| Route | File | Status |
|-------|------|--------|
| `/api/cron/daily-briefing` | `src/app/api/cron/daily-briefing/route.ts` | Already per-tenant. Reference implementation. |

---

## Current Behavior

`daily-brief` (the Telegram-focused one):
```
1. Query outreach_log WHERE platform IN (...) AND sent_at >= yesterday
   → no user_id filter → platform-wide totals
2. Send one Telegram message to TELEGRAM_CHAT_ID
   → goes to the single global Telegram chat
```

`weekly-digest`:
```
1. Parallel queries on leads, outreach_log, deals, clients, invoices, trinity_log
   → no user_id filter → platform-wide totals
2. Send one Telegram message to TELEGRAM_CHAT_ID
```

This is a single-tenant legacy pattern that worked when ShortStack had one
agency owner. In multi-tenant mode it leaks aggregate data across tenants (the
Telegram message owner sees every other tenant's totals) and doesn't scale
(one message regardless of how many tenants are active).

---

## Proposed Loop Structure

Adapt `daily-briefing`'s approach:

```typescript
// 1. Fetch all active agency owners (the same query daily-briefing uses)
const { data: profiles } = await service
  .from("profiles")
  .select("id, telegram_chat_id, full_name")
  .eq("role", "admin")
  .eq("is_active", true);

// 2. For each tenant: run scoped queries + send their own brief
for (const profile of profiles ?? []) {
  try {
    await sendDailyBriefForTenant(service, profile.id, profile.telegram_chat_id);
  } catch (err) {
    console.error(`[daily-brief] failed for ${profile.id}:`, err);
    // Non-fatal — continue to next tenant
  }
}
```

Each `sendDailyBriefForTenant` call adds `.eq("user_id", profileId)` (or
`.eq("profile_id", profileId)`) to every query before executing.

---

## Per-Tenant Telegram Delivery

Currently both crons use the shared `TELEGRAM_CHAT_ID` env var. For multi-tenant:

**Option A — per-tenant Telegram chat IDs (recommended)**

Add `telegram_chat_id` column to `profiles` (check if it exists already via the
Telegram setup flow). Each tenant registers their own bot + chat during onboarding.
The cron sends to `profile.telegram_chat_id`; falls back to the global
`TELEGRAM_CHAT_ID` env var if not set (for backwards compat with the founder account).

**Option B — email digest instead of Telegram**

Use `sendEmail()` (Resend) scoped to `profile.email`. Lower coupling to Telegram;
easier to deliver to tenants who haven't set up their own bot. Can run in parallel
with Option A.

**Option C — admin summary only (minimal change)**

Keep the single Telegram message but add an aggregation header per tenant:
"Tenant A: 12 leads, 3 replied | Tenant B: 0 leads ...". Simplest change but
the message grows linearly with tenants and leaks data if the Telegram group has
multiple members.

Recommendation: Option A for Telegram-connected tenants, with Option B as the
email fallback.

---

## Rate Limiting

When there are many active tenants, firing all briefs in parallel risks:
- Blasting the LLM API with concurrent requests
- Telegram rate limits (30 messages/second per bot)
- Vercel function timeout (`maxDuration = 60`)

Mitigation: process tenants in serial with `for...of` (not `Promise.all`), add
a 200ms pause between Telegram sends, and set `maxDuration = 300` (5 min limit
on Pro plan) if needed. For very large tenant counts, offload to a background job
queue (e.g. Trigger.dev, which is already wired into the codebase at
`/api/webhooks/trigger`).

---

## Implementation Checklist (when ready to implement)

- [ ] Confirm `profiles.telegram_chat_id` column exists or add it via migration
- [ ] Extract `sendDailyBriefForTenant(service, profileId, chatId)` helper from
      `daily-brief/route.ts`
- [ ] Update `daily-brief/route.ts` to iterate profiles and call the helper
- [ ] Extract `sendWeeklyDigestForTenant(service, profileId, chatId)` from
      `weekly-digest/route.ts`
- [ ] Update `weekly-digest/route.ts` to iterate profiles and call the helper
- [ ] Add `.eq("user_id", profileId)` (or equivalent) to every query in both helpers
- [ ] Update `vercel.json` cron schedule if the new runtime needs more than 60s
- [ ] Test with 2 fake profiles in staging to verify each gets their own numbers
- [ ] Remove the `TELEGRAM_CHAT_ID` hardcode from both routes
      (keep the env-var fallback in place for the founder account)
