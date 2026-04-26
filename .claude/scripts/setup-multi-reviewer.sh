#!/usr/bin/env bash
# setup-multi-reviewer.sh — one-shot setup for the /agent loop's
# 2-of-3 multi-reviewer (third-reviewer.sh).
#
# Without at least one of OPENROUTER_API_KEY or DEEPSEEK_API_KEY set
# persistently in the user environment, /agent runs in single-reviewer
# mode (Opus only) and skips the 2-of-3 SHIP rule.
#
# USAGE
#   bash .claude/scripts/setup-multi-reviewer.sh openrouter sk-or-v1-...
#   bash .claude/scripts/setup-multi-reviewer.sh deepseek  sk-...
#
# After running, RESTART the terminal (or Claude Code) so the new env
# vars are picked up. Verify with:
#   echo $OPENROUTER_API_KEY        # bash
#   echo %OPENROUTER_API_KEY%       # cmd
#   $env:OPENROUTER_API_KEY         # PowerShell
#
# IMPORTANT — what each key buys you
#   • OPENROUTER_API_KEY → access to qwen/qwen3-coder by default
#     (override with OPENROUTER_MODEL env). Different lineage from
#     Anthropic/Codex, so it catches different categories of issues.
#     Keys: https://openrouter.ai/keys (free credit on signup, then
#     ~$0.0002/1k tokens for qwen3-coder).
#   • DEEPSEEK_API_KEY → deepseek-v4-pro (or override via
#     DEEPSEEK_MODEL). Code-strong, China-trained, also independent
#     lineage. Keys: https://platform.deepseek.com/api_keys.
#
# Both can be set — the script will fan out and require ALL configured
# backends to SHIP (true second-opinion guarantee).

set -euo pipefail

usage() {
  echo "USAGE: bash .claude/scripts/setup-multi-reviewer.sh <openrouter|deepseek> <key>" >&2
  exit 1
}

[[ $# -eq 2 ]] || usage

provider="$1"
key="$2"

case "$provider" in
  openrouter)
    var_name="OPENROUTER_API_KEY"
    [[ "$key" =~ ^sk-or-v1- ]] || {
      echo "[setup] WARN: openrouter keys typically start with sk-or-v1-, got: ${key:0:10}..." >&2
    }
    ;;
  deepseek)
    var_name="DEEPSEEK_API_KEY"
    [[ "$key" =~ ^sk- ]] || {
      echo "[setup] WARN: deepseek keys typically start with sk-, got: ${key:0:5}..." >&2
    }
    ;;
  *)
    echo "[setup] unknown provider: $provider" >&2
    usage
    ;;
esac

# Detect platform
case "$(uname -s 2>/dev/null || echo "")" in
  MINGW*|MSYS*|CYGWIN*)
    # Windows under Git-Bash / MSYS — use setx for persistent user env
    setx "$var_name" "$key" >/dev/null
    echo "[setup] Set $var_name persistently in Windows user environment."
    echo "[setup] RESTART your terminal / Claude Code session for it to take effect."
    ;;
  Darwin|Linux)
    shell_rc=""
    case "${SHELL:-}" in
      */zsh)  shell_rc="$HOME/.zshrc"  ;;
      */bash) shell_rc="$HOME/.bashrc" ;;
      *)      shell_rc="$HOME/.profile";;
    esac
    if grep -q "^export $var_name=" "$shell_rc" 2>/dev/null; then
      # In-place replace
      sed -i.bak "s|^export $var_name=.*|export $var_name=\"$key\"|" "$shell_rc"
      echo "[setup] Updated existing $var_name in $shell_rc (backup: ${shell_rc}.bak)."
    else
      printf '\n# Multi-reviewer for Claude /agent loop\nexport %s="%s"\n' "$var_name" "$key" >> "$shell_rc"
      echo "[setup] Appended $var_name to $shell_rc."
    fi
    echo "[setup] Run 'source $shell_rc' or restart your terminal to take effect."
    ;;
  *)
    echo "[setup] Unsupported platform; set $var_name=\"$key\" manually in your shell rc." >&2
    exit 1
    ;;
esac

echo "[setup] After restart, verify with: bash .claude/scripts/agent-third-reviewer.sh <(echo 'test patch')"
