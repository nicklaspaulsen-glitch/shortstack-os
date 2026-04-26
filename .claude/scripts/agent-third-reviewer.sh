#!/usr/bin/env bash
# agent-third-reviewer.sh — second-opinion adversarial reviewer for the
# /agent loop's high-stakes 2-of-3 rule.
#
# USAGE
#   bash .claude/scripts/agent-third-reviewer.sh <patch-path>
#
# OUTPUT (stdout, mirrors codex format so the orchestrator can parse the same way)
#   VERDICT: ship | hold
#   ISSUES: <bullets, max 5>
#   NITS:   <optional bullets>
#
# BACKENDS (tried in this order, ANY configured backend votes; multiple
# configured = TRUE multi-reviewer where ALL must SHIP):
#
#   1. DeepSeek API     — DEEPSEEK_API_KEY env (cheap, code-strong, China-trained)
#   2. OpenRouter       — OPENROUTER_API_KEY env (proxy to 200+ models;
#                         OPENROUTER_MODEL env picks model, default
#                         "qwen/qwen3-coder" — code-tuned, different lineage)
#   3. Gemini direct    — GEMINI_API_KEY env (region-restricted; many users
#                         hit "Available regions" wall — kept as fallback)
#   4. gemini CLI       — npm i -g @google/gemini-cli (legacy fallback)
#
# If multiple backends are configured, this script polls them ALL in
# parallel and combines verdicts:
#   - All SHIP → VERDICT: ship
#   - Any HOLD → VERDICT: hold (with merged issues)
#   - All errored / unavailable → VERDICT: skip (single-reviewer fallback)
#
# This script does NOT fail-open on SHIP when no backend is available —
# that would defeat the second-opinion guarantee. The orchestrator falls
# back to single-reviewer mode and notes the skip in the final report.

set -uo pipefail

PATCH_PATH="${1:?usage: agent-third-reviewer.sh <patch-path>}"
[[ -f "$PATCH_PATH" ]] || { echo "patch not found: $PATCH_PATH" >&2; exit 1; }

PROMPT_HEAD="You are an adversarial code reviewer in a multi-model review loop. A peer model (GPT-5) has already reviewed this patch in parallel. Give an INDEPENDENT verdict — do not anchor on what the peer might say.

Output format — terse, no markdown headers, no preamble:

VERDICT: ship | hold
ISSUES: <numbered bullets, only blocking issues, max 5 — or 'none'>
NITS: <optional small wins, max 2>

Focus your review on:
- Correctness of any security/idempotency contract being modified
- TypeScript type safety (no any, no unsafe narrowing)
- Async correctness — missing await, swallowed errors, unhandled rejections
- Race conditions: TOCTOU, finally-block state mutations, useEffect cleanup gaps
- SQL/postgres: parameterized queries, RLS bypass without auth gate, transaction boundaries
- Validation: missing input bounds, oversized payloads, ambiguous types

Patch follows:
"

PROMPT_FILE="$(mktemp)"
{ echo "$PROMPT_HEAD"; cat "$PATCH_PATH"; } > "$PROMPT_FILE"

# ── Backend implementations ────────────────────────────────────────────

# Shared JSON helper — uses node since jq isn't reliably installed on
# Windows shells. Reads PROMPT_FILE + writes a fully-formed JSON payload
# to stdout. Schema is OpenAI-compatible (DeepSeek + OpenRouter both use
# this); pass model + provider-name as args.
encode_openai_payload() {
  # Sanitize: strip lone surrogates + replacement chars + non-printable
  # control chars. Some patches contain bytes that fs.readFileSync(..,
  # "utf8") converts to U+FFFD or lone surrogates, which DeepSeek's
  # strict JSON parser rejects ("invalid unicode code point at column N").
  node -e '
    const fs = require("fs");
    let prompt = fs.readFileSync(process.argv[1], "utf8");
    // Strip lone surrogates (any half of a surrogate pair without its mate),
    // U+FFFD replacement chars, and non-tab/newline control bytes.
    prompt = prompt
      .replace(/[\uD800-\uDFFF]/g, "")
      .replace(/�/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    const model = process.argv[2];
    process.stdout.write(JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1024,
    }));
  ' "$PROMPT_FILE" "$1"
}

encode_gemini_payload() {
  node -e '
    const fs = require("fs");
    let prompt = fs.readFileSync(process.argv[1], "utf8");
    prompt = prompt
      .replace(/[\uD800-\uDFFF]/g, "")
      .replace(/�/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    process.stdout.write(JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }));
  ' "$PROMPT_FILE"
}

decode_openai_response() {
  # stdin: full OpenAI-compatible response JSON. stdout: just the message text.
  node -e '
    let buf = "";
    process.stdin.on("data", c => buf += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(buf);
        const text = j?.choices?.[0]?.message?.content || j?.error?.message || "";
        process.stdout.write(String(text));
      } catch (e) {
        process.stderr.write("[third-reviewer] could not parse response: " + (e && e.message) + "\n");
        process.stdout.write(buf.slice(0, 500));
      }
    });
  '
}

decode_gemini_response() {
  node -e '
    let buf = "";
    process.stdin.on("data", c => buf += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(buf);
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || j?.error?.message || "";
        process.stdout.write(String(text));
      } catch (e) {
        process.stdout.write(buf.slice(0, 500));
      }
    });
  '
}

call_deepseek() {
  # DeepSeek API is OpenAI-compatible. Model: deepseek-chat (V3) or
  # deepseek-reasoner (R1). Reasoner is slower but catches more — use
  # reasoner for high-stakes review.
  local model="${DEEPSEEK_MODEL:-deepseek-chat}"
  local payload; payload="$(encode_openai_payload "$model")"
  curl -sS -m 90 \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
    -X POST \
    "https://api.deepseek.com/v1/chat/completions" \
    -d "$payload" \
  | decode_openai_response
}

