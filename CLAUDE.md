# ShortStack OS — Project Context for Claude Code

> Single source of truth for AI agents working in this repo. Loaded automatically
> at session start. Keep tight — every line is read on every session.

## What this is

ShortStack OS (also branded **Trinity**) is an agency operating system for solo
agency owners and small teams. **Stack:** Next.js 14 App Router + TypeScript
strict + Tailwind + Supabase (Postgres + Auth + Storage + Realtime) + Vercel.
Hybrid web + Electron desktop app.

**Production domain:** https://app.shortstack.work
**Repo:** https://github.com/nicklaspaulsen-glitch/shortstack-os
**Active worktree:** `C:\Claude\shortstack-merge` (this is where work happens —
the `shortstack-os` parent repo at `C:\Claude\shortstack-os` is behind by
~25 commits and should NOT be edited).

## Critical operational facts (read once, cite often)

- **Supabase project ID:** `jkttomvrfhomhthetqhh` (eu-west-2). Use the
  `mcp__8fb03bb5-...` Supabase MCP for migrations. Never hand-edit DB
  schema; always go through `apply_migration`.
- **Vercel project ID:** `prj_QItTb3oaVz7NbAz85fVSEbtij9mP`,
  team `team_17XswmnMpNJxm8qbRxVxlyAH`.
- **Active deploy aliases:** `shortstack.work`, `app.shortstack.work`,
  `shortstack-os.vercel.app`. All point at the latest production deploy.
- **Auth:** Supabase JWT. `createServerSupabase()` runs as the user; RLS
  enforces ownership. `createServiceClient()` bypasses RLS — only use
  for webhooks and trusted server-only paths.
- **AI:** Anthropic SDK via shared `src/lib/ai/claude-helpers.ts`
  singleton. **Never** construct `new Anthropic()` directly — use the
  helper. Same rule for Stripe (`src/lib/stripe/client.ts` →
  `getStripe()`).
- **Module-level SDK init is BANNED.** `new Stripe(process.env.X || "")`
  at module top breaks Vercel build during page-data collection on SDK
  bumps. All SDK clients are lazy. Pattern enforced via `getStripe()` /
  shared `anthropic` singleton.

## Build / typecheck / test

The merge worktree (`shortstack-merge`) has no `node_modules` of its own —
it relies on the parent worktree's install via a junction. If
`node_modules` is missing, run `npm install` here directly (not in
parent). Then:

```bash
npx tsc --noEmit          # typecheck
npx eslint .              # lint
npx vitest run            # tests
```

ESLint is configured to NOT fail Vercel builds (`eslint.ignoreDuringBuilds:
true` in next.config). TypeScript errors DO fail the build —
`typescript.ignoreBuildErrors` stays at default `false`. So `tsc --noEmit`
green is the deploy gate.

## Pixel Agent Office

Live, animated, top-down pixel-art office at `/dashboard/agent-office`
that replaces the old `/dashboard/agent-room` (the sidebar entry was
relabelled "Agent Office" but the underlying route is the new one). 10
agents are rendered as 32×32 pixel characters in a 24×14 grid; every
animation is driven by **real Supabase realtime events** — never canned.

- Renderer: **PixiJS v8** dynamically imported, mounted client-side only.
  60fps when focused, 30fps unfocused, fully suspended when the tab is
  hidden.
- All sprites are drawn procedurally in `src/lib/pixel-office/sprite-atlas.ts`
  (no binary assets shipped — see `extensions/pixel-office/ASSET_CREDITS.md`).
  Original art, CC0-licensed by the project.
- Realtime channel partition by `agency_owner_id` resolved server-side via
  `getEffectiveOwnerId()`. Watched tables: `voice_calls`, `coach_analyses`,
  `lead_scores`, `lead_score_history`, `contact_validations`,
  `cold_email_jobs`, `outreach_log`, `news_triggers`, `scheduled_posts`,
  `content_calendar`, `thumbnail_jobs`, `ad_optimization_runs`,
  `trinity_actions`, `trinity_proposals`, plus the dedicated
  `agent_activity_events` log.
- Producers can write directly to `agent_activity_events` (RLS-scoped) for
  bespoke event types — see migration `20260427_pixel_office_events.sql`.
  The pixel office subscribes to the table and trusts the `agent_key` +
  `summary` columns verbatim.
