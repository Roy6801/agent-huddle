#!/usr/bin/env bash
# Installs the agent-huddle skills: checks Node, then runs install.mjs (next to this script in a
# clone, else downloaded) with answers read from the terminal.
# Test/CI knob: AGENT_HUDDLE_NO_TTY=1 never opens /dev/tty for prompts.
set -euo pipefail

BASE_URL="${AGENT_HUDDLE_BASE_URL:-https://agent-huddle.vercel.app}"

fail() { echo "$1" >&2; exit 1; }

check_node() {
  command -v node >/dev/null 2>&1 || fail "agent-huddle needs Node.js 20 or newer (node not found)"
  local version major minor
  version="$(node -v)"
  major="${version#v}"
  minor="${major#*.}"
  major="${major%%.*}"
  minor="${minor%%.*}"
  case "$major$minor" in
    ''|*[!0-9]*) fail "agent-huddle needs Node.js 20 or newer (found $version)" ;;
  esac
  [ "$major" -ge 20 ] || fail "agent-huddle needs Node.js 20 or newer (found $version)"
  if [ "$major" -eq 20 ] && [ "$minor" -lt 12 ]; then
    fail "the agent-huddle installer needs Node.js 20.12 or newer (found $version)"
  fi
}

check_node

script="${BASH_SOURCE[0]:-}"
# Piped installs (curl ... | bash) have no script path, so they always download.
if [ -n "$script" ] && [ -f "$(dirname "$script")/install.mjs" ]; then
  installer="$(cd "$(dirname "$script")" && pwd)/install.mjs"
else
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  installer="$tmp/install.mjs"
  curl -fsSL "$BASE_URL/install.mjs" -o "$installer" || fail "could not download $BASE_URL/install.mjs"
fi

if [ ! -t 0 ] && [ -z "${AGENT_HUDDLE_NO_TTY:-}" ] && { : </dev/tty; } 2>/dev/null; then
  node "$installer" "$@" </dev/tty
else
  node "$installer" "$@"
fi
