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
`callLLMTraced` internally wraps `callLLMHumanized`, so the same call also
accepts `voiceProfile`, `humanize` (default true), and `channel` for
voice-injection + AI-tell stripping. Pass `humanize: false` for JSON outputs.

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

Direction: **Dark OLED × Glassmorphic × Blue Accent** (May 16 Higgsfield overhaul).
`:root` is now deep navy OLED dark by default. Light theme available via
`[data-theme="light"]` / `.theme-light`. The dark frosted glass aesthetic
applies globally — pill buttons, glass panels, split-pane layouts.

### Locked color palette — dark theme (`:root`, the default)
- **Brand accent: BLUE** `#3B82F6` — primary accent on dark OLED surfaces.
  Three variants: `#3B82F6` (primary), `#60A5FA` (hover/soft),
  `#2563EB` (dim/pressed). Do **not** introduce red/gold/amber/lime accents.
- **Surfaces (dark OLED):** navy glass panels on `#0D1120` base.
  `--bg-base #0D1120`, `--bg-surface-1 #131827`, `--bg-surface-2 #1C2338`.
- **Borders:** `--border-subtle rgba(99,146,255,0.10)` /
  `--border-strong rgba(99,146,255,0.22)` (blue-tinted for depth).
- **Text:** `--text-primary #F0F0F4`, `--text-secondary #A8A8B2`,
  `--text-muted #4A4A5A`.
- **Glass tokens:** `--glass-bg rgba(19,24,39,0.85)`, `--glass-blur blur(16px) saturate(160%)`.
  Use `.glass-panel` utility class for frosted containers.
- **Pill buttons:** `.btn-pill` (filled blue) / `.btn-pill-ghost` (outlined).
  Tab strips: `.tab-pill-strip` + `.tab-pill` + `.tab-pill.active`.
- **Accent alias:** `--brand-lime` is a back-compat alias that resolves
  to `#3B82F6` on dark. Do not use it in new code.

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
The signature brand mark — a 3-tier stacked-shape glyph (MandalaMark)
with a slow CSS rotateY spin. Component: `src/components/brand/stack-3d.tsx`
wraps `src/components/brand/mandala-mark.tsx`. The SVG fill uses
`currentColor`, so the mark inherits the parent's CSS color (off-white on
dark sidebar, near-black on light pages, blue on active/accent surfaces).
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
registered in `tailwind.config.ts` and now point to the blue brand accent:
- `text-gold-*` / `bg-gold-*` / `border-gold-*` → blue brand scale
- `text-amber-*` / `bg-amber-*` / `border-amber-*` → blue brand scale
- `text-purple-*` / `bg-purple-*` / `border-purple-*` → charcoal/plum scale
- `text-indigo-*` / `bg-indigo-*` / `border-indigo-*` → blue brand scale
- `bg-brand-lime` / `text-brand-lime` / `border-brand-lime` → blue brand scale

For **new code**, reference the canonical brand-foundation classes
(`bg-brand-accent`, `border-border-subtle`, `text-text-primary`, etc.) or
import `tokens` from `@/lib/brand/tokens` (`tokens.brand.accent = "#2563EB"`).
Do not introduce new uses of the legacy `gold`/`amber`/`purple`/`lime`
shade names.

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

- **Registry:** `src/lib/workflows/templates.ts`
- **Action handlers:** `src/lib/workflows/library-actions.ts` (no stubs)
- **Install API:** `POST /api/workflows/templates/install`
- **UI:** `/dashboard/automations/library`
- **Tests:** 35 integration cases in `src/__tests__/workflow-library.test.ts`

## Transcription pipeline

Transcription routes through `src/lib/transcription/router.ts`. Provider order:
WhisperX (with diarization) → faster-whisper → OpenAI Whisper. Soft-fails to
existing `OPENAI_API_KEY` path when RunPod endpoints unset.

## Voice Studio

`/dashboard/voice-studio` — voice cloning + preset library powering the
dialer / voicemail drops / SMS MMS / DM voice notes. See
`docs/VOICE_CLONING_SETUP.md` for endpoint deployment details.

- Provider order: F5-TTS (RunPod, free) → OpenVoice (RunPod, free) → XTTS
  (RunPod, free) → ElevenLabs (paid, also powers presets).
