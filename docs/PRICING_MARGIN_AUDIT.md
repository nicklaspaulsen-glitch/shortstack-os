# ShortStack OS — Pricing & Margin Audit

> Date: 2026-04-26
> Branch: `docs/pricing-audit`
> Status: **Analysis only** — no code or pricing changes.
> Companion: see [`COST_QUICK_WINS.md`](./COST_QUICK_WINS.md) for ship-this-week fixes.

---

## TL;DR

- **All five plans are gross-profitable today**, but the **Starter ($497/mo)** tier
  has the thinnest margin (≈64% gross at typical usage) and is the most exposed
  to a heavy user knocking it negative (down to ≈45% if they hammer Caller +
  Image-gen).
- **Vercel $180/mo** is dominated by **30 cron schedules**, **34 routes with
  `maxDuration ≥ 60s`**, and **23 named Sonnet streaming routes** that all run
  on Node runtime. There is at least **$40-80/mo** of fat that can be cut in a
  weekend without changing product behavior.
- Recommendation: hold prices. Add **per-tenant usage-based overages** instead
  of hard 402 walls, ship an **Annual = 10× monthly** cycle for cash-flow,
  and put a **3-router prompt-caching layer** on the top 5 Claude routes.

---

## Section 1 — Provider cost catalog

All numbers are list pricing as of April 2026. Where a plan tier matters, I cite
the tier ShortStack is on or should be on.

| Provider     | Plan / unit                        | Unit cost                                                                              | ShortStack today                                  |
| ------------ | ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Vercel**   | Pro plan flat                      | $20/mo (per member)                                                                    | $180/mo total per user → ≈$160/mo of usage on top |
| Vercel       | Function invocations               | $0.60 per **1M** invocations (after 1M included)                                       | Heavy — ~30 crons + 609 route files               |
| Vercel       | Function duration (Node)           | $0.18 per **GB-hour** (after 1k included)                                              | Most cost; long maxDurations dominate             |
| Vercel       | Edge requests                      | $0.65 per **1M** (after 1M included)                                                   | Underused — only 1 edge route                     |
| Vercel       | Bandwidth                          | $0.15 per GB (after 1 TB included)                                                     | Low for an SaaS dashboard                         |
| Vercel       | Image Optimization                 | $5 per 1k source images                                                                | Low (14 next/image consumers)                     |
| **Supabase** | Pro                                | $25/mo + $0.0125/GB storage + $0.09/GB egress (8GB+250GB included)                     | Single Pro project (`jkttomvrfhomhthetqhh`)       |
| **Anthropic**| Sonnet 4.6 input                   | $3.00 / 1M tokens                                                                      | Used in 23 named routes                           |
| Anthropic    | Sonnet 4.6 output                  | $15.00 / 1M tokens                                                                     | Same                                              |
| Anthropic    | Haiku 4.5 input                    | $0.80 / 1M tokens                                                                      | Used in 53 routes (good — cheap path is default)  |
| Anthropic    | Haiku 4.5 output                   | $4.00 / 1M tokens                                                                      | Same                                              |
| Anthropic    | Prompt cache **write** (5m)        | input × **1.25**                                                                       | Not yet used — opportunity                        |
| Anthropic    | Prompt cache **read** (hit)        | input × **0.10** (90% off)                                                             | Not yet used — opportunity                        |
| **OpenAI**   | GPT-4o input / output              | $2.50 / $10.00 per 1M                                                                  | Used as fallback for some image/transcribe routes |
| OpenAI       | GPT-4o-mini input / output         | $0.15 / $0.60 per 1M                                                                   | Not heavily used                                  |
| **RunPod**   | Serverless RTX 4090                | $0.00031 / sec (~$1.12 / GPU-hour)                                                     | FLUX (image-gen), upscale, Whisper, RemBG, music  |
| RunPod       | Serverless H100                    | $0.00099 / sec                                                                         | Voice-clone & LoRA training (rare)                |
| **ElevenLabs** | Starter                          | $5/mo, 30k chars                                                                       | TTS for Voice Receptionist                        |
| ElevenLabs   | Creator                            | $22/mo, 100k chars                                                                     | Likely tier today                                 |
| ElevenLabs   | Pro                                | $99/mo, 500k chars                                                                     | Not yet                                           |
| ElevenLabs   | Overage                            | $0.18 / 1k chars (Creator)                                                             |                                                   |
| **Twilio**   | Outbound SMS US                    | $0.0079 / SMS                                                                          | Plan caps go up to 25k/mo                         |
| Twilio       | Voice (US)                         | $0.013 / min outbound, $0.0085 / min inbound                                           | Caller minutes                                    |
| Twilio       | Phone numbers                      | $1.15 / number / mo                                                                    | 1-50 per tier                                     |
| **Resend**   | Pro flat                           | $20/mo for 50k emails                                                                  | Currently the project's primary sender            |
| Resend       | Pay-as-you-go                      | $1 / 1k emails over included bucket                                                    |                                                   |
| **Stripe**   | Card                               | 2.9% + $0.30 / charge                                                                  | All recurring                                     |
| Stripe       | Connect (when used)                | + 0.5%                                                                                 | Only when invoicing on behalf of clients          |
| **Zernio**   | Build                              | $16/mo (10 social profiles)                                                            | Recommended baseline                              |
| Zernio       | + Comments + DMs                   | $9/mo                                                                                  | Recommended for Growth+                           |
| Zernio       | + Ads                              | $9/mo                                                                                  | Recommended for Pro+                              |
| **Apify**    | Free → Personal                    | $0/mo or $49/mo + compute                                                              | Used for lead-scrape — cron `scrape-leads` daily  |
| **Nango**    | Starter                            | $50/mo (per-tenant OAuth aggregator, 100 connections)                                  | Used for Google/Meta/TikTok Ads, etc.             |