- Two server routes: `GET /api/agent-office/snapshot` (initial hydration —
  recent events, per-agent history, hero stat counters) and
  `GET /api/agent-office/events?agent_key=...` (paginated panel feed).
  Both auth-gated with `getEffectiveOwnerId`.

## Sidebar / page architecture

- All admin/agency pages live under `src/app/dashboard/*/page.tsx`.
  ~100 of them. Sidebar entries in `src/components/sidebar.tsx`.
- All client portal pages under `src/app/dashboard/portal/*/page.tsx`.
  Simpler aesthetic by design — keep them lighter than agency pages.
- **Shared `<PageHero>`** at `src/components/ui/page-hero.tsx` is on
  every dashboard page (gold/blue/purple/green/sunset/ocean gradients).
  Has motion polish: orbit-glow blobs, sparkle particles for
  premium-feel surfaces. **Use it for any new page** — don't roll your
  own header.
- **Shared `<StatCard>`** at `src/components/ui/stat-card.tsx`. Use for
  any number-display tile.
- **`<AdvancedToggle>`** + `useAdvancedMode("page-key")` from
  `src/components/ui/wizard.tsx`. Use on every "guided wizard / advanced
  full form" page.

## Skill routing — when user says X, use Y

When the user's request matches an available skill, **invoke it via the
Skill tool as your FIRST action** before answering. Skills produce better
results than ad-hoc work.

- "ship it / deploy / push to main / create PR" → `/ship`
- "find bugs / qa / test the site / does this work?" → `/qa`
- "code review / check my diff / pre-landing review" → `/review` or
  `/code-review`
- "security audit / scan for vulnerabilities" → `/cso` (deep) or
  `/security-review` (focused)
- "health check / code quality dashboard" → `/health`
- "investigate this bug / why is X broken / 500 error" → `/investigate`
- "design / brand / visual polish" → `/design-consultation` (system),
  `/design-review` (audit), or `/design-shotgun` (variants)
- "save progress / context save" → `/context-save`
- "resume / where was I" → `/context-restore`
- "extract patterns from this session as skills" → `/learn`
- "run all reviews / autoplan" → `/autoplan`
- "weekly retro" → `/retro`
- "delegate this to GPT / second opinion" → `/codex:rescue` or
  `/codex:review` (requires `codex login` first)
- TDD / write tests first → `/tdd`

### Auto-route to /agent (Opus+GPT-5 loop, silent by default)

These phrases mean the user wants the **dual-model loop** that uses
Opus to plan, Sonnet to draft, and GPT-5 (codex CLI) to adversarially
review across multiple rounds until SHIP. Default to silent mode —
only the final commit + verdict surfaces in the chat. Full transcript
goes to `/tmp/agent-<slug>-<ts>.md`. Override with `verbose:` prefix.

- "find every bug" / "find every CRITICAL" / "deep bug hunt" → `/agent`
- "fix this hard refactor" / "I'm stuck on X" → `/agent`
- "harden X" / "audit X for security" / "close the IDOR" → `/agent`
- "make X bulletproof" / "production-ready X" → `/agent`
- ambiguous high-stakes asks → ask once "run through /agent (codex+opus
  loop) or single-model?" then proceed.

## Commit style

Format: `<type>(<scope>): <subject>` — type ∈ feat / fix / sec / docs /
chore / perf / ci / refactor / brand. Body explains the **why**, not
just what. Cite line numbers + commit hashes for context. Keep subject
under 72 chars. **No emojis in commit messages.**

Co-author tag at the bottom of every commit:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Voice profiles + humanizer (Apr 27)

Per-user (and per-client) writing voice learning + AI-output humanization:

- **Use `callLLMHumanized`** (`src/lib/ai/call-llm-humanized.ts`) instead of
  `callLLM` whenever the model produces user-visible text. It auto-injects
  the caller's voice snippet into the system prompt and runs the output
  through the humanizer to strip AI tells.
- **Defaults:** `humanize: true` for content surfaces (briefs, follow-ups,
  proposals). Pass `humanize: false` for analysis surfaces returning JSON
  (coach insights, classifiers).
- **Voice gate:** profiles need ≥200 words of corpus before they kick in
  (`VOICE_MIN_CORPUS_WORDS`). Capture is fire-and-forget.