call_openrouter() {
  # OpenRouter is OpenAI-compatible. Default model qwen/qwen3-coder
  # (code-tuned, Alibaba lineage — different from Anthropic + OpenAI).
  # Override via OPENROUTER_MODEL env (e.g. "google/gemini-2.5-pro" to
  # bypass Gemini regional block via OpenRouter's US-hosted proxy).
  local model="${OPENROUTER_MODEL:-qwen/qwen3-coder}"
  local payload; payload="$(encode_openai_payload "$model")"
  curl -sS -m 90 \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "HTTP-Referer: https://app.shortstack.work" \
    -H "X-Title: ShortStack /agent loop" \
    -X POST \
    "https://openrouter.ai/api/v1/chat/completions" \
    -d "$payload" \
  | decode_openai_response
}

call_gemini_curl() {
  local payload; payload="$(encode_gemini_payload)"
  curl -sS -m 90 \
    -H "Content-Type: application/json" \
    -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}" \
    -d "$payload" \
  | decode_gemini_response
}

call_gemini_cli() {
  if command -v gemini >/dev/null 2>&1; then
    gemini chat --model gemini-2.5-pro --quiet < "$PROMPT_FILE"
  elif command -v gemini-cli >/dev/null 2>&1; then
    gemini-cli --model gemini-2.5-pro < "$PROMPT_FILE"
  else
    return 1
  fi
}

# Wraps a backend call: writes raw output to /tmp/agent-3rd-<name>.out
# and tags lines so the merger can attribute issues.
poll_backend() {
  local name="$1"; shift
  local out="/tmp/agent-3rd-${name}.out"
  : > "$out"
  if "$@" > "$out" 2>&1; then
    echo "$name|ok|$out"
  else
    echo "$name|err|$out"
  fi
}

# ── Detect configured backends ─────────────────────────────────────────

backends=()
[[ -n "${DEEPSEEK_API_KEY:-}" ]] && backends+=("deepseek")
[[ -n "${OPENROUTER_API_KEY:-}" ]] && backends+=("openrouter")
if [[ -z "${DEEPSEEK_API_KEY:-}" && -z "${OPENROUTER_API_KEY:-}" ]]; then
  # Fall back to Gemini paths
  if [[ -n "${GEMINI_API_KEY:-}" ]]; then
    backends+=("gemini-curl")
  elif command -v gemini >/dev/null 2>&1 || command -v gemini-cli >/dev/null 2>&1; then
    backends+=("gemini-cli")
  fi
fi

if [[ ${#backends[@]} -eq 0 ]]; then
  cat <<'EOF' >&2
[agent-third-reviewer] No 2nd-opinion backend configured.
  Set ONE OR BOTH of:
    setx DEEPSEEK_API_KEY "sk-..."   (cheap, code-strong)
    setx OPENROUTER_API_KEY "sk-or-v1-..."   (any model via proxy)
  Falling back to single-reviewer mode for this patch.
EOF
  cat <<'EOF'
VERDICT: skip
ISSUES: no 2nd-opinion backend configured — single-reviewer mode active
NITS:
EOF
  exit 0
fi

# ── Poll all configured backends in parallel ───────────────────────────

results_file="$(mktemp)"
for b in "${backends[@]}"; do
  case "$b" in
    deepseek)     poll_backend "$b" call_deepseek     >> "$results_file" & ;;
    openrouter)   poll_backend "$b" call_openrouter   >> "$results_file" & ;;
    gemini-curl)  poll_backend "$b" call_gemini_curl  >> "$results_file" & ;;
    gemini-cli)   poll_backend "$b" call_gemini_cli   >> "$results_file" & ;;
  esac
done
wait

# ── Merge verdicts ─────────────────────────────────────────────────────
# All-SHIP → ship. Any HOLD → hold. All-error → skip.

ship_count=0
hold_count=0
err_count=0
issues=""

while IFS='|' read -r name status outfile; do
  if [[ "$status" == "err" ]]; then
    err_count=$((err_count + 1))
    continue
  fi
  body="$(cat "$outfile" 2>/dev/null || echo "")"
  if [[ -z "$body" ]]; then
    err_count=$((err_count + 1))
    continue
  fi

  verdict_line="$(grep -oiE '^VERDICT:[[:space:]]*(ship|hold)' <<<"$body" | head -1 | tr '[:upper:]' '[:lower:]')"
  if [[ "$verdict_line" == *"ship"* ]]; then
    ship_count=$((ship_count + 1))
  elif [[ "$verdict_line" == *"hold"* ]]; then
    hold_count=$((hold_count + 1))
    issues+="
[$name says HOLD]
$(awk '/^ISSUES:/,/^NITS:|^$/' <<<"$body" | head -20)
"
  else
    err_count=$((err_count + 1))
  fi
done < "$results_file"

total=${#backends[@]}
configured=${backends[*]}

if [[ $ship_count -eq $total ]]; then
  cat <<EOF
VERDICT: ship
ISSUES: none — all configured backends ship ($configured)
NITS:
EOF
elif [[ $hold_count -gt 0 ]]; then
  cat <<EOF
VERDICT: hold
ISSUES: $hold_count of $total backends hold ($configured)
$issues
NITS:
EOF
else
  # All erred or unparseable
  cat <<EOF
VERDICT: skip
ISSUES: all backends errored ($configured); falling back to single-reviewer
NITS:
EOF
fi
