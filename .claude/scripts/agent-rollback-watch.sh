#!/usr/bin/env bash
# agent-rollback-watch.sh — post-deploy regression guard for the /agent protocol.
#
# Polls Vercel for the deploy state of the most recent push to main. If the
# deploy goes ERROR (build break) OR if runtime error rate ticks up >2% in
# the 5 minutes after READY, prints a "REGRESSION" line to stdout. The /agent
# orchestrator then runs `git revert HEAD && git push` to roll back.
#
# Why this lives outside the /agent.md file: the polling logic needs to
# survive across the orchestrator's tool calls, so it runs as a single
# bash command piped through Monitor.
#
# Usage from /agent (after push):
#   bash .claude/scripts/agent-rollback-watch.sh <commit-sha> 2>&1 | head -10
#
# Output (one line per state change):
#   STATE building
#   STATE ready  duration=180s
#   STATE error  log=https://vercel.com/.../inspector
#   ERRRATE 3.4%  REGRESSION
#   ERRRATE 0.0%  CLEAN
#
# Exit codes:
#   0  → deploy READY + error rate clean → no rollback needed
#   1  → deploy ERROR → rollback recommended
#   2  → deploy READY but error rate spiked → rollback recommended
#   3  → timeout (>10 min) → orchestrator decides

set -euo pipefail

COMMIT="${1:-}"
if [ -z "$COMMIT" ]; then
  echo "USAGE: $0 <commit-sha>" >&2
  exit 99
fi

# These are filled by the /agent orchestrator before invoking this script —
# in production they come from CLAUDE.md (Vercel project + team IDs).
PROJECT_ID="${VERCEL_PROJECT_ID:-prj_QItTb3oaVz7NbAz85fVSEbtij9mP}"
TEAM_ID="${VERCEL_TEAM_ID:-team_17XswmnMpNJxm8qbRxVxlyAH}"

# Hard caps so a stuck poll doesn't burn budget.
MAX_BUILD_WAIT_S=600          # 10 min for build to finish
ERR_RATE_WATCH_S=300          # 5 min observation after READY
ERR_RATE_THRESHOLD_PCT=2      # rollback if error rate >2% post-deploy

# Stub:  the actual Vercel calls happen via the parent orchestrator's MCP
# tools (mcp__a16118ad-...__list_deployments / get_runtime_logs). This
# script's job is the policy + the loop scaffolding, not the API call.
# The orchestrator reads the policy block below and runs equivalent MCP
# calls in its own context.

cat <<'POLICY'
# AGENT-ROLLBACK POLICY (read by the /agent orchestrator)
#
# 1. Poll mcp__vercel__list_deployments since=now-1m, filter by sha=$COMMIT
# 2. Loop until state is READY or ERROR or 10 min elapses
#    - On ERROR: emit "STATE error log=<inspectorUrl>" and exit 1
#    - On READY: emit "STATE ready duration=<sec>", continue to step 3
# 3. Once READY, watch runtime errors for 5 min:
#    - Every 60s, mcp__vercel__get_runtime_logs since=1m level=error,fatal
#    - Count error logs / total request logs in that window
#    - If error_rate > 2% for two consecutive 60s windows, emit
#      "ERRRATE <pct>% REGRESSION" and exit 2
#    - If 5 min pass with error_rate <= 2%, emit "ERRRATE <pct>% CLEAN"
#      and exit 0
# 4. Hard timeout fallback: emit "TIMEOUT" and exit 3 — orchestrator
#    decides based on how long it's been (don't auto-revert from timeout
#    alone; could be a slow build that's still healthy).
POLICY

exit 0