- **Cron:** `*/30 * * * *` → `/api/cron/recompute-voice-profiles`.
- **Tables:** `writing_voice_corpus` + `writing_voice_profiles` (distinct
  from the audio `voice_profiles`).
- **UIs:** `/dashboard/settings/voice-profile` and the "Voice" tab on
  `/dashboard/clients/[id]`.

## Agent memory + tracing

ShortStack ships with two opt-in observability layers wired into the LLM
router (`src/lib/ai/llm-router.ts`):

- **Mem0** (`src/lib/ai/mem0-client.ts`) — long-term agent memory. Memories
  are stored in Mem0's backend and mirrored into the local `agent_memories`
  audit table. Scoped per `(agency_owner_id, subject_kind, subject_id)`
  tuple. Memories require ~200 words of subject context to bootstrap.
- **Langfuse** (`src/lib/ai/langfuse-client.ts`) — every `callLLMTraced`
  invocation produces a Langfuse trace with input/output/latency/tokens/cost.
  Mirrored into `agent_trace_index`. Visible at
  `/dashboard/admin/agent-traces` (admin/founder only).

**Both soft-fail.** With `MEM0_API_KEY` / `LANGFUSE_*_KEY` unset, the system
runs unchanged — `callLLMTraced` reduces to `callLLM`, no rows written.

To opt in on a new AI surface, switch from `callLLM` to `callLLMTraced` and
pass `surface`, optional `subject`, `withMemory: true`, `storeMemory: true`.
**Follow-up:** `callLLMTraced` should internally wrap `callLLMHumanized`
(not raw `callLLM`) so both layers compose. Tracked in PR #56 follow-up.

## Conventions worth knowing

- **No `console.log` in production code.** Use `console.error/warn` with
  bracketed prefix `[component-name] message` for ops visibility.
- **No module-level env-var reads that throw.** Always use a getter or
  fallback. See the Stripe lazy-init refactor (commit `971352c`) for the
  pattern.
- **All inbound webhooks must be signature-validated** in production
  (fail-closed 503 if the secret env var is missing). Pattern: see
  `/api/webhooks/resend/route.ts` (Svix) and
  `/api/webhooks/elevenlabs/route.ts` (HMAC).
- **`page.tsx` files use `<PageHero>`** unless intentionally simpler
  (Conversations is a 3-pane Gmail-style inbox; portal pages are
  intentionally lighter).
- **No `<img>` for new images** — use `next/image`. Existing `<img>`
  tags are deferred for a future perf pass.
- **No `: any`** in new code. Use `unknown` + narrowing, or define a
  type. Existing `: any` (~21 occurrences) is deferred.

## Brand & design tokens

The visual foundation is locked. Authoritative source:
**`src/lib/brand/tokens.ts`** — import from there in TS/TSX. Tailwind
mirrors the same hex values via `tailwind.config.ts`; CSS variables in
`src/app/globals.css` mirror them again at `:root`.

Direction: **Editorial Bento × OLED Dark × 3D Depth × Liquid-Glass Accents**.

### Locked color palette
- **Brand: ACID LIME** `#D4FF00` — *deliberately not gold*. Do **not**
  introduce gold/amber accents in new pages. Old `text-gold-*` and
  `text-amber-*` aliases now resolve to lime — they remain only for
  back-compat on existing pages.
- **Surfaces:** `--bg-base #0A0A0B` (warm-tinted OLED black),
  `--bg-surface-1 #15141A`, `--bg-surface-2 #1F1E26`,
  `--bg-surface-3 #2A2832`.
- **Borders:** every border carries a faint lime tint —
  `--border-subtle rgba(212,255,0,0.08)` /
  `--border-strong rgba(212,255,0,0.18)`.
- **Text:** `--text-primary #F5F4F1` (softened off-white, never pure
  `#FFFFFF`), `--text-secondary #9F9DAA`, `--text-muted #6F6D7A`.
- **Editorial complement:** deep plum `--brand-plum #3F0D2D` — replaces
  generic Tailwind purple.
- **Single chromatic moment:** indigo `--brand-indigo #5E5BFF` for focus
  rings + links.

### Font stack (locked)
- **Satoshi** — display only (page titles, hero numbers, big counters).
  Use the `font-display` class.
- **Inter** — body, labels, tables, default. Set on `<body>`.
- **Bodoni Moda** — *reserved* for hero/marketing one-off statements
  only. Never set as body. Use the `font-editorial` class. The
  `<PageHero>` `eyebrow` slot uses Bodoni Moda by default.