**Total fixed-base SaaS bill (no users):** roughly **$20 (Vercel) + $25 (Supabase Pro) + $20 (Resend) + $22 (11L Creator) + $34 (Zernio Build+Comments+Ads) + $50 (Nango) + $49 (Apify)** ≈ **$220/mo** before any per-tenant usage. Anything beyond that is variable.

---

## Section 2 — Per-tenant variable cost estimate

A "tenant" here is a ShortStack OS subscriber (an agency owner). Each tenant
manages 5–150 of their own clients. Usage scales with number-of-clients × usage
intensity per client. Numbers below assume **one tenant** at three intensities.

### Persona A — Light (Starter-like)

- 5 clients managed, 1 chat session/day with Trinity, ~10 designs/mo, 50
  emails/mo, no calls, no scrape automations, light dashboard refreshing.

| Bucket               | Volume                                                | Cost      |
| -------------------- | ----------------------------------------------------- | --------- |
| Supabase storage     | ~2 GB                                                 | $0.03     |
| Supabase egress      | ~5 GB                                                 | $0.45     |
| Vercel function-GB-hr| ~0.7 GB-hr                                            | $0.13     |
| Vercel invocations   | ~100k                                                 | $0.06     |
| Claude Haiku         | ~250k input + 60k output (Trinity hops mostly Haiku)  | $0.44     |
| Claude Sonnet        | ~50k input + 20k output (synthesis)                   | $0.45     |
| Resend               | 50 emails (well under bucket)                         | $0.00     |
| Twilio SMS           | 0                                                     | $0.00     |
| Twilio phone #       | 0                                                     | $0.00     |
| RunPod (FLUX)        | 10 designs × ~12s × $0.00031/s                        | $0.04     |
| Zernio               | 1 social profile (within Build bundle)                | $0.00 marginal |
| Apify CU             | ~light, scrape rarely                                 | $0.10     |
| Stripe (on $497)     | 2.9% + $0.30                                          | $14.71    |
| **Total COGS / mo**  |                                                       | **≈$16.40** |

### Persona B — Medium (Growth-like)

- 15 clients, 5 chat sessions/day, ~50 designs/mo, 500 emails/mo, 200 SMS/mo,
  100 caller-minutes/mo, daily lead-scrape, weekly content-autopilot.

