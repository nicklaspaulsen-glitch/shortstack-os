---
description: "Hybrid Opus(plan) + Sonnet(code) + GPT-5(review) agent. Token-tight direct-DM protocol. SILENT BY DEFAULT (only final commit hash + verdict surfaces). Use for hard tasks. Per-task transcript at /tmp/agent-<slug>-<ts>.md."
---

# /agent <task>

A "model" you can pick that's actually three models in lockstep, each playing to its strength:

- **Claude Opus 4.7** → planner only. Picks the target, names the signals, writes the spec. Short outputs, expensive per token, used sparingly.
- **Claude Sonnet 4.6** → coder. Reads the plan, runs the scans, writes the code, applies the fixes. Cheap per token, does the bulk of the work.
- **GPT-5** (via codex CLI) → adversarial reviewer. Reads the patch, returns SHIP / HOLD with concrete blockers.

Output protocol: **direct DMs only** — no preamble, no fluff, terse exchanges, structured signals.

## Why split it this way

Opus is best at strategy — short, dense, opinionated outputs. It is the most expensive model per token, so we pay for those tokens only when we need its judgement (which target to pick, which approach to take, how to structure a fix). Sonnet is the best coding model and an order of magnitude cheaper, so it does the bulk of the tool calls, file reads, and edits. GPT-5 catches what Sonnet misses.

If the orchestrator session is running on Opus (the default for /agent), doing the implementation inline burns Opus tokens on every Read/Grep/Edit. Delegating implementation to a Sonnet sub-agent (`Agent(model: "sonnet", ...)`) keeps the bulk of the work on the cheaper model and only relays the result back to Opus.

## Silent mode (default) — saves your context tokens

By default, only ONE message surfaces in the user's CC chat — the final ship report. All round-by-round chatter (Opus picks target, codex review verdict, fix iterations) goes to a transcript file at `/tmp/agent-<slug>-<ts>.md` and is referenced by path in the final report. The user can `cat` it if they want detail.

The final message includes:
- ✅/❌ ship/hold verdict
- Commit hash + branch
- Files touched (count + top 3)
- Bugs caught by codex per round (count)
- Token cost estimate
- Path to full transcript
- Vercel deploy state (if push triggered a build)

**To override** and show round-by-round in chat: prefix the task with `verbose:` — e.g. `/agent verbose: find every CRITICAL bug`.

## Auto-routing — invoke without typing /agent

Per the project's `CLAUDE.md` skill-routing rules, certain trigger phrases now auto-invoke this command:

| User says | Auto-invokes |
|---|---|
| "find every bug" / "find every CRITICAL" / "deep bug hunt" | `/agent` |
| "fix this hard refactor" / "I'm stuck on" / "second opinion on" | `/agent` |
| "harden X" / "audit X for security" | `/agent` |
| "review my diff" / "code review" | `/review` (single-model) |

If unsure, ask the user "should I run this through /agent (codex+opus loop) or single-model?" before starting.

This is different from `/dual-plan` which is a one-shot plan-and-merge. `/agent` is a loop until ship-or-bust:

```
   Opus       — terse target / hypothesis
     ↓
   Sonnet     — research / scan / first draft (you, the orchestrator)
     ↓
   GPT-5      — adversarial review (verdict: ship | hold + concrete blockers)
     ↓
   if hold:   loop back to Sonnet with the blockers
   if ship:   commit + push
```

## When to use it

- Security fixes (use it like the round-9 mutation-IDOR collab — codex caught 6 real bugs across 4 rounds Sonnet alone would have missed)
- Hard architectural decisions where being wrong is expensive
- Large refactors with many cross-cutting concerns
- "I'm stuck" prompts where the second-model perspective unsticks

NOT for:
- Trivial edits (renames, comment fixes)
- Documentation-only changes
- Tasks where one model is obviously enough

## The protocol — direct DMs only

Every roundtrip uses **structured terse output**. No prose. Each model sees ONLY the previous turn, never the full conversation, to keep token cost down.

### Phase 1 — Opus picks the target

Use the Agent tool with `model: "opus"` and `subagent_type: "general-purpose"`. Prompt template:

```
TASK: <user's task>

Output protocol: terse, no preamble, no markdown. Direct DMs only.

Pick exactly ONE area to focus on, give top-3 concrete signals to look for. Format:

AREA: <one phrase>
SIGNAL1: <regex / file path / function name>
SIGNAL2: <same>
SIGNAL3: <same>
WHY: <one sentence>

Total response: under 80 words.
```

### Phase 2 — Sonnet does the work

**Delegate to a Sonnet sub-agent via the Agent tool with `model: "sonnet"`.** Do NOT do the implementation inline if the orchestrator session is running on Opus — that burns Opus tokens on every Read/Grep/Edit/Bash call.

```
Agent({
  description: "Implement Opus's plan",
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: `<paste Opus's AREA + SIGNAL1-3 + WHY block>

Run the scans, read the code, write the fixes per the signals above. When done, output:
  PATCH: <git-diff-style summary, file-by-file>
  TODO: <anything blocked or deferred>

Cap response at 400 words. The orchestrator will pipe your patch to GPT-5 for adversarial review.`
})
```

The Sonnet sub-agent has the full tool set (Read, Grep, Edit, Bash, etc.) and can do everything inline. Its result is the patch summary that the orchestrator forwards to GPT-5. Each follow-up round (after a HOLD) re-invokes Sonnet with the codex blockers — again as a sub-agent, again cheaper than Opus.

**Exception:** if the orchestrator session itself is already running on Sonnet (e.g. the user explicitly set the session model), the orchestrator can do Phase 2 inline. Check the session's running model before delegating.

Be fast — every minute here is one Opus + one GPT-5 call later that costs more.

### Phase 3 — GPT-5 reviews

Pipe the patch / draft to codex CLI:

```bash
codex exec --skip-git-repo-check < /dev/null "You are GPT-5 in a tight Opus+GPT-5 collaboration. Output: terse, no markdown headers, direct DMs only.

<context: 2-3 sentences max>

<patch / draft>

Review and ship/hold. Output format (under 200 words):

VERDICT: ship | hold
ISSUES: <bullets, only blockers, max 5 — or 'none'>
NITS: <optional small wins, max 2>"
```

**Critical**: pipe `< /dev/null` so codex doesn't hang waiting for stdin.

### Phase 4 — loop or ship

If verdict is `hold`: read GPT-5's blockers, fix each one, re-send the smaller delta to GPT-5 (don't re-send the whole patch every round — saves tokens). Continue until verdict is `ship`.

If verdict is `ship`: pre-flight + commit + push + watch.

### Phase 5 — pre-flight + post-deploy verify

