#!/usr/bin/env bash
# agent-gemini-review.sh — second-opinion adversarial reviewer for the
# /agent loop's 2-of-3 rule on high-stakes patches.
#
# USAGE
#   bash .claude/scripts/agent-gemini-review.sh <patch-path>
#
# OUTPUT (stdout, mirrors codex format so the orchestrator can parse the same way)
#   VERDICT: ship | hold
#   ISSUES: <bullets, max 5>
#   NITS:   <optional bullets>
#
# The orchestrator combines this with the codex verdict — the 2-of-3 rule
# only ships if BOTH SHIP. See .claude/commands/agent.md Phase 3b.
#
# WIRING
#   This script tries the following backends in order, using the first one
#   that's available:
#     1. `gemini` CLI (Google's official `gemini-cli` from npm/pip)
#     2. `gemini-cli`
#     3. curl against the Gemini API (requires GEMINI_API_KEY env var)
#
# If none of the backends are available, the script prints a clear warning
# to stderr and exits 0 with `VERDICT: skip` so the orchestrator can
# degrade gracefully back to single-reviewer mode (logging the skip in
# the final report). It does NOT fail-open on SHIP — that would defeat
# the second-opinion guarantee.

set -euo pipefail

PATCH_PATH="${1:?usage: agent-gemini-review.sh <patch-path>}"
[[ -f "$PATCH_PATH" ]] || { echo "patch not found: $PATCH_PATH" >&2; exit 1; }

PROMPT="You are Gemini in a multi-model code review loop. A peer model (GPT-5) has already reviewed this patch and is voting in parallel. Your job is to give an INDEPENDENT verdict, not be biased by what the other reviewer might say.

Output format — terse, no markdown headers, no preamble:

VERDICT: ship | hold
ISSUES: <numbered bullets, only blocking issues, max 5 — or 'none'>
NITS: <optional small wins, max 2>

Focus your review on:
- Correctness of the security/idempotency contract being modified.
- TypeScript type safety (no any, no unsafe narrowing).
- Async correctness — missing await, swallowed errors, unhandled promise rejections.
- Race conditions: TOCTOU, finally-block state mutations, useEffect cleanup gaps.
- SQL/postgres: parameterized queries, RLS bypass without auth gate, transaction boundaries.

Patch follows the next line:
"

PROMPT_FILE="$(mktemp)"
{ echo "$PROMPT"; cat "$PATCH_PATH"; } > "$PROMPT_FILE"

# 1. Try `gemini` CLI
if command -v gemini >/dev/null 2>&1; then
  gemini chat --model gemini-2.5-pro --quiet < "$PROMPT_FILE"
  exit $?
fi

# 2. Try `gemini-cli`
if command -v gemini-cli >/dev/null 2>&1; then
  gemini-cli --model gemini-2.5-pro < "$PROMPT_FILE"
  exit $?
fi

# 3. Try curl against the API
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  PAYLOAD="$(jq -nR --rawfile p "$PROMPT_FILE" '{ contents: [{ parts: [{ text: $p }]}] }')"
  curl -sS \
    -H "Content-Type: application/json" \
    -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}" \
    -d "$PAYLOAD" \
  | jq -r '.candidates[0].content.parts[0].text // "VERDICT: skip\nISSUES: gemini API returned empty response"'
  exit 0
fi

# Fallback: graceful degradation. Print SKIP — the orchestrator falls back
# to single-reviewer mode and notes the skip in the final report.
cat <<'EOF' >&2
[agent-gemini-review] No Gemini backend available.
  Install one of:
    - npm i -g gemini-cli
    - or set GEMINI_API_KEY env var (https://aistudio.google.com/apikey)
  Falling back to single-reviewer mode for this patch.
EOF

cat <<'EOF'
VERDICT: skip
ISSUES: gemini backend not available — single-reviewer mode active for this patch
NITS:
EOF