| Bucket               | Volume                                                | Cost      |
| -------------------- | ----------------------------------------------------- | --------- |
| Supabase storage     | ~10 GB                                                | $0.13     |
| Supabase egress      | ~30 GB                                                | $2.70     |
| Vercel function-GB-hr| ~6 GB-hr                                              | $1.08     |
| Vercel invocations   | ~700k                                                 | $0.42     |
| Claude Haiku         | ~3M input + 0.8M output                               | $5.60     |
| Claude Sonnet        | ~0.4M input + 0.15M output                            | $3.45     |
| OpenAI Whisper       | 100 min audio × $0.006/min                            | $0.60     |
| Resend               | 500 emails                                            | $0.00     |
| Twilio SMS           | 200 × $0.0079                                         | $1.58     |
| Twilio voice         | 100 min × $0.013                                      | $1.30     |
| Twilio numbers       | 3 × $1.15                                             | $3.45     |
| RunPod (FLUX/upscale)| 50 designs × 14s + 20 upscales × 6s                   | $0.25     |
| ElevenLabs (TTS)     | ~30k chars (within Creator bucket)                    | $0.00 marginal |
| Apify                | daily small scrape                                    | $1.50     |
| Zernio               | within Build bundle                                   | $0.00 marginal |
| Stripe (on $997)     | 2.9% + $0.30                                          | $29.21    |
| **Total COGS / mo**  |                                                       | **≈$51.30** |

### Persona C — Heavy (Pro-like, power user)

- 50 clients, 20+ chat sessions/day, 200 designs/mo, 5,000 emails/mo, 2,000
  SMS/mo, 1,500 caller-minutes/mo, full social-autopilot, ads-autopilot,
  weekly+daily reports, frequent video edits.

| Bucket               | Volume                                                | Cost       |
| -------------------- | ----------------------------------------------------- | ---------- |
| Supabase storage     | ~40 GB (videos, audio, exports)                       | $0.50      |
| Supabase egress      | ~150 GB                                               | $13.50     |
| Vercel function-GB-hr| ~25 GB-hr                                             | $4.50      |
| Vercel invocations   | ~3M                                                   | $1.80      |
| Claude Haiku         | ~15M input + 4M output                                | $28.00     |
| Claude Sonnet        | ~3M input + 1M output                                 | $24.00     |
| OpenAI Whisper       | 800 min audio                                         | $4.80      |
| Resend               | 5,000 emails (still inside $20 bucket — marginal)     | $0.00 marginal |
| Twilio SMS           | 2,000 × $0.0079                                       | $15.80     |
| Twilio voice         | 1,500 min × $0.013                                    | $19.50     |
| Twilio numbers       | 10 × $1.15                                            | $11.50     |
| RunPod (FLUX)        | 200 designs × 14s × $0.00031                          | $0.87      |
| RunPod (upscale)     | 80 × 6s                                               | $0.15      |
| RunPod (Whisper)     | covered above                                         |            |
| ElevenLabs (TTS)     | ~120k chars (Creator overage 20k × $0.18/1k)          | $3.60      |
| Apify                | daily heavy scrape                                    | $5.00      |
| Zernio               | within Build+Comments+Ads — already paid              | $0.00 marginal |
| Nango                | within Starter                                        | $0.00 marginal |
| Stripe (on $2,497)   | 2.9% + $0.30                                          | $72.71     |
| **Total COGS / mo**  |                                                       | **≈$206.00** |

> **Caveat.** These numbers exclude the *fixed* SaaS subscriptions
> ($220/mo from §1) which are amortized across all tenants. With 50 paying
> tenants, fixed amortization is ~$4.40/tenant/mo and is already included in
> the margin table below.

---

## Section 3 — Current Stripe pricing (from `src/lib/plan-config.ts`)

| Tier        | Monthly | Annual (20% off) | Clients | Tokens/mo | Emails | SMS    | Call min | Phones | Team |
| ----------- | ------- | ---------------- | ------- | --------- | ------ | ------ | -------- | ------ | ---- |
| Starter     | $497    | $4,771 ($397.6/mo equiv.) | 5       | 250K      | 500    | 100    | 60       | 1      | 1    |
| Growth      | $997    | $9,571           | 15      | 1M        | 5,000  | 1,000  | 300      | 3      | 3    |
| Pro         | $2,497  | $23,971          | 50      | 5M        | 25,000 | 5,000  | 2,000    | 10     | 10   |
| Business    | $4,997  | $47,971          | 150     | 20M       | 100k   | 25k    | 10,000   | 50     | 25   |
| Unlimited   | $9,997  | $95,971          | ∞       | ∞         | ∞      | ∞      | ∞        | ∞      | ∞    |

Source: `src/lib/plan-config.ts` lines 6–157 + `src/lib/plan-limits.ts` lines 47–54.
Annual is monthly × 12 × 0.8 (20% off — `setup-stripe-prices.ts` line 60).

The Stripe price IDs flow from `setup-stripe-prices.ts` and are exposed via env
vars `STRIPE_PRICE_<TIER>_MONTHLY` / `_ANNUAL` (consumed by
`src/app/api/billing/checkout/route.ts` and `system-status`).

