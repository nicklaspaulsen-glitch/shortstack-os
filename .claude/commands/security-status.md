---
description: Quick "is the codebase secure?" health check. Runs the api-auth-gate-auditor + cron-handler-validator agents and reports a one-page security state.
---

# /security-status

Fast snapshot of the codebase's security posture. Use this before a release, or when you suspect something has regressed.

## What it does

Run two agents in parallel and aggregate the output:

1. **`@api-auth-gate-auditor`** — scans every `src/app/api/**/route.ts` for missing/wrong auth gates. Skips routes already known-good per recent commits.

2. **`@cron-handler-validator`** — verifies `vercel.json` cron schedules match handler routes, and that handlers gate on `CRON_SECRET` (not `NEXT_PUBLIC_CRON_SECRET`).

Plus a quick local check:

3. Grep for **module-level SDK init** that bypasses the lazy-getter pattern:
   ```
   rg -n "new Stripe\(|new Anthropic\(" src/ --type ts
   ```
   The only legal hits are inside `src/lib/stripe/client.ts` and `src/lib/ai/claude-helpers.ts` (the lazy getters). Anything else is the same class as the Stripe v18 build break and should be flagged.

4. Grep for **NEXT_PUBLIC env vars that might contain secrets**:
   ```
   rg -n "NEXT_PUBLIC_(SECRET|TOKEN|KEY|PASSWORD|CRON|API_KEY)" src/ --type ts
   ```
   The only legal hits are `NEXT_PUBLIC_SUPABASE_ANON_KEY` (intentionally public) and stuff in env files. Anything else is a leak.

5. Grep for **service-client without auth check**:
   ```
   rg -n "createServiceClient\(\)" src/app/api --type ts | head -50
   ```
   Eyeball each — the pattern should be: createServerSupabase auth check FIRST, then createServiceClient for the actual write.

## Report format

```
## Security status — <date>

📊 Summary
- Auth gates:   ✅ <total> routes audited, <CRITICAL> CRITICAL, <HIGH> HIGH
- Cron health:  ✅ <total> schedules match handlers, <orphan> orphan handlers
- SDK init:     ✅ all clean / ❌ <N> bypasses lazy getter
- Public env:   ✅ all clean / ❌ <N> potential secret leaks
- Service client gating:  ✅ all gated / ⚠️ <N> need review

🚨 CRITICAL findings
[list any]

⚠️  HIGH findings
[list any]

ℹ️  MEDIUM / informational
[list any]

✅ What's known-good
- OAuth state signing on Google/LinkedIn/TikTok/Discord/Meta (Apr 27 round-9)
- ElevenLabs HMAC, Twilio HMAC-SHA1, Resend Svix, Resend inbound bearer
- /api/cron/* all gate on CRON_SECRET
- Lazy SDK init for Stripe (lib/stripe/client.ts), Anthropic (lib/ai/claude-helpers.ts)
- SSG-resilient Supabase browser client (lib/supabase/client.ts)
```

Cap report at 600 words. Don't restate every clean route — only flag the diff between known-good and current state.

## When to run

- Before any production release
- After merging a feature branch with new API routes
- Weekly on Monday morning (paired with `/health`)
- After any `vercel.json` cron change
- Whenever you've added a new external integration / OAuth provider

## What it doesn't do

- Doesn't run dependency vuln scans (use `npm audit` for that).
- Doesn't check RLS policy correctness — use `/rls-check <table>` per table.
- Doesn't check secrets are actually set in Vercel — that's a Vercel API call.
- Doesn't check for client-side XSS — out of scope of this auditor pair.
