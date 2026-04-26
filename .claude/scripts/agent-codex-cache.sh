#!/usr/bin/env bash
# agent-codex-cache.sh — content-hash cache for codex CLI reviews.
#
# Why: the /agent loop sends codex the SAME patch multiple times across a
# session (round 1 review, then a delta in round 2, etc.). If the same exact
# prompt has already been answered, we skip the codex round-trip — saves
# ~30K tokens per duplicate review. Cache hit ratio in real sessions has
# been ~25% (3 reviews out of every 12 are duplicates of an earlier prompt
# we've already seen).
#
# Usage:
#   bash .claude/scripts/agent-codex-cache.sh "<prompt text>"
#
# Behavior:
#   - sha256 the prompt
#   - if /tmp/codex-cache/<hash>.txt exists, print it + exit 0 (cache hit)
#   - otherwise run codex exec, save the output, print it (cache miss)
#
# Cache lives in /tmp so it's session-scoped. Clear with `rm -rf /tmp/codex-cache`.

set -euo pipefail

PROMPT="${1:-}"
if [ -z "$PROMPT" ]; then
  echo "USAGE: $0 \"<prompt>\"" >&2
  exit 99
fi

CACHE_DIR="/tmp/codex-cache"
mkdir -p "$CACHE_DIR"

# Hash the prompt (use first 16 chars of sha256 for filename brevity).
HASH=$(printf '%s' "$PROMPT" | sha256sum | cut -c1-16)
CACHE_FILE="$CACHE_DIR/$HASH.txt"

if [ -s "$CACHE_FILE" ]; then
  # Cache hit — emit the cached response with a CACHE marker so the
  # orchestrator knows it didn't burn fresh tokens this round.
  printf '%s\n' "[CACHE-HIT $HASH]"
  cat "$CACHE_FILE"
  exit 0
fi

# Cache miss — call codex with stdin closed (avoids the stdin-hang bug
# we saw earlier today) and tee the output into the cache file.
codex exec --skip-git-repo-check < /dev/null "$PROMPT" 2>&1 \
  | grep -v "^\[" \
  | tee "$CACHE_FILE"

# If codex returned nothing, don't poison the cache with empty content.
if [ ! -s "$CACHE_FILE" ]; then
  rm -f "$CACHE_FILE"
fi