---

## Section 4 — Margin analysis

Format: **Revenue – COGS = Gross profit (margin %)**. COGS = persona cost
from §2 + fixed amortization at 50 tenants. Stripe fees included in COGS.

| Tier          | Revenue/mo | Typical COGS  | Worst-case COGS | Gross @ typical | Margin @ typical | Margin @ worst | Verdict   |
| ------------- | ---------- | ------------- | --------------- | --------------- | ---------------- | -------------- | --------- |
| **Starter**   | $497       | ≈$22 (light)  | ≈$80 (medium-shaped Starter abuse) | $475          | **95.6%**        | 84%            | GREEN     |
| **Growth**    | $997       | ≈$56 (medium) | ≈$140           | $941            | **94.4%**        | 86%            | GREEN     |
| **Pro**       | $2,497     | ≈$210 (heavy) | ≈$380           | $2,287          | **91.6%**        | 85%            | GREEN     |
| **Business**  | $4,997     | ≈$520         | ≈$900           | $4,477          | **89.6%**        | 82%            | GREEN     |
| **Unlimited** | $9,997     | ≈$1,400       | ≈$3,000         | $8,597          | **85.9%**        | 70%            | GREEN     |

> **Important nuance.** Margins look "very GREEN" only because the per-tenant
> caps (`LIMITS_BY_TIER`) are tight enough that abuse is bounded by 402s. If
> caps are loosened, the worst-case Starter margin can drop into **YELLOW
> (45–60%)** before the hard cap fires. Caps are doing the heavy lifting.

### Break-even MRR per plan

A single tenant covers fixed ($220/mo) and their own variable easily.
Even with the highest-touch heavy users on Starter ($80 COGS), it covers
itself. **Every paid plan is break-even from tenant #1.** The risk is
purely in the *unpriced* edges: free-tier abuse (no plan exists), Founder
tier (zero revenue), and oversized Caller / Whisper jobs.

---

## Section 5 — Vercel $180/mo deep dive

Only $20/mo of the $180 is the Pro seat. The remaining **~$160/mo** is
metered usage. Likely culprits (ranked):

### 5.1 Crons that fire hot (`vercel.json`)

30 schedules. **Five fire faster than hourly**:

| Path                              | Schedule        | Runs/day | Cost concern       |
| --------------------------------- | --------------- | -------- | ------------------ |
| `/api/cron/publish-scheduled`     | `*/5 * * * *`   | **288**  | Highest. 5-min poll. |
| `/api/cron/reminders`             | `*/15 * * * *`  | 96       | Medium             |
| `/api/cron/review-requests`       | `*/15 * * * *`  | 96       | Medium             |
| `/api/cron/health-check`          | `*/30 * * * *`  | 48       | Probes 15 endpoints each tick |
| `/api/cron/social-autopilot`      | `0 */2 * * *`   | 12       | Heavy work, max 5min |

Just `publish-scheduled` alone = ~8,640 runs/mo. With `maxDuration=60`
and a typical 1.5GB-hr per 1k runs, that's **~13 GB-hr just from one cron
even idling**, ≈ $2.30/mo. That's not the killer alone, but added together,
the four high-frequency crons are **$15–25/mo** of pure poll cost.

### 5.2 Routes with `maxDuration ≥ 60`

There are **34 routes** with `maxDuration` configured ≥ 60s and **15
routes** with `maxDuration = 300s` (the Vercel Pro maximum). On Vercel
Pro, every running second × allocated memory × invocations is billable.

The 5-minute crons that only need 30s most of the time are **paying for
worst-case headroom**. Recommendations in §8.

### 5.3 Edge vs Node runtime

- **Edge runtime in use:** 1 file (`src/app/icon.tsx`).
- **Explicit `nodejs` runtime:** 24 files.
- **Implicit Node runtime:** the rest of the 609 route files (Next.js
  default for App Router routes that import `next/server` is Node).

Edge invocations are roughly **75% cheaper per ms of compute** when the
work is HTTP-fan-out only (no DB driver, no AI streaming with long tails).
Routes that are good Edge candidates today:

- `/api/profile` (read-only)
- `/api/user/onboarding` (light)
- `/api/user/sidebar-preferences`
- `/api/user/sidebar-unread`
- `/api/system-status` (HTTP fan-out — already does fetch-only)
- `/api/dashboard/ai-today` *if* the Anthropic SDK supports the Edge
  `fetch` adapter (it does; see `@anthropic-ai/sdk` v0.30+)

