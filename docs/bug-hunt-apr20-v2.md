# Bug Hunt — Apr 20 v2

Read-only investigation of API routes under `src/app/api/`, Trinity assistant tools, plan-tier enforcement, and recently shipped surface area. Each finding references a specific file and line. No code was modified.

---

## Executive summary

Trinity assistant tools, the section hubs, and most /api/clients/[id] routes are well-scoped with `requireOwnedClient` / `verifyClientAccess`. However, several long-lived routes still do ZERO ownership gating and will cheerfully act on any tenant's data, and multiple newer routes have plan-tier `checkLimit` gaps (most thumbnail routes never call `checkLimit`, letting a Starter plan burn the whole GPU budget). There are also three places that return `{ success: true }` when the underlying send / operation clearly failed, which hides real regressions from the UI.

Severity counts: CRITICAL 6, HIGH 7, MEDIUM 7, LOW 3.

---

## Findings

### CRITICAL

## [CRITICAL] twilio/send-sms sends SMS on any tenant's leads + any client's Twilio number
**File:** `src/app/api/twilio/send-sms/route.ts:18-75`
**Issue:** `client_id` is accepted from the request body and used to look up `twilio_phone_number` with NO ownership check (`.eq("id", client_id).single()` — no `profile_id` filter). The `leads` query at line 70/73 is also unscoped (`.in("id", lead_ids)` with no `user_id = ownerId`), so an attacker's `lead_ids[]` can be other tenants' leads and the sends go out on their Twilio number on their tab. Also advances `status: contacted` on strangers' leads (line 153).
**Fix:** Resolve `client_id` through `requireOwnedClient` before reading `twilio_phone_number`, and add `.eq("user_id", ownerId)` to both `leads` queries (the code already resolves `ownerId` — it just doesn't use it for scoping here).
**Confidence:** high

## [CRITICAL] twilio/provision purchases a phone for any tenant's client + burns Twilio budget
**File:** `src/app/api/twilio/provision/route.ts:14-60`
**Issue:** `client_id` comes from the body and is read via `.from("clients").select(...).eq("id", client_id).single()` with no ownership check. An authenticated user on any plan can call POST with another tenant's `client_id` and have ShortStack's Twilio account buy a phone number (ongoing $1/mo + setup fee), wire it up with webhooks, and attach it to someone else's client. The attached ElevenLabs phone/agent is also created under Trinity's Eleven account. The `checkLimit("phone_numbers", 1)` gate (line 30) runs against the ATTACKER's plan tier, not the real owner's — so a Starter user can provision numbers for an Enterprise tenant that's already at its phone-number cap.
**Fix:** After `getEffectiveOwnerId`, reject if the client's `profile_id !== ownerId` (use `requireOwnedClient`). Move the `checkLimit` call to use the real owner so it reflects that owner's plan.
**Confidence:** high

## [CRITICAL] ghl/call reads any lead + initiates a cold call on the house GHL account
**File:** `src/app/api/ghl/call/route.ts:23-90`
**Issue:** No `getEffectiveOwnerId` or ownership check. `lead_id` is taken from the body and `serviceSupabase.from("leads").select("*").eq("id", lead_id).single()` pulls any tenant's lead, then fires a GHL contact + call on behalf of ShortStack's GHL account. Line 90 also mutates `status: "called"` on the other tenant's lead.
**Fix:** Before reading the lead, call `getEffectiveOwnerId(authSupabase, user.id)` and add `.eq("user_id", ownerId)` to the leads query. Same for the status update. Also consider a `checkLimit("call_minutes", 1)` gate like `/api/call` and `/api/caller/initiate` already have — this endpoint bypasses plan limits entirely.
**Confidence:** high

## [CRITICAL] leadgen/ai-agent performs cross-tenant enrich/score/outreach on ANY lead id
**File:** `src/app/api/leadgen/ai-agent/route.ts:6-212`
**Issue:** No ownership scoping anywhere. `lead_ids[]` from the body is trusted:
- Line 81, 127, 154: `.from("leads").select("*")` with only `.eq("id", ...)` or `.in("id", ids)`
- Line 110, 210: UPDATEs on `leads` scoped only by `id`
- Line 53: inserts new leads with NO `user_id` at all — those rows are ORPHANED and invisible to every tenant afterwards
- Line 199: inserts `outreach_log` rows that fan out GHL emails (`ghlKey`) to arbitrary contacts
A tenant can enrich competitors' leads, overwrite their owner_name/social URLs, and trigger outreach emails through GHL on another tenant's behalf.
**Fix:** Require `ownerId` resolution at the top, filter every `leads` query by `.eq("user_id", ownerId)`, and include `user_id: ownerId` on the `insert`. This endpoint also does metered AI work (Claude + GHL emails) with no `checkLimit` gate.
**Confidence:** high

## [CRITICAL] scraper/auto-run lets any authed user disable/reconfigure the nightly cron for EVERY tenant
**File:** `src/app/api/scraper/auto-run/route.ts:11-69`
**Issue:** The handler upserts a SHARED `system_config` row keyed by `"scraper_auto_run"` (line 41) and — on fallback — a single `system_health` row with `service_name: "scraper_auto_run"` (line 54). Any authenticated user (including a client role) can POST here and flip `enabled: false`, change the schedule, platforms, niches, or locations. The nightly `/api/cron/scrape-leads` reads this shared config, so one hostile user can silently kill the scraper for the whole product, or redirect it to niches they choose.
**Fix:** Role-gate to admin/founder/agency only (same pattern as `quick-actions`). Ideally add a per-user row (`key: "scraper_auto_run:${user.id}"`) so each tenant owns their own config, and the cron fans out per-user rather than reading a single global row.
**Confidence:** high

## [CRITICAL] clients/welcome-doc serves any client's welcome PDF to any authed user
**File:** `src/app/api/clients/welcome-doc/route.ts:9-13`
**Issue:** `clientId` comes from `?id=`. The route fetches `supabase.from("clients").select("*").eq("id", clientId).single()` with zero ownership check and serves the generated PDF — which includes contact name, business name, industry, package, MRR (`$${client.mrr}/month`), and services. Competitor can enumerate client ids and pull revenue data.
**Fix:** Add `requireOwnedClient(supabase, user.id, clientId)` before the query (or at minimum `.eq("profile_id", user.id)` for admin, plus team-member resolution). Same PDF bleed exists for data the portal user themselves shouldn't necessarily see.
**Confidence:** high

---

### HIGH

## [HIGH] emails/send returns `{ success: sent }` where `sent=false` reads as a successful API call
**File:** `src/app/api/emails/send/route.ts:38-72`
**Issue:** When `ghlKey` is missing OR the client has no `ghl_contact_id` OR the GHL API call returns non-2xx, `sent` stays `false` but the route still returns `200 OK` with `{ success: false, subject }`. The UI listens for non-2xx or `{ success: true }` to decide whether to toast an error, so silent failures slip through. The route also bypasses `checkLimit("emails", ...)` entirely — callers can blast unlimited emails via this route (distinct from `/api/outreach/email` which gates correctly).
**Fix:** Return `{ status: 502, error: ... }` when neither GHL nor an SMTP fallback can actually deliver. Gate with `checkLimit(ownerId, "emails", 1)` and increment with `recordUsage` on success.
**Confidence:** high

## [HIGH] outreach/send-now logs every DM as `status: "sent"` even though nothing is actually sent
**File:** `src/app/api/outreach/send-now/route.ts:40-93`
**Issue:** The handler loops over leads, generates a personalized message via `generatePersonalizedMessage`, inserts a row into `outreach_log` with `status: "sent"` (line 58), schedules day-3/day-7 follow-ups, and returns `{ success: true, totalSent }`. No actual DM/email/SMS provider is invoked — the message is queued as "sent" while the wire never saw it. Dashboards and reply-rate KPIs (which filter on `status = "sent"`) will be wrong, and the user thinks their outreach went out when it didn't.
**Fix:** Either actually call the platform provider or, if this is an intentional "queue-for-browser-extension" flow, use `status: "pending"` / `"queued"` (like `/api/dm/browser-send` does at line 90) and only flip to `"sent"` after the extension confirms send.
**Confidence:** high

## [HIGH] clients/onboard client-limit check counts ALL clients globally, not the caller's
**File:** `src/app/api/clients/onboard/route.ts:32-40`
**Issue:** `supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true)` is NOT scoped to `profile_id = user.id`. That returns the total active clients across every tenant in the product, not this agency's count. On a multi-tenant deployment the first tenant to hit any plan's ceiling blocks every other tenant from onboarding new clients. Conversely, a tenant whose own count is >cap can keep onboarding while a different tenant is wrongly blocked.
**Fix:** Add `.eq("profile_id", user.id)` (or effective owner id). Also: the newly-created `clients.insert(...)` at line 45 does NOT set `profile_id` on the row — so the created client is orphaned and won't show up in the caller's list. Add `profile_id: user.id` to the insert payload.
**Confidence:** high

## [HIGH] clients/onboard INSERT doesn't set profile_id → onboarded clients are orphaned
**File:** `src/app/api/clients/onboard/route.ts:45-52`
**Issue:** `supabase.from("clients").insert({ business_name, contact_name, ... })` never writes `profile_id`. Every other route (`/api/clients` list, dashboard, switch-client, all tool handlers) filters clients by `profile_id = ownerId`, so the newly-created client will not appear anywhere afterwards. Related side effects (tasks, invoice, portal user) attach to a ghost record.
**Fix:** Add `profile_id: user.id` (or effective agency owner id) to the insert payload.
**Confidence:** high

## [HIGH] briefing/generate reads global stats, not the caller's — leaks cross-tenant numbers
**File:** `src/app/api/briefing/generate/route.ts:22-48`
**Issue:** Each of the ~12 parallel count queries omits a `user_id`/`profile_id` filter (lines 36–47). The response returns global leads/outreach/clients/deals counts and an MRR sum computed across every tenant's active clients to the authed user. On a multi-tenant deployment this discloses aggregate revenue and volume from other agencies.
**Fix:** Resolve `ownerId = getEffectiveOwnerId(...)` and scope every count: `.eq("user_id", ownerId)` for leads/deals/trinity_log, `.eq("profile_id", ownerId)` for clients/tasks, and for outreach_log use the same lead_id/client_id ownership OR filter that `/api/dashboard-data` already builds.
**Confidence:** high

## [HIGH] thumbnail routes bypass plan-tier checkLimit — Starter users can burn unlimited GPU budget
**File:** `src/app/api/thumbnail/generate/route.ts:187-225` and all of `thumbnail/generate-variants`, `thumbnail/with-title`, `thumbnail/recreate`, `thumbnail/edit-with-notes`, `thumbnail/face-swap`, `trinity-assistant generate_thumbnail`/`face_swap_thumbnail`/`generate_thumbnail_with_title`/`edit_thumbnail_with_notes`
**Issue:** None of the thumbnail generation routes call `checkLimit(ownerId, "tokens" | ...)`. Each successful generation dispatches a paid RunPod FLUX job (or Replicate) — a Starter-plan user can fire off thousands. The infra-cost breakeven assumption in `LIMITS_BY_TIER` depends on `tokens` being metered via `recordUsage`, which also doesn't happen here.
**Fix:** Before queueing any job: gate with `checkLimit(ownerId, "tokens", estimatedTokens)` (or introduce a `generations`/`images` resource and a cap per tier), return 402 on exceed, then `recordUsage` after the insert. Rate-limit `thumbnail/generate-variants` especially — it multiplies the cost by 2-4x per call.
**Confidence:** high

## [HIGH] integrations/email-marketing POST can send email + add Mailchimp/Resend contacts with no plan gating
**File:** `src/app/api/integrations/email-marketing/route.ts:149-200`
**Issue:** `action: "send_email"` sends via Resend using Trinity's shared SMTP_FROM, and `action: "add_contact"` writes to Mailchimp/Resend audiences. There's no `checkLimit(ownerId, "emails", 1)` call, no `client_id` ownership check, and no cap on the per-request volume. A Starter-plan tenant can spam via this endpoint while bypassing the monthly emails limit entirely. The `recipient` is arbitrary user input and uses `SMTP_FROM` (agency's verified domain) — potential brand/Spam-folder risk if abused.
**Fix:** Require auth (already there), resolve ownerId, call `checkLimit(ownerId, "emails", 1)` for send_email, `recordUsage` on success. Validate `to` is a plausible email.
**Confidence:** medium

---

### MEDIUM

## [MEDIUM] verifyClientAccess doesn't recognize founder/agency roles — invoice + payment-link routes 403 them
**File:** `src/lib/verify-client-access.ts:26-99` (affects `src/app/api/clients/[id]/invoices/route.ts:49,78` and `src/app/api/clients/[id]/payment-links/route.ts:45,74` and `src/app/api/content-calendar/[id]/publish-now/route.ts:36` and `src/app/api/content-calendar/approve-all/route.ts:28`)
**Issue:** The role switch handles `"admin"`, `"team_member"`, and client-role fallthrough. Founder and agency roles (which trinity-assistant, admin client switcher, and the dashboard treat as equivalent to admin) are NOT in any branch, so they fall through to the client-role code (line 88–99), which looks up `clients.profile_id = userId` and returns `denied: true` unless the founder happens to have a client row. Net effect: a Founder-tier account can't create payment links or invoices on their own clients through these routes (but CAN via trinity-assistant tools, which use different code paths).
**Fix:** Treat `"admin" | "founder" | "agency"` identically in the `verifyClientAccess` logic — add them to the first branch so they verify `clients.profile_id === userId`.
**Confidence:** high

## [MEDIUM] admin/switch-client's `ownerRoles` array excludes team_member from the check, then special-cases it with a separate boolean — fragile
**File:** `src/app/api/admin/switch-client/route.ts:30-40`
**Issue:** `ownerRoles = ["admin", "founder", "agency"]`; then `isTeamMember = role === "team_member" && parentAgencyId`. Role gate: `if (!ownerRoles.includes(role) && !isTeamMember)` — OK. But a team member whose `parent_agency_id` is set at the auth.users level but not yet copied into `profiles.parent_agency_id` will be rejected silently. Also the role list hardcodes "agency", which doesn't appear in the `profiles.role` enum in any migration I checked — probable dead branch.
**Fix:** Resolve `ownerId` through `getEffectiveOwnerId` (same pattern the rest of the app uses) and drop the bespoke role list. Or at minimum, align the role list with the actual enum values used elsewhere (`admin | founder | team_member | client`).
**Confidence:** medium

## [MEDIUM] workflows/execute ownership check doesn't handle team_member — blocks legitimate runs
**File:** `src/app/api/workflows/execute/route.ts:15-25`
**Issue:** Ownership check is `.eq("profile_id", user.id)`. A team_member whose parent agency owns the client will be forbidden from executing workflows on it. The rest of the app uses `requireOwnedClient` / `getEffectiveOwnerId` to resolve the parent.
**Fix:** Replace the raw eq check with `requireOwnedClient(supabase, user.id, client_id)`.
**Confidence:** high

## [MEDIUM] admin/migrate accepts anonymous callers with matching CRON_SECRET — legal but surprising
**File:** `src/app/api/admin/migrate/route.ts:10-23`
**Issue:** The route accepts EITHER an admin session OR `Authorization: Bearer ${CRON_SECRET}`. Anyone with the cron secret can call the migrate endpoint, which executes arbitrary `ALTER TABLE` via the Supabase Management API (line 46–61). If CRON_SECRET ever leaks (see memory: "URGENT: rotate CRON_SECRET") this is a DDL-execution surface.
**Fix:** Drop the cron-secret path — migrations should never be triggered by cron. Require admin role only.
**Confidence:** medium

## [MEDIUM] thumbnail/status has no auth — any caller can poll arbitrary RunPod/Replicate job ids
**File:** `src/app/api/thumbnail/status/route.ts:7-17`
**Issue:** Export says `export async function GET(request)` with no `auth.getUser()` call. The route calls RunPod or Replicate with ShortStack's API key using the caller's `job_id`, returning the output (base64 image or URL). Anyone who knows/guesses a job id can retrieve another tenant's thumbnail. The middleware (`src/middleware.ts:54`) does NOT exclude `api/thumbnail/*`, but unauthenticated requests will still reach this handler if the session cookie is missing — they'll proxy the status response unscoped.
**Fix:** Add `auth.getUser()` and cross-check that the `job_id` belongs to a `generated_images` row owned by `ownerId`.
**Confidence:** high

## [MEDIUM] clients/referral creates a lead with no user_id — orphaned
**File:** `src/app/api/clients/referral/route.ts:31-38`
**Issue:** The referred-from-client flow inserts a lead row missing `user_id`. Same orphaning bug as `clients/onboard`: the lead is invisible to every tenant's list, but visible to the cron workers that don't scope (see `leadgen/ai-agent`, etc.).
**Fix:** Set `user_id: ctx.ownerId` (from `requireOwnedClient`) on the insert.
**Confidence:** high

## [MEDIUM] invoices/create uses platform Stripe (not the agency's connected Stripe)
**File:** `src/app/api/invoices/create/route.ts:39-76`
**Issue:** Creates the Stripe invoice against `client.stripe_customer_id` using Trinity's platform `STRIPE_SECRET_KEY` — money collected here flows to Trinity's bank, not the agency's connected account. Every other invoice flow in the app (`/api/clients/[id]/invoices/`, trinity-assistant `send_invoice`/`create_invoice`) correctly uses the agency's connected `stripe_account_id`. Mixing the two will at best confuse the agency and at worst route real payments to Trinity that the agency then has to refund/transfer manually. Also note: client's stripe customer id on the agency's connected account is `agency_stripe_customer_id`, not `stripe_customer_id` — the two fields aren't interchangeable.
**Fix:** Either delete this endpoint in favour of the Connect-based route, or rewrite it to look up `agency_stripe_accounts.stripe_account_id` and pass `{ stripeAccount: ... }` to every Stripe call.
**Confidence:** high

---

### LOW

## [LOW] ai-recommender overwrites onboarding_preferences destructively
**File:** `src/app/api/ai-recommender/recommend/route.ts:140-148`
**Issue:** The update payload reads `onboarding` (which is `profile?.onboarding_preferences || {}`), spreads it, and writes back. Concurrent reads can see a stale `onboarding` that has since been merged with other keys, leading to lost writes. Also: if the DB fetch earlier failed silently, the spread is `{}` and you wipe the user's real onboarding data.
**Fix:** Use an RPC or `jsonb_set` rather than read-modify-write. At minimum, guard the update behind a successful profile fetch.
**Confidence:** medium

## [LOW] emails/sequence catches every JSON parse failure as success with `{ raw: text }`
**File:** `src/app/api/emails/sequence/route.ts:71-75`
**Issue:** If Claude returns invalid JSON, the route still returns `success: true, sequence: { raw: text }`. The UI renders something — but silently drops the structured fields the user expects (total_emails, emails[]...). A subtle "the API worked but the data is empty" UX.
**Fix:** Return `status: 502, error: "AI returned invalid JSON", raw: text.slice(0, 500)` like `/api/emails/compose` already does.
**Confidence:** medium

## [LOW] thumbnail/face-swap InstantID error surface mixes 501/502 — UI can't cleanly distinguish config vs runtime failure
**File:** `src/app/api/thumbnail/face-swap/route.ts:492-523`
**Issue:** When both Replicate is set AND Runpod returns the "InstantID nodes missing" error, the route returns 502 (fine). But when only Runpod is set and it fails, same error path returns 501. The UI toasts the message, but both cases would benefit from a consistent code — 502 for "configured but failed at runtime" and 501 only when no provider is configured at all.
**Fix:** Return 502 for the "Runpod worker lacks nodes AND Replicate is set but also failed" case; keep 501 only when every provider is absent. Also surface `attempts` array so the UI can tell the user which provider tried.
**Confidence:** low

---

## Notes (out of scope / not bugs)

- `trinity-assistant/route.ts` tool handlers — every one I audited (create_lead, create_task, draft_outreach_message, search_clients, create_payment_link, send_invoice, schedule_social_post, search_leads, get_recent_conversations, generate_content_plan, create_ai_script/email_draft/blog_post, generate_thumbnail, face_swap_thumbnail, recreate_thumbnail_from_url, generate_thumbnail_with_title, generate_carousel, render_video, scrape_lead_niche, create_workflow, create_ad_campaign, publish_social_post, create_invoice, create_content_calendar_item, navigate_to_page, ads Video Pack tools, browse_thumbnail_styles, edit_thumbnail_with_notes) checks `ctx.ownerId` / `ctx.clientScope` correctly and refuses client-role access to agency-only tools. Good. The Trinity assistant does NOT call `checkLimit` before the metered tools (generate_thumbnail, render_video, etc.) — same plan-gating gap as the direct HTTP routes, but same root cause.
- `admin/switch-client` role gate is fine (includes admin/founder/agency + team_member).
- `clients/[id]/phone`, `clients/[id]/files`, `sections/[section]`, `dashboard-data`, `outreach/email`, `outreach/bulk`, `leads/enrich`, `call`, `caller/initiate`, `thumbnail/generate-variants/rank` all correctly scope to `ownerId`.
