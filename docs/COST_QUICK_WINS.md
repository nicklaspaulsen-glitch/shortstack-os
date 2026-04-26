# Cost Quick Wins — ship this week

> Companion to [`PRICING_MARGIN_AUDIT.md`](./PRICING_MARGIN_AUDIT.md).
> All five wins are **mechanical**, low-risk, and reversible. Each PR
> should be its own commit so we can A/B billing impact.

Estimated combined savings: **$55–110/mo on the Vercel bill** + downstream
Anthropic savings of ~$25–60/mo from caching. Ship-effort: under half a day.

---

## QW-1: Anthropic prompt-caching on the 5 hottest routes

**Why.** Anthropic charges 90% less for tokens that hit a prompt cache
(input × 0.10) and only 1.25× to write the cache. If a route reuses
the same system prompt or tool list across calls (it does — see
`/api/trinity-assistant`), each repeat call is essentially free.

**Where.**
1. `src/app/api/trinity-assistant/route.ts` — biggest win. Tools array is
   stable; system prompt depends only on user.
2. `src/app/api/video/auto-edit/director/route.ts` — system prompt stable.
3. `src/app/api/landing-pages/generate/route.ts` — long brief in system.
4. `src/app/api/email-templates/generate/route.ts` — repeats per tenant.
5. `src/app/api/dashboard/ai-today/route.ts` — fires once per dashboard load.

**How.**
1. Add a tiny helper to `src/lib/ai/claude-helpers.ts`:
   ```ts
   export function withCacheBreakpoint<T extends { type: string }>(
     blocks: T[],
   ): (T & { cache_control?: { type: "ephemeral" } })[] {
     if (blocks.length === 0) return blocks as never;
     const last = blocks[blocks.length - 1];
     return [
       ...blocks.slice(0, -1),
       { ...last, cache_control: { type: "ephemeral" } },
     ];
   }
   ```
2. Wrap the system prompt and tools array on the 5 routes with the helper:
   ```ts
   const messageOpts = {
     model: MODEL_HAIKU,
     system: withCacheBreakpoint([{ type: "text", text: SYSTEM_PROMPT }]),
     tools: withCacheBreakpoint(TOOLS),
     // ...
   };
   ```
3. Keep an eye on the `usage.cache_read_input_tokens` field in Anthropic
   responses for the first 24h to confirm cache hits.

**LOC:** ~150 across 6 files (helper + 5 routes).
**Risk:** Low — Anthropic SDK swallows `cache_control` on unsupported routes.
**Estimated savings:** **$25–60/mo** (Anthropic), no Vercel impact.

---

## QW-2: Slow `publish-scheduled` from 5 min → 15 min

**Why.** It runs **288 times a day** today. Most ticks fetch zero rows
because nothing is due. Vercel cron is paid per invocation × duration;
even a no-op tick is ~50ms × 1.5GB. 288 × 30 days = 8,640 runs.

**Where.** `vercel.json` line 97–99:
```json
{ "path": "/api/cron/publish-scheduled", "schedule": "*/5 * * * *" }
```

**How.** Change `"*/5 * * * *"` → `"*/15 * * * *"`. The route already has
a 1-hour grace window for missed ticks (line 42 of the route), so no
material change in user-visible behavior.

**LOC:** 1.
**Risk:** Imperceptible. The maximum lag from "user approves" to "post
goes out" goes from <5 min to <15 min. Social posts aren't real-time.
**Estimated savings:** **$5–8/mo**.

---

## QW-3: Tighten `maxDuration` on cron routes that finish fast