### Motion principles
- Standard duration: **220ms** `cubic-bezier(0.32, 0.72, 0, 1)`
  (smooth ease-out). Tailwind: `duration-220 ease-out-expo-foundation`.
- Hero reveal: **480ms** with 60ms stagger between siblings.
- Route transitions: **320ms** cross-fade.
- `prefers-reduced-motion: reduce` → cap to 100ms, disable transforms.

### Stack 3D mark
The signature brand mark — three lime-edged stacked rectangular blocks
at slight rotation. Component: `src/components/brand/stack-3d.tsx`.
Use exactly this pattern, do not invent variations:
```tsx
import Stack3D from "@/components/brand/stack-3d";
<Stack3D size="md" rotating />
```
Permitted surfaces: login screen (size `lg`), empty states (`sm`),
`<PageHero showStack3D />` (`sm` or `md`), 404 / loading. Avoid
sprinkling it across content surfaces — it loses meaning when overused.

### Grain overlay
For the analog "anti-AI-slop" texture on full-bleed surfaces, drop
`<GrainOverlay />` from `src/components/brand/grain-overlay.tsx` once
inside the root layout's `<body>`. Opacity 0.03, mix-blend-mode overlay,
pointer-events: none. The component itself is server-safe.

### Existing color names (back-compat shim)
The 100+ pages still use the original Tailwind class names. Those stay
registered in `tailwind.config.ts` and now point to the new palette:
- `text-gold-*` / `bg-gold-*` / `border-gold-*` → lime scale
- `text-amber-*` / `bg-amber-*` / `border-amber-*` → lime scale
- `text-purple-*` / `bg-purple-*` / `border-purple-*` → plum scale
- `text-indigo-*` / `bg-indigo-*` / `border-indigo-*` → indigo scale

For **new code**, reference the canonical brand-foundation classes
(`bg-brand-lime`, `border-border-subtle`, `text-text-primary`, etc.) or
import `tokens` from `@/lib/brand/tokens`. Do not introduce new uses of
the legacy `gold`/`amber`/`purple` shade names.

## What NOT to do without asking the user

- DO NOT run `npm install` in `shortstack-os` (parent worktree). All
  installs go through `shortstack-merge`.
- DO NOT touch CRON_SECRET, SMTP_PASS, RESEND_WEBHOOK_SECRET,
  ELEVENLABS_WEBHOOK_SECRET, or any other production secret.
- DO NOT push to `main` without (a) the user explicitly asking, or
  (b) the change being clearly bug-fix-only-no-behavior-change. For
  feature work or risky refactors: branch + push + preview deploy +
  surface the URL for the user to test.
- DO NOT modify `vercel.json` cron schedule or paths without checking
  the cron-handler route exists. Phantom crons fire silently in prod.

## Workflow Library (Apr 27)

12 production-ready, tested automation templates ship out of the box.

- **Registry:** `src/lib/workflows/templates.ts` (TEMPLATES + helpers)
- **Copy:** `src/lib/workflows/template-copy.ts` (email/SMS/Slack/note bodies)
- **Action handlers:** `src/lib/workflows/library-actions.ts` (`LIBRARY_ACTIONS`)
- **Install API:** `POST /api/workflows/templates/install`
- **List API:** `GET /api/workflows/templates`
- **UI:** `/dashboard/automations/library`
- **Tests:** `src/__tests__/workflow-library.test.ts` — 35 integration cases
- **Migration:** `supabase/migrations/20260427_workflow_library.sql`
  (adds `workflows.installed_from_template_id`, `workflow_waits`, `email_drafts`)

Each handler in `LIBRARY_ACTIONS` actually calls its provider — no
"would_send_email" stubs. Handlers always return `{ ok, ref_id?, error? }`
and never throw, so workflow execution stays robust against partial
provider outages.

## Tomorrow's todo file

The active context lives at:
`C:\Users\Nicklas\.claude\projects\C--Claude\memory\shortstack_tomorrow_apr27.md`

Always read the top of that file at session start — it has the
prioritized "do this first" shortlist + everything in flight.

## Health Stack

For `/health` skill auto-detection:
- typecheck: `npx tsc --noEmit`
- lint: `npx eslint .`
- test: `npx vitest run`
- (no knip, no shellcheck — not installed)
