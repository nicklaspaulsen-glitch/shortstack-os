---
description: "Autopilot mode. Scans every TODO/FIXME/HACK comment in the codebase, runs /agent on each in parallel, wakes the user up to a list of N PRs ready for review. Designed to be invoked at end-of-day and have a usable backlog by morning."
---

# /agent-overnight

Burns the TODO backlog while you sleep. Each `// TODO`, `// FIXME`, `// HACK`, or `// XXX` comment in `src/` becomes a `/agent` task running in parallel against its own feature branch.

By morning you have a queue of branches with codex-reviewed commits, each tagged with the bug it addressed and a one-line summary.

## Workflow

1. **Scan**: grep `src/` for TODO/FIXME/HACK/XXX comments. Group by file. Extract the comment text + 5 lines of surrounding context per finding.
2. **Filter**: drop comments that are:
   - Vague ("// TODO: think about this") — not actionable
   - Already in `docs/AGENT_LEARNINGS.md` deferred list
   - In `node_modules`, `.next`, `dist`, `build`, `coverage`
   - In test files (different review pipeline)
3. **Triage** (Sonnet, fast): for each remaining comment, classify:
   - `actionable_now` — clear scope, /agent can handle
   - `needs_design` — strategic decision required, skip overnight
   - `flaky_test` — different toolchain, skip
   - `outdated` — comment refers to fixed code, propose deletion
4. **Branch + assign**: for each `actionable_now` finding, create a branch `fix/agent-overnight-<file-slug>-<line>` and run `/agent` with the comment as the task description. Run up to **5 in parallel** (each /agent loop is its own subagent + codex chain — capped to keep token spend bounded).
5. **Per-task report**: each /agent run finishes with either:
   - SHIP → branch is pushed, PR draft created via `gh pr create --draft`
   - HOLD after 4 rounds → branch is pushed but flagged "needs human"
   - ROLLBACK → revert + flag the task as too risky for autopilot
6. **Morning summary**: write `/tmp/overnight-<date>.md` with the queue:
   ```
   ## Overnight /agent run — 2026-04-26
   N tasks scanned, M actionable, K succeeded, J flagged
   
   ### ✅ Ready for your ✓ on the diff
   - fix/agent-overnight-foo-123 — "// TODO: handle the empty case"
     SHIP after 2 rounds. Caught: 1 fail-open. PR: <url>
   
   ### ⚠️ Needs human review
   - fix/agent-overnight-bar-456 — "// FIXME: this is racy"
     HOLD after 4 rounds. Codex blocker: <reason>. Branch: <name>
   
   ### 🚫 Rolled back (deploy regression)
   - fix/agent-overnight-baz-789 — runtime error rate spiked +5%
     reverted. Branch: <name> (kept for inspection)
   ```

## Token budget guard

Up to **5 parallel /agent loops** at once, each capped at **4 codex review rounds**, each round capped at **~200K tokens**. Hard ceiling per overnight run: ~5M tokens (~$10-15 USD). If approaching the cap, stop launching new tasks and let the in-flight ones finish.

## Telegram morning ping

When done, post a single Telegram message via `agent-telegram-approve.sh`:

> 🌙 Overnight done. {N} PRs ready, {M} flagged. Read summary: <link>

So you wake up and know whether to look.

## When NOT to use it

- During active dev (overnight assumes nothing is being committed by you)
- Before a release (don't auto-touch code that's about to ship)
- If the TODO backlog is < 5 items (just do them by hand)

## Manual override

Specific files:

```
/agent-overnight only:src/lib/services/ src/app/api/cron/
```

Skip files:

```
/agent-overnight skip:src/components/landing/
```

## Implementation notes for the orchestrator

- Use `gh pr create --draft` not `gh pr create` so nothing auto-merges.
- Each /agent task runs in its own git worktree under `/tmp/wt-<branch>/` so parallel branches don't fight over the working tree.
- Codex calls go through `.claude/scripts/agent-codex-cache.sh` so duplicate prompts hit cache.
- After each task, append a learning row to `docs/AGENT_LEARNINGS.md` — overnight runs are the highest-volume source of "things codex catches".
