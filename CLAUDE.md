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

## Commit style

Format: `<type>(<scope>): <subject>` — type ∈ feat / fix / sec / docs /
chore / perf / ci / refactor / brand. Body explains the **why**, not
just what. Cite line numbers + commit hashes for context. Keep subject
under 72 chars. **No emojis in commit messages.**

Co-author tag at the bottom of every commit:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

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