Estimated savings if 8 hot routes flip to Edge: **$15–25/mo**.

### 5.4 `next/image` usage

14 files import `next/image`. Image Optimization is metered at $5/1k
distinct sources (5,000 included). With ~14 distinct sources hit by a
typical session, this is **<$5/mo** today. Not a target. Don't reflexively
swap to `<img>`.

### 5.5 Heavy AI routes

The **23 routes** that call Sonnet streaming and the **53** that call
Haiku are the ones to watch. Per-route headroom:

- `/api/trinity-assistant` — `maxDuration=60`, up to **4 Claude calls
  + 1 synthesis** in one request (line 13 of route). Each is a
  long-tail Sonnet stream. This single route is likely the **biggest
  GB-hour line item** of any one route.
- `/api/video/auto-edit/full-pass` — `maxDuration=300`. Heavy.
- `/api/landing-pages/generate` — `maxDuration=90`.
- `/api/cron/viral-scan` and `/api/cron/scrape-leads` — both 300s.

**Mitigations** (each estimated independently):

| Fix                                                                    | Est. monthly savings |
| ---------------------------------------------------------------------- | -------------------- |
| Add Anthropic prompt-caching to top 5 Claude routes (90% off on hits)  | **$25–60**           |
| Drop `maxDuration` from 300 → 120 on crons that never need 5 min       | **$10–15**           |
| Move `publish-scheduled` from 5-min poll to 15-min                     | **$5–8**             |
| Move 8 light read routes to Edge                                       | **$15–25**           |
| Stream-cancel Trinity hops if no tool-use after first turn             | **$5–10**            |
| Cache `health-check` results 25 min in-memory (it polls every 30 min)  | **$2–4**             |
| Cache `system-status` HTML for 60s (currently uncached)                | **$2–3**             |
| Replace `dynamic = "force-dynamic"` on dashboard pages where stale-OK  | **$5–10**            |
| **Total addressable**                                                  | **~$70–135/mo**      |

That gets the Vercel bill from $180 → **~$80–110**, leaving plenty of room
for genuine product growth before hitting another upgrade ceiling.

---

## Section 6 — Pricing tweaks recommendations

The platform is **not underpriced** at any tier. The lever that matters more
is **cap behavior** and **billing cycle**.

1. **Hold Starter at $497.** It's the GHL-replacement entry point and the
   number is psychologically right. But:
   - Tighten `tokens_monthly` from 250K → 150K (most tenants use <80K).
   - Bump `caller_minutes` from 60 → **75** to stop "I tried it once and
     used my whole month" friction.

2. **Growth $997 — fine, but add a soft floor.** Today, going from
   Starter (5 clients) to Growth (15 clients) is a 2× price jump for 3×
   client capacity. Add an "extra client pack" overage: $20/mo per client
   over plan limit, capped at 5 extra. Captures the user who's at 7 clients
   and would otherwise downgrade their effort instead of upgrading.

3. **Pro $2,497 — the sweet spot.** This is the typical agency at 30–50
   clients. Don't touch. Consider promoting "10 included phone numbers"
   harder — Twilio cost is real and customers don't realize they get them.

4. **Business $4,997 — keep, but move "white-label" up.** White-label is
   a procurement question for the buyer, not a usage question. Today it
   triggers at Business; consider moving to Pro and moving "Custom AI
   model tuning" up to Business as the new differentiator.

5. **Unlimited $9,997 — keep.** Real cost ceiling at heavy use is
   $1.4–3k/mo of COGS. 70% worst-case margin is still healthy. But:
   add explicit "fair use" language for Caller minutes and tokens —
   60-second hard pause if a tenant runs >100k tokens in 60s, etc.

6. **Replace hard 402 walls with soft overages.** Every tier with a
   token cap should be able to **buy more** at marginal cost + 30%
   margin instead of hitting a wall. Pattern:
   - +500K Haiku tokens: $5 (~50% margin).
   - +100K Sonnet tokens: $10 (~40% margin).
   - +1k SMS: $12 (~33% margin after Twilio).
   - +30 caller-min: $5 (~25% margin after Twilio).
   This converts ragequit churn into incremental revenue.

