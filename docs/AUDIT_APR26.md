# Audit — April 26 2026

Deep audit of today's 11 PRs merged to main. Scope: PRs #5–#15 (security batches, AI Canva v1, Nango foundation, Integrations Hub UI, Social Studio MVP, Pricing docs, Cost Quick Wins).

**Verification gates run:**

- `npx tsc --noEmit` → **clean** (exit 0).
- DB tables verified via Supabase MCP — all new tables (`designs`, `design_templates`, `design_assets`, `design_jobs`, `oauth_connections_nango`, `social_posts`, `social_comments`) exist with RLS enabled.

**Headline counts:** 0 CRITICAL · 4 HIGH · 9 MEDIUM · 6 LOW · 6 GOOD.

The bar is high — the security batches (PRs #5–#7, #12) closed the genuinely scary stuff (cross-tenant reads, forgeable OAuth state, Stripe webhook fail-closed). What's left below is mostly polish, defense-in-depth, and a couple of cross-tenant gaps in new code that need follow-up.

---

## CRITICAL (must fix before next deploy)

_None._

The four security PRs that landed this morning systematically closed everything that fits the CRITICAL bar (auth bypass, cross-tenant reads, signature-skipped webhooks). I verified the diffs — every previously-flagged route now uses `getEffectiveOwnerId` / `requireOwnedClient` and `STRIPE_BILLING_WEBHOOK_SECRET` is checked before `constructEvent`.

---

## HIGH (should fix this week)

### H1. Social Studio routes don't resolve `ownerId` for team_members

**Files:**
- `src/app/api/social/lineup/route.ts:46,84,156,213`
- `src/app/api/social/schedule/route.ts:86`
- `src/app/api/social/stats/route.ts:94`
- `src/app/api/social/top-commenters/route.ts:44`

Every Social Studio route filters by `user.id` directly (`.eq("user_id", user.id)`), not by the effective agency owner from `getEffectiveOwnerId`. A team_member of an agency will see an empty calendar / empty stats / empty commenters list because their parent agency's posts were written under the parent's `user_id`. They can also `INSERT` social_posts under their own `user_id`, fragmenting the agency's data.

**Pattern to follow:** every other tenant-scoped route in the repo (e.g. `agents/chief`, `autopilot/recent`, `dashboard/ai-today`) calls `getEffectiveOwnerId` and uses that for both reads and writes.

**Fix:** swap `user.id` → `ownerId` from `await getEffectiveOwnerId(supabase, user.id)`. Done in five places per route.

---

### H2. `requireOwnedClient` not used in Design Studio DELETE — RLS-only enforcement

**File:** `src/app/api/design-studio/designs/[id]/route.ts:113-117`

The DELETE handler does:

```ts
const { error } = await supabase.from("designs").delete().eq("id", params.id);
```

No `.eq("user_id", ctx.ownerId)` filter on the delete. This relies entirely on the RLS policy `designs_delete_own` (`user_id = auth.uid()`) to scope. PATCH on the same file (line 86-92) does belt-and-braces with `.eq("user_id", ctx.ownerId)`. Worse, RLS uses `auth.uid()` directly which won't match team_members against parent agency's designs — so a team_member can never delete a design owned by their agency. The `resolveDesign` precheck above does verify ownership, so this is "RLS-redundant for the owner case" but stops working for team_members and breaks consistency with PATCH.

**Fix:** add `.eq("user_id", ctx.ownerId)` on line 116 so the precheck and the actual delete agree, and so team_members work consistently.

---

### H3. AI Today: missing `user_id` filter on two count queries

**File:** `src/app/api/dashboard/ai-today/route.ts:67-70` (`replied7d`) and `:71-75` (`contentScheduled7d`)

```ts
supabase.from("outreach_log").select("*", { count: "exact", head: true })
  .eq("status", "replied")          // ← no .eq("user_id", user.id)
  .gte("sent_at", since7d),
supabase.from("content_calendar").select("*", { count: "exact", head: true })
  .gte("scheduled_at", today)        // ← no .eq("user_id", user.id)
  .lte("scheduled_at", next7Iso),
```

Both queries return cross-tenant counts to the snapshot used by Claude. RLS on those tables likely scopes correctly under `createServerSupabase()` (user-token client), so this *probably* doesn't actually leak — but it depends on RLS being correct. Defense-in-depth applied to every other count in the same `Promise.all` (`leads`, `deals`, `conversations`) but not these two.

**Note:** pre-existing issue from `24527f7`, but `a0064f8` (today's QW-1) edited this file and didn't fix it — it's now a deliberate omission to flag. Same pattern the security batches were closing.

**Fix:** add `.eq("user_id", user.id)` (or better, `ownerId` from `getEffectiveOwnerId`) to both.

---

### H4. `design-studio/admin/seed-templates` uses string-equality for CRON_SECRET

**File:** `src/app/api/design-studio/admin/seed-templates/route.ts:28`

```ts
const secretOk = cronSecret.length > 0 && bearer === cronSecret;
```

This is a non-constant-time comparison. While the route falls back to admin/founder session auth (and only insert templates), CRON_SECRET is leakable via a side-channel timing attack the same way every other secret is. The repo elsewhere uses `Bearer ${process.env.CRON_SECRET}` direct string compare too — but for a fresh route it's worth using `crypto.timingSafeEqual` from `node:crypto` like other seed/admin endpoints might.

**Fix:** convert to `Buffer.from(bearer)` + `Buffer.from(cronSecret)` + `timingSafeEqual` with length pre-check, mirroring the pattern in `src/lib/security/oauth-state.ts` (HMAC verification).

---

## MEDIUM (nice to fix)

### M1. Tab2AIUpload passes blob URLs to a server route — won't work in production

**File:** `src/app/dashboard/social-studio/components/Tab2AIUpload.tsx:75-77, 99-101, 181-184`

```ts
const url = URL.createObjectURL(f);
setAsset({ kind: isVideo ? "video" : "image", url, name: f.name });
// later...
body.media_url = asset.url;   // → blob:https://app.shortstack.work/uuid
```

`blob:` URLs only exist in the browser tab that created them. The server-side `/api/social/auto-upload` calls Claude with `Media URL: blob:...` — Claude can't fetch it; the AI response will treat it as a dead link. Same for `/api/social/schedule` which forwards `media_urls: [blob:...]` to Zernio. The TODO at line 75 ("Production wiring will upload to R2 via /api/uploads") explicitly acknowledges this is half-baked.

**Fix:** Wire the file picker to upload to R2 via `/api/uploads/r2` first, then pass the public CDN URL.

---

### M2. Design Studio routes not in `routes-to-check.ts`

**File:** `src/lib/self-test/routes-to-check.ts`

Social Studio (#13) and Nango (#9) added their fixtures. Design Studio (#8) didn't. The 5 design-studio routes (`designs`, `designs/[id]`, `templates`, `generate`, `export`, `admin/seed-templates`) are uncovered by the nightly self-test. A regression here (auth bypass, 500, etc.) won't be caught.

**Fix:** Add fixtures for at least `GET /api/design-studio/designs` (200/401), `GET /api/design-studio/templates` (200/401), `POST /api/design-studio/designs` with empty body (400/401), and `POST /api/design-studio/admin/seed-templates` with empty body (401/403).

---

### M3. Design Studio renderer fonts: Satori called with `fonts: []`

**File:** `src/lib/design/render-server.ts:115`

```ts
const svg = await satori(html as Parameters<typeof satori>[0], {
  width, height, fonts: [],
});
```

Satori needs at least one font registered to render text. With `fonts: []`, any text layer in an exported design will either crash Satori or render with garbled glyphs depending on version. The comment says "For MVP we inline the system sans-serif fallback" but the `fonts: []` array contradicts that — there's no fallback. PNG export is a headline feature of Design Studio; this will fail visibly the first time someone exports a text-heavy design.

**Fix:** Bundle one open-source TTF (Inter regular + bold are tiny, ~300KB combined) under `public/fonts/` and pass `[{ name: "Inter", data: ttfBuffer, weight: 400, style: "normal" }, ...]`.

---

### M4. Design Studio editor uses `<img>` instead of `next/image`

**File:** `src/app/dashboard/design-studio/page.tsx:225-230`

```tsx
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={d.thumbnail_url} alt={d.title} ... />
```

CLAUDE.md says "No `<img>` for new images — use `next/image`. Existing `<img>` tags are deferred for a future perf pass." This is brand-new code so it falls under "new". The eslint-disable is a workaround. Same convention is followed in other new pages (e.g. integration-card.tsx uses `next/image`).

**Fix:** Replace with `<Image src={d.thumbnail_url} alt={d.title} width={... } height={...} unoptimized />` (R2/Supabase URLs need either `images.remotePatterns` config or `unoptimized`).

---

### M5. Tab1Calendar refetches lineup on every filter toggle

**File:** `src/app/dashboard/social-studio/components/Tab1Calendar.tsx:71-94`

`fetchLineup` is in a `useEffect` dependency on `[statusFilters, platformFilters]`. Toggling any pill triggers a fresh round-trip to `/api/social/lineup` *and* a recompute of the stats tile. For an agency with 1000+ posts that's hundreds of KB downloaded per click. Filtering should ideally be client-side once the data is loaded — the route already returns up to 300 rows.

**Fix:** Fetch once with the broadest filters, do filtering in `useMemo` against `posts` state. Keep the API filters as a fallback for very large accounts.

---

### M6. Nango finalize doesn't enforce a transactional success+row-write

**File:** `src/app/api/integrations/nango/finalize/route.ts:148-162`

The browser calls `nango.auth(...)` (success) → POST `/finalize`. If the user closes the tab between Nango success and the finalize call, the Nango connection exists upstream but no `oauth_connections_nango` row is written. The page mount re-fetches `/connections` next visit and sees no row → shows "Connect" button → user re-auths → second connection is created. Disconnect cleans up the local row but leaves the orphan Nango connection.

**Fix:** Either (a) add a Nango webhook that writes the row server-to-server, or (b) on `/connect/{id}` GET, also call `listConnections` from Nango and reconcile. Tracked elsewhere as part of the Nango migration plan, so a doc note is enough.

---

### M7. `oauth_connections_rls_fix.sql` adds `client_id` column to a table that already had migrations

**File:** `supabase/migrations/20260427_oauth_connections_rls_fix.sql:108-112`

The migration adds `client_id` via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. That works, but the new RLS policies *reference* `client_id` in their `using` clauses (lines 36-38, 73-79, 96-98). When the migration runs against a fresh DB with no `client_id` column yet, the order of operations is: drop policy → create policies (referencing client_id which doesn't exist) → add column. Postgres will reject the `create policy` with `column "client_id" does not exist`.

**Fix:** Reorder so the `ALTER TABLE ... ADD COLUMN` runs BEFORE the `do $$` policy blocks. Or split into two migrations.

---

### M8. `claude-helpers.ts` violates module-level SDK init rule

**File:** `src/lib/ai/claude-helpers.ts:3`

```ts
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

CLAUDE.md says "Module-level SDK init is BANNED... All SDK clients are lazy. Pattern enforced via `getStripe()` / shared `anthropic` singleton." The Stripe pattern is `getStripe()` returning a lazy singleton; the Anthropic pattern uses module-level `new Anthropic()`. The constructor doesn't blow up on missing env (apiKey is optional and only checked when `messages.create` runs), so this is *current* behavior, not a new break — but it's inconsistent and could break on future SDK bumps that validate constructor args eagerly.

**Note:** pre-existing — not introduced by today's PRs. Worth flagging for a follow-up.

**Fix:** Convert to `getAnthropic()` lazy singleton. Then audit all imports of `anthropic` and switch them.

---

### M9. Telegram `chatId/botToken` reads scattered across billing/webhook (10+ duplications)

**File:** `src/app/api/billing/webhook/route.ts:91-93, 140-142, 177-179, 223-225, 324-326, 360-362, 416-418`

Same pattern repeated 7 times:

```ts
const chatId = process.env.TELEGRAM_CHAT_ID;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (chatId && botToken) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, ...).catch(() => {});
}
```

Fine for now (the route is webhook-only and Stripe is the only path). But the duplication makes adding rate limiting / retry logic per-block error-prone. There's already a Telegram preset infrastructure (`telegram_presets` table) — this should funnel through it.

**Fix:** Extract a `notifyOps(chatId, botToken, text)` helper into `src/lib/telegram.ts`.

---

## LOW (notes only)

### L1. `src/lib/design/store.ts:69-71` uses `JSON.parse(JSON.stringify(doc))` for clone

Slow and breaks on Date/Map/Set. Doc shape currently uses only POJOs/arrays/strings/numbers/null so it works, but if a Layer gains a `Date` field it'll silently coerce to string. Consider `structuredClone` (Node 17+).

### L2. Several routes use `: any` despite CLAUDE.md "no `: any` in new code"

- `src/app/api/design-studio/designs/route.ts:96`: `cloneTemplateDoc(tpl.doc as any)`
- `src/app/api/design-studio/templates/route.ts:104`: same
- `src/app/api/design-studio/designs/route.ts:103`: `eslint-disable-next-line @typescript-eslint/no-explicit-any`

Wrapped in eslint-disable but still violates the spirit of the rule. `tpl.doc` is `unknown` from supabase-js; should narrow via a schema validator.

### L3. Tab2AIUpload tone presets are hardcoded strings

`["professional", "playful", "punchy", "story-driven", "expert"]` lives inline at line 293. Should be in `src/lib/social-studio/constants.ts` next to the platform meta.

### L4. `social-studio/page.tsx` calls `useAuth()` for the side effect but discards the value

```tsx
useAuth();   // ← no destructure, just to trigger redirect side-effect
```

Works, but reads as a bug. Either add a comment explaining (`// triggers redirect-if-unauth`) or destructure `{ loading }` and gate render on it like other pages do.

### L5. `vercel.json` `publish-scheduled` already at `*/15` but comment in `route.ts:13` still says "every 5 minutes"

Documentation drift after QW-2. One-line comment update.

### L6. `routes-to-check.ts:340-347` covers `/finalize` but doesn't cover the new `/disconnect/google-ads` deeply

Existing fixture is empty body → 400/401/503. Doesn't verify the success path against a connected user. Acceptable for self-test (which can't easily set up a Nango connection), but worth noting.

---

## GOOD STUFF (positive findings)

### G1. Security batches were thorough and well-reviewed

PRs #5–#7 + #12 closed 14 cross-tenant issues with clean diffs. Each `getEffectiveOwnerId` swap is consistent, the OAuth state HMAC fallback was removed cleanly, and the Stripe webhook now fail-closes when `STRIPE_BILLING_WEBHOOK_SECRET` is missing. The reviewer rounds (Opus catching the chief regression where `custom_agents.user_id` should have been `spawned_by`) caught real bugs.

### G2. Design Studio templates seeding is idempotent + auth-gated

`POST /api/design-studio/admin/seed-templates` uses upsert with `onConflict: "name,is_global", ignoreDuplicates: true`, gated on CRON_SECRET OR admin/founder session, with an explicit unique constraint added by `20260427_design_studio_followup.sql`. The previous "lazy seed inside GET handler" anti-pattern was correctly excised.

### G3. Nango client architecture is clean — server/client split prevents node: scheme webpack errors

`src/lib/nango/shared.ts` (constants only) lets client components import `NANGO_INTEGRATIONS` without dragging `@nangohq/node` into the browser bundle. `src/lib/nango/client.ts` (server) uses the lazy singleton pattern correctly. Comment-doc explaining the split is excellent.

### G4. Branded `connect-modal.tsx` is accessibility-complete

Focus trap, ESC-to-close, ARIA dialog, body-scroll lock, restore-focus-on-close, backdrop-click cancel. Most ad-hoc modals in the repo skip 2–3 of these.

### G5. Design Studio render-server has a real SSRF allowlist

`src/lib/design/render-server.ts:20-69` — explicit allowlist (`cdn.shortstack.cloud`, R2 hostnames, Supabase storage, OpenAI DALL-E) plus the generic `checkFetchUrl` SSRF check. Bad URLs fall back to a 1×1 transparent PNG. Better than 90% of the file-fetching code in the repo.

### G6. Anthropic prompt-cache helper is correctly conservative

`withCacheBreakpoint()` returns a new array (immutable), no mutation of input, handles empty arrays, last-block-only annotation. Applied only to the 3 routes the doc said to apply. The two other routes (`landing-pages/generate`, `email-templates/generate`) were correctly identified as already caching.

---

## Top 3 things to fix RIGHT NOW

1. **H1** — Social Studio team_member tenancy. Five-minute fix per route, prevents the biggest user complaints (empty calendars, fragmented data) when the first agency invites a team_member.
2. **M3** — Add real fonts to Satori call. Without this, the first text-heavy design exported will render visibly broken in production.
3. **M7** — Reorder `20260427_oauth_connections_rls_fix.sql` so `ADD COLUMN client_id` runs *before* the `create policy` blocks. Otherwise this migration will fail on a fresh DB.

---

## Process notes

- 11 PRs / ~13k LOC added in a day with clean tsc and (mostly) good architecture is impressive throughput.
- The pattern of "Sonnet drafts → Opus reviews → reviewer-blocker fixes within the same PR" is producing visible quality lift (the H1 misses are the biggest gap, and they're consistent with each other so a single fix-batch cleans them all up).
- Recommend wiring **/agent** for any future Social Studio expansion since the team_member pattern needs surgical attention.