- Consent gates: `self` | `team_member_signed` | `client_signed`.
- 10 ElevenLabs presets are seeded per-owner on first dashboard mount.
- Audio cache: hash of (text, format, speed) → R2 key.
- Cron polling RunPod async jobs: `*/2 * * * *` → `/api/cron/voice-clone-poll`.
- TCPA disclosure toggle is in the dialer voice picker.

## Branded welcome email + getting started (Apr 27)

Per-agency transactional email templates + a public per-agency getting-started
doc page. Multi-tenant: every agency owner customizes their OWN welcome email,
team-invite, trial-signup, magic-link, and password-reset templates with their
logo + brand color from `white_label_config`, and clients see THE AGENCY'S
branding when those emails arrive.

- **Defaults ship pre-filled.** `src/lib/email-templates/defaults.ts` has
  hand-written, warm-not-corporate copy for all five kinds. An agency does
  NOT have to customize before clients can be onboarded.
- **Templates live per-agency in `email_templates`.** A row only exists if
  the agency customized that kind; reverting a template deletes the row and
  restores the default.
- **Variables resolved server-side at send time.** `resolveTemplateVars` reads
  white_label_config + profile + (optional) client/team-member rows and
  builds a `{agency_name, logo_url, brand_color, owner_first_name,
  client_first_name, portal_url, getting_started_url, ...}` map.
  Mustache-style `{{var}}` substitution; missing keys resolve to "" so a
  recipient never sees a raw placeholder.
- **Editor at `/dashboard/settings/email-templates`** — tabs across the five
  kinds, two-pane editor with live iframe preview, "Send test to me" button,
  and "Reset to default".
- **Getting Started editor at `/dashboard/settings/getting-started`** — hero
  fields, sections with up/down reorder, FAQ, public/private toggle.
- **Public page at `/getting-started/[ownerSlug]`** — `ownerSlug` is the
  agency owner's user id (no separate slug in v1). ISR with `revalidate = 60`,
  uses anon Supabase client; `getting_started_public_read` RLS policy filters
  to `is_public = true`. Branded with the agency's logo + primary color.
- **Wired into `/api/clients/onboard`**: right after the client row inserts,
  `sendBrandedWelcomeEmail` fires fire-and-forget. Soft-fails — never blocks
  onboarding.

## Tomorrow's todo file

The active context lives at:
`C:\Users\Nicklas\.claude\projects\C--Claude\memory\shortstack_tomorrow_may3.md`

Always read the top of that file at session start — it has the
prioritized "do this first" shortlist + everything in flight.

## Health Stack

For `/health` skill auto-detection:
- typecheck: `npx tsc --noEmit`
- lint: `npx eslint .`
- test: `npx vitest run`
- (no knip, no shellcheck — not installed)

## Browser Worker (AI agent → real browser)

`src/lib/browser-worker/` houses the autonomous browser agent: Claude
calls Playwright tools (click/type/navigate/extract/done) until the goal
is met. Each step screenshot uploads to R2; the trace plays back in
`/dashboard/automations/browser-tasks/[id]`.

- **Default mode:** local-headless Chromium on the Vercel function
  (`maxDuration = 300`). Free, but capped at ~5 min per task.
- **Long-running:** set `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID`
  to route to Browserbase (not yet wired — env vars are reserved; deferred
  to v2 along with self-hosted Playwright on RunPod / Hetzner).
- **Safety rails:** 30-step default cap (max 100), $1 USD cost cap per
  task (kills the loop if exceeded), domain allowlist optional, password
  fields blocked unless `allow_passwords` flag set on the task.
- **Storage:** every step screenshot uploads to R2 under
  `browser-worker/{taskId}/step-NNN.png` via the existing `uploadToR2`
  helper. Public URLs assembled with `NEXT_PUBLIC_R2_PUBLIC_URL`.
- **Cron:** `/api/cron/run-browser-tasks` runs every minute, picks up
  3 queued tasks per tick, fail-closed 503 when `CRON_SECRET` is unset.
- **Tool-calling:** uses the shared `anthropic` singleton from
  `claude-helpers.ts` directly because the LLM router doesn't support
  tools yet. Sonnet 4.6 (vision + tool use).

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