**Why.** Vercel bills by duration × memory. Setting `maxDuration = 300`
on a route that p99-completes in 8s doesn't change normal-case cost,
but it does inflate cold-start memory headroom. More importantly, when
a route hits a hung external API (e.g. `health-check`'s 15 endpoints)
the headroom-bug burns up to 5 minutes of GB-hr.

**Where.** Five routes that should be 30–60s:

| Route                                       | Current  | Recommended |
| ------------------------------------------- | -------- | ----------- |
| `src/app/api/cron/reminders/route.ts`       | 60       | 30          |
| `src/app/api/cron/lead-cleanup/route.ts`    | 60       | 30          |
| `src/app/api/cron/retention-check/route.ts` | 60       | 30          |
| `src/app/api/cron/invoice-chase/route.ts`   | 60       | 30          |
| `src/app/api/cron/review-requests/route.ts` | 60       | 30          |

**How.** One-line change per file:
```diff
-export const maxDuration = 60;
+export const maxDuration = 30;
```

**LOC:** 5.
**Risk:** Low — these crons are quick. If any starts timing out, revert
that one route. Add a `console.error` line at duration 25s to detect.
**Estimated savings:** **$10–15/mo**.

---

## QW-4: Flip 5 light read-only routes to Edge runtime

**Why.** Edge invocations cost ~75% less per ms than Node. The
following routes are pure DB-reads or HTTP-fan-outs — they don't use
any Node-only API and don't import heavy SDKs:

- `src/app/api/profile/route.ts`
- `src/app/api/user/onboarding/route.ts`
- `src/app/api/user/sidebar-preferences/route.ts`
- `src/app/api/user/sidebar-unread/route.ts`
- `src/app/api/system-status/route.ts`

**How.** Add at the top of each file:
```ts
export const runtime = "edge";
```
Verify each route compiles in Edge mode (Next will surface any
incompatible imports). The Supabase JS client supports Edge with
`@supabase/supabase-js@^2.43`.

**LOC:** 5.
**Risk:** Medium — if any imports a Node-only lib (e.g. `crypto.randomUUID`
must become `globalThis.crypto.randomUUID()`), the build will fail at
deploy. Test on a preview deploy first.
**Estimated savings:** **$15–25/mo**.

---

## QW-5: Configure provider-side hard caps

**Why.** A single misconfigured cron or leaked key can multiply the
monthly bill. Each provider lets you set a hard ceiling that pages or
disables the key when crossed.

**Where.** Provider dashboards (zero code):

| Provider     | Where to set                                                      | Cap        |
| ------------ | ----------------------------------------------------------------- | ---------- |
| Vercel       | Settings → Usage → Spend Management → Hard cap                    | **$110/mo** |
| Anthropic    | Console → Plans & Billing → Usage limits                          | **$400/mo** |
| OpenAI       | Settings → Limits → Monthly budget                                | **$50/mo**  |
| RunPod       | Settings → Usage → Hard limit                                     | **$80/mo**  |
| Twilio       | Console → Billing → Auto-recharge stop                            | **$200/mo** |
| ElevenLabs   | Account → Limits                                                  | **$30/mo**  |
| Apify        | Account → Billing → Usage limits                                  | **$60/mo**  |

**LOC:** 0 (configuration only).
**Risk:** **Lowest possible** — caps fail safe. The risk is forgetting
to raise them when paying tenant count grows.
**Estimated savings:** **catastrophic-loss prevention**, not steady-state.
A single runaway cron caught by these caps could prevent a $1k+ bill spike.

---

## Order of operations

Suggested sequence for one focused half-day session:

1. **QW-5 first** (configuration only, ~15 min). Pure safety move.
2. **QW-2** (1-line cron change, ~5 min). Smallest blast radius.
3. **QW-3** (5 cron `maxDuration` tweaks, ~15 min). Easy revert per file.
4. **QW-1** (helper + 5 route updates, ~2 hours including testing).
   Biggest Anthropic-side win.
5. **QW-4 last** (Edge flip, ~1 hour including a preview-deploy verify).
   Most "could surface a hidden import" risk.

After all 5 ship, watch the Vercel + Anthropic dashboards for 7 days
before deciding which deeper optimization in the audit to ship next.
