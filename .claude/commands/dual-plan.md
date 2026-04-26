---
description: Get the "ultimate plan" — Claude Opus does deep architectural reasoning, GPT-5 (via codex) does an independent take, then I synthesize both into a single combined plan. Use for hard architectural decisions, complex refactors, or when "I'm stuck" needs a second opinion.
---

# /dual-plan <task description>

Two-model planning: Claude Opus + OpenAI GPT-5 (via codex CLI) tackle the task independently, then their outputs get synthesized into a unified plan that uses each model's strengths.

## Why this works

- **Claude Opus** — best at deep architectural reasoning, codebase comprehension, thinking through edge cases, and maintaining global consistency across a long plan.
- **GPT-5 (codex)** — different training distribution, often spots different angles, strong at concrete code-generation patterns and "here's the snippet" specifics.

Running both independently and merging catches things either model alone would miss — the second model isn't biased by the first's framing.

## Prerequisite

User must have run `codex login` in any non-Claude-Code terminal once
(PowerShell, Git Bash, WSL — not the CC REPL itself, which is non-interactive).
Verify with `codex exec --help` succeeding.

If not authed, the command falls back to Opus-only mode and tells the user
to run `codex login` for full dual-mode.

## Workflow (you, the agent invoking this command, follow these steps)

### Step 1 — Capture the task

Read the user's `<task description>` from the slash command argument. If it's vague, ask one clarifying question and stop until they answer.

Format the task as a single self-contained paragraph including:
- The end goal
- Relevant files / components / surfaces
- Constraints (perf, security, deadlines, etc.)
- What's already been tried (if any)

### Step 2 — Get Opus's plan (always runs)

Use the **Agent tool** with `subagent_type: "planner"` and explicitly request the Opus model via the `model: "opus"` parameter:

```
Agent({
  description: "Opus deep plan for <task>",
  subagent_type: "planner",
  model: "opus",
  prompt: <the formatted task + "Produce a complete implementation plan. Include: file paths to touch, interface signatures, data flow diagrams (ASCII), risks + mitigations, build order, and a 'how I'd review this' checklist. Be opinionated — this is going to be one of two plans we synthesize. ~600-1000 words.">
})
```

Capture the full Opus output verbatim. Save to a temp file at `${TEMP}/opus-plan.md` so we can pass it to codex.

### Step 3 — Get codex/GPT-5's plan (skip if codex unavailable)

Run codex via Bash:

```bash
codex exec --skip-git-repo-check \
  --output-last-message "${TEMP}/codex-plan.md" \
  "<the formatted task>

Produce a complete implementation plan. Include: file paths to touch,
interface signatures, data flow diagrams (ASCII), risks + mitigations,
build order, and a 'how I'd review this' checklist. Be opinionated —
this is going to be one of two plans we synthesize. ~600-1000 words.

Important: do NOT read or write files — output ONLY a markdown plan to stdout."
```

Set timeout to 300 seconds (codex calls are slower than Claude).

If codex fails (not logged in, network, etc.), capture the error, set `codex_available = false`, and continue. Don't abort — Opus-only is still useful.

### Step 4 — Synthesize (Opus does the merge)

Read both plans into context. Use the **Agent tool** again with Opus to synthesize:

```
Agent({
  description: "Synthesize dual plans",
  subagent_type: "general-purpose",
  model: "opus",
  prompt: `Two independent plans for the same task. Merge them into ONE
unified plan that takes the best from each. Highlight where they
disagree and pick the better answer with reasoning. Highlight where
one model spotted something the other missed.

Final output structure:
  ## Goal
  ## Architecture (best take)
  ## Implementation steps (ordered, with file paths)
  ## Where the plans diverged + which I picked + why
  ## Risks + mitigations (combined)
  ## What to verify before/after

---
PLAN A (Claude Opus):
${opusPlan}

---
PLAN B (GPT-5 via codex):
${codexPlan || "(codex unavailable — Opus-only mode, no merge needed)"}`
})
```

If `codex_available = false`, skip the merge and just present the Opus plan with a note: "Running Opus-only because codex isn't authenticated. Run `codex login` for dual-mode next time."

### Step 5 — Present to user

Reply with:

```
# Dual-Plan: <task one-liner>

[The synthesized plan]

---
*Method*: Opus deep-plan + GPT-5 independent-plan, synthesized.
*Both raw plans saved at `${TEMP}/opus-plan.md` and `${TEMP}/codex-plan.md` for reference.*
```

If running Opus-only, replace the footer:
```
*Method*: Opus-only (codex CLI not authenticated — run `codex login` to enable dual-mode).
```

## When NOT to use /dual-plan

- Simple tasks where one model is overkill (e.g. "rename this variable", "add a comment")
- Tasks with strict tool requirements that codex can't help with (e.g. heavy use of MCP servers)
- Time-sensitive (codex adds 30-90s latency)

For those, use `/plan` (Opus only) or just Sonnet directly.

## Cost note

Dual-plan uses ~3x the tokens of a single plan (Opus deep × 2 + Opus synthesis). Worth it for genuine "I'm stuck on architecture" or "this decision will be expensive to undo" tasks. Not worth it for routine work.

## Constraints

- Don't run any code — both models are in plan-only mode
- Don't write files in the codebase — only the temp plan files
- If user asks "now implement it", switch to /ship or just code directly with the synthesized plan as your guide