Before pushing, run these in parallel:
- `git diff --stat` — sanity-check the size
- Check for accidentally-staged secrets (grep for `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, etc with non-empty values in the diff)

After push, watch the Vercel build:
1. Read the latest deployment via the Vercel MCP, branch=main
2. Poll deployment state every 30s until READY or ERROR (max 8 min)
3. If ERROR → fetch build log, identify the type-error / runtime-error, fix surgically, push again, loop back to step 1
4. If READY → also check `get_runtime_logs` last 5 min, level=error,fatal — no new errors should be logged
5. **Auto-rollback**: if runtime error rate >2% in 5 min after READY (compared to pre-deploy baseline), the protocol's auto-revert kicks in:
   `git revert HEAD && git push origin main`
   See `.claude/scripts/agent-rollback-watch.sh` for the policy doc.

The final report includes the deploy state. If the deploy errored and we couldn't fix it autonomously after 1 attempt, report that as part of the final ship message instead of looping forever.

### Phase 6 — Telegram approval gate (optional, opt-in)

If the user said "approve from phone" or task is high-risk, before pushing:
- Run `bash .claude/scripts/agent-telegram-approve.sh "<summary>" "<diff stat>"`
- Wait for `APPROVE` / `REJECT` / `TIMEOUT` / `ERROR` line on stdout
- Only push on `APPROVE`. Anything else → leave commit unpushed, surface the reason in the final report.

### Phase 7 — record the learning

After every SHIP (and every codex-catch the user calls out), append a row to `docs/AGENT_LEARNINGS.md` so future runs can pre-check the pattern. Format:

```
**YYYY-MM-DD — <commit-hash> — <bug-class>**

**Symptom**: ...
**Why Sonnet missed**: ...
**Codex catch round**: ...
**Fix pattern**: ...
**Pre-check on future runs**: <regex / heuristic>
```

Before round 1 of any future /agent run, scan `docs/AGENT_LEARNINGS.md`'s pre-check column and run those greps as part of the initial scan. This catches recurring patterns BEFORE codex has to review them.

## Disagreement detector

When Opus and codex give CONFLICTING advice, **DO NOT silently pick one**. Flag it explicitly to the user.

Triggers:
- Opus says "ship" but codex says "hold" (or vice versa) on the same patch
- Opus's plan picks one approach, codex's review insists on a different approach
- Opus identifies bug X, codex identifies bug Y, neither sees the other

When detected, output a `DISAGREEMENT` block in the final report:

```
⚠️ MODEL DISAGREEMENT
Opus says: <position>
Codex says: <position>
Sonnet's call: <which one I'm picking + why>
Confidence: low — recommend human eyes on this commit
```

Genuine disagreements between the models almost always indicate a real ambiguity. Surfacing them lets the user weigh in instead of one model's opinion winning silently.

## Codex cache

To avoid burning tokens on duplicate prompts (especially in long /agent sessions where the same patch gets reviewed multiple times), route codex calls through `.claude/scripts/agent-codex-cache.sh`:

```bash
bash .claude/scripts/agent-codex-cache.sh "<prompt>"
```

Cache hits print `[CACHE-HIT <hash>]` as the first line. Token cost in the final report subtracts cached calls.

## Pre-flight: read AGENT_LEARNINGS.md before round 1

Before sending the first patch to codex, scan `docs/AGENT_LEARNINGS.md` for `Pre-check on future runs` rows. Run each grep against the staged diff. If any match, surface them inline in the round-1 prompt to codex so the review is sharper from the start.

## Token-saving rules

1. **Opus plans, Sonnet codes** — Phase 1 = one short Opus call; Phase 2 = a Sonnet sub-agent that does the heavy tool calls. Never let Opus do Read/Grep/Edit loops directly when a Sonnet sub-agent could do it.
2. **Direct DMs only** — terse structured output, no markdown, no preamble, no closing.
3. **Each round is a delta** — after round 1, only send the new diff to GPT-5, not the full patch.
4. **Sonnet does the merge** — never ask Opus to merge GPT-5's review (that's another full Opus call). Sonnet (orchestrator or sub-agent) reads the review and applies fixes directly.
5. **One model per turn** — never run Opus and GPT-5 in parallel on the same prompt. They have different strengths; use them sequentially.
6. **Cap at 4 rounds** — if GPT-5 still says hold after 4 reviews, the task is bigger than this protocol and needs a `/plan`.
7. **Re-use codex cache** — `bash .claude/scripts/agent-codex-cache.sh "<prompt>"` short-circuits identical reviews. Cache hits print `[CACHE-HIT <hash>]` as the first line.
8. **Bound the planning call** — Opus's Phase 1 output is capped at 80 words. If you find yourself writing more than that, the task is too big for one /agent run; split it.

## Transcript

Write the round-by-round exchange to `/tmp/agent-<task-slug>-<timestamp>.md` so you can replay or reference later. Each turn:

```
## Round N — <model name> — <verdict if applicable>
<terse output>
```

## Example invocations

```
/agent find every CRITICAL security bug we missed in mutation routes
/agent design the dual-mode wizard for /dashboard/voice-receptionist
/agent refactor src/lib/services/zernio-ads.ts to support webhook callbacks
```

## Constraints

- DON'T enter an infinite loop. Cap at 4 review rounds.
- DON'T let either model see the full conversation history — strict turn-by-turn.
- DON'T forget `< /dev/null` on codex calls.
- DON'T re-send the whole patch to GPT-5 after round 1 — only the delta.
- DON'T paraphrase a model's output — quote it verbatim in the transcript.

## How this differs from /dual-plan

| | `/dual-plan` | `/agent` |
|---|---|---|
| Mode | One-shot plan + merge | Loop until ship |
| Output | Synthesized markdown plan | Real code committed to main |
| Token cost | ~2-3x single-plan | ~3-5x but spread over rounds |
| Best for | Architectural decisions | Bug fixes, refactors, hardening |
| Iteration | None | Up to 4 rounds |
