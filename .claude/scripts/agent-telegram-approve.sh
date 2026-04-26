#!/usr/bin/env bash
# agent-telegram-approve.sh — Telegram-based approval gate for the /agent
# protocol. Posts a diff summary to the user's Telegram chat with two inline
# buttons (✓ Ship / ✗ Hold) and waits for the answer before the orchestrator
# proceeds with `git push`.
#
# Why: lets the user step away from CC while /agent is running. They get a
# phone notification, tap the button, push happens (or doesn't). Pairs with
# silent mode — no need to be at the keyboard for the final review.
#
# Requires:
#   TELEGRAM_BOT_TOKEN  — already set in env for daily-brief cron etc.
#   TELEGRAM_CHAT_ID    — the user's chat ID (already set)
#
# Usage from /agent:
#   bash .claude/scripts/agent-telegram-approve.sh \
#     "<one-line summary>" "<diff stat block>"
#
# Output (one line):
#   APPROVE          → user tapped Ship, orchestrator pushes
#   REJECT           → user tapped Hold, orchestrator aborts
#   TIMEOUT          → no answer in 5 min, orchestrator aborts (fail-closed)
#   ERROR <reason>   → posting / polling failed, orchestrator aborts
#
# The orchestrator's job is to read this single line and either:
#   - APPROVE → continue to `git push origin main`
#   - everything else → leave the commit unpushed, surface the reason

set -euo pipefail

SUMMARY="${1:-(no summary)}"
DIFFSTAT="${2:-}"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "ERROR missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
  exit 0
fi

# Send the message with inline keyboard
MESSAGE=$(cat <<EOF
🤖 /agent approval needed

$SUMMARY

\`\`\`
$DIFFSTAT
\`\`\`

Tap ✅ to ship or ❌ to hold. Auto-times out in 5 min.
EOF
)

# Generate a unique callback_data prefix so we only match THIS approval
# request when polling — multiple /agent runs in flight don't collide.
NONCE=$(date +%s)$(( RANDOM % 1000 ))

POST_BODY=$(cat <<EOF
{
  "chat_id": "$CHAT_ID",
  "text": $(printf '%s' "$MESSAGE" | jq -Rs .),
  "parse_mode": "Markdown",
  "reply_markup": {
    "inline_keyboard": [[
      { "text": "✅ Ship",  "callback_data": "agent:ship:$NONCE"  },
      { "text": "❌ Hold",  "callback_data": "agent:hold:$NONCE"  }
    ]]
  }
}
EOF
)

SEND_RESULT=$(curl -s -X POST \
  "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H 'Content-Type: application/json' \
  -d "$POST_BODY")

if ! echo "$SEND_RESULT" | jq -e '.ok' >/dev/null 2>&1; then
  echo "ERROR telegram_send_failed: $(echo "$SEND_RESULT" | jq -r '.description // empty')"
  exit 0
fi

MESSAGE_ID=$(echo "$SEND_RESULT" | jq -r '.result.message_id')

# Poll for the callback_query answer. Telegram getUpdates is long-polled
# but offset-aware — we use offset=last_update+1 to avoid replaying old
# events. 5-minute hard cap.
DEADLINE=$(( $(date +%s) + 300 ))
LAST_UPDATE_ID=0

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  UPDATES=$(curl -s --max-time 30 \
    "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=$((LAST_UPDATE_ID + 1))&timeout=20")

  # Look for a callback_query whose data matches our nonce
  ANSWER=$(echo "$UPDATES" | jq -r --arg nonce "$NONCE" '
    .result[]
    | select(.callback_query.data | tostring | contains($nonce))
    | .callback_query.data' 2>/dev/null | head -1)

  if [ -n "$ANSWER" ]; then
    case "$ANSWER" in
      *":ship:"*)  echo "APPROVE"; exit 0 ;;
      *":hold:"*)  echo "REJECT";  exit 0 ;;
    esac
  fi

  # Advance the offset so we don't re-fetch already-seen updates
  NEW_OFFSET=$(echo "$UPDATES" | jq -r '.result[-1].update_id // 0')
  if [ -n "$NEW_OFFSET" ] && [ "$NEW_OFFSET" -gt "$LAST_UPDATE_ID" ]; then
    LAST_UPDATE_ID="$NEW_OFFSET"
  fi
  sleep 2
done

echo "TIMEOUT"