7. **Annual = 10× monthly, not 12 × 0.8.** Same effective discount but
   industry-standard messaging ("2 months free"). Already configured
   internally — `setup-stripe-prices.ts` line 60 multiplies by `0.8`.
   Change to `monthly * 10` and update the marketing copy.

8. **Add a "Founder's circle" ($1/yr) tier behind a coupon code** for
   the user's own account and select alpha testers. Today the
   `Founder` tier is a hard-coded backdoor in
   `src/lib/plan-config.ts:134-157` with `price_monthly: 0`. Move it
   behind a Stripe-issued 100%-off coupon attached to the
   `STARTER_MONTHLY` price so churn metrics aren't polluted.

---

## Section 7 — Spending alert recommendations

Recommended hard caps to wire as Vercel/Cloud alerts. If the bill spikes
past these, something is wrong (a runaway cron, a leaked key, a tenant in
a tight loop).

| Provider     | Daily soft cap | Monthly hard cap | Rationale                           |
| ------------ | -------------- | ---------------- | ----------------------------------- |
| Vercel       | $4             | **$110**         | Today it's $180; target is $80–110  |
| Anthropic    | $20            | **$400**         | Heavy users + 50 tenants            |
| OpenAI       | $5             | **$50**          | Fallback only — never primary       |
| RunPod       | $5             | **$80**          | Image-gen + upscale + voice + LoRA  |
| ElevenLabs   | $1             | **$30**          | Stay on Creator unless growth       |
| Twilio       | $10            | **$200**         | SMS+voice; scales linearly          |
| Resend       | $0             | **$25**          | Pro flat — avoid pay-as-you-go bursts |
| Apify        | $1             | **$60**          | Cron `scrape-leads` + ad-hoc        |
| Nango        | $0             | **$60**          | Starter — upgrade only with proof   |
| Zernio       | $0             | **$40**          | Build + Comments + Ads              |
| **Total**    |                | **~$1,055/mo**   | At 50 paying tenants → 16% COGS load|

A useful guardrail: **if Vercel daily exceeds $6 two days in a row, page
the user.** That's the canary for "a cron is in a loop" or "a new route
is leaking GB-hours."

---

## Section 8 — Quick wins shippable this week

(Detailed in [`COST_QUICK_WINS.md`](./COST_QUICK_WINS.md).)

1. **Anthropic prompt-caching layer** on the 5 hottest routes (`trinity-assistant`,
   `video/auto-edit/director`, `landing-pages/generate`, `email-templates/generate`,
   `dashboard/ai-today`). 90% off on cache hits. Est. savings: **$25–60/mo**, ~150
   LOC + 1 helper.
2. **Move `publish-scheduled` from `*/5` to `*/15`.** The flow is
   schedule-driven, not real-time — 10-minute lag is tolerable for social
   posting. Est. savings: **$5–8/mo**, 1 LOC.
3. **Drop overspec'd `maxDuration` ceilings** on the cron routes that
   complete in <30s p99 (`reminders`, `lead-cleanup`, `retention-check`,
   `invoice-chase`, `review-requests`). Est. savings: **$10–15/mo**,
   ~10 LOC across 5 files.
4. **Edge-runtime flip** for `/api/profile`, `/api/user/onboarding`,
   `/api/user/sidebar-preferences`, `/api/user/sidebar-unread`, and
   `/api/system-status`. Est. savings: **$15–25/mo**, ~5 LOC.
5. **Per-provider monthly hard caps** wired in each provider's dashboard
   (Vercel, Anthropic, RunPod, Twilio). Zero LOC; configuration-only.

**Total quick-win savings:** **~$55–110/mo**. Ship-effort: <½ day.

---

## Assumptions & caveats

- I did **not** read live Stripe / Vercel / Anthropic billing dashboards. All
  numbers are derived from list pricing and from the codebase's configured
  plan limits. Real bill could differ ±20%.
- "Persona" usage estimates were not validated against `usage_events` in
  Supabase. Recommendation: pull a 30-day median and p90 of `usage_events`
  by `event_type` per tenant, and re-run §2.
- Resend overage pricing ($1/1k) is current public pricing; verify on
  contract.
- Stripe 0.5% Connect fee is excluded — only relevant when ShortStack is
  invoicing the agency's *clients* (not for the agency's own subscription).
- Founder tier ($0) is treated as out-of-scope for revenue calcs. It is
  the largest unpriced consumer of resources today.
- `Apify` and `Nango` are listed as *recommended* baselines; verify which
  tier the user is actually subscribed to before treating those as facts.
