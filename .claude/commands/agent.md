---
description: "Hybrid Opus+GPT-5 agent — runs Claude Opus 4.7 and GPT-5 (via codex CLI) together with token-tight direct-DM protocol. Use for hard tasks where you want both models reasoning together. Writes a per-task transcript to /tmp so the conversation is replayable."
---

# /agent <task>

A "model" you can pick that's actually two models in lockstep: **Claude Opus 4.7** as the strategist + writer, **GPT-5** (via codex CLI) as the adversarial reviewer. Output protocol: **direct DMs only** — no preamble, no fluff, terse exchanges, structured signals.

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

You (the orchestrator) follow Opus's signals: run scans, read code, write fixes / features / drafts. Be fast — every minute here is one Opus + one GPT-5 call later that costs more.

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

If verdict is `ship`: commit + push.

## Token-saving rules

1. **Direct DMs only** — terse structured output, no markdown, no preamble, no closing.
2. **Each round is a delta** — after round 1, only send the new diff to GPT-5, not the full patch.
3. **Sonnet does the merge** — never ask Opus to merge GPT-5's review (that's another full Opus call). Sonnet (the orchestrator) reads the review and applies fixes directly.
4. **One model per turn** — never run Opus and GPT-5 in parallel on the same prompt. They have different strengths; use them sequentially.
5. **Cap at 4 rounds** — if GPT-5 still says hold after 4 reviews, the task is bigger than this protocol and needs a `/plan`.

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
