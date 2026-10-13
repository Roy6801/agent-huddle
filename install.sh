#!/usr/bin/env bash
# Installs the agent-huddle skill and CLI into ~/.agents/skills/agent-huddle
# and links it into the Claude Code and Gemini/Antigravity skill folders.
set -euo pipefail

BASE_URL="${AGENT_HUDDLE_BASE_URL:-https://raw.githubusercontent.com/Roy6801/agent-huddle/main}"
FILES=(SKILL.md huddle.mjs page.html)
DEST="$HOME/.agents/skills/agent-huddle"
CLAUDE_LINK="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/agent-huddle"
GEMINI_LINK="$HOME/.gemini/skills/agent-huddle"

fail() { echo "$1" >&2; exit 1; }

check_node() {
  command -v node >/dev/null 2>&1 || fail "agent-huddle needs Node.js 20 or newer (node not found)"
  local version major
  version="$(node -v)"
  major="${version#v}"
  major="${major%%.*}"
  case "$major" in
    ''|*[!0-9]*) fail "agent-huddle needs Node.js 20 or newer (found $version)" ;;
  esac
  [ "$major" -ge 20 ] || fail "agent-huddle needs Node.js 20 or newer (found $version)"
}

install_files() {
  local src="" script="${BASH_SOURCE[0]:-}"
  # Piped installs (curl … | bash) have no script path, so they always download.
  if [ -n "$script" ] && [ -f "$script" ]; then src="$(cd "$(dirname "$script")" && pwd)"; fi
  # Stage everything first so a failed download never leaves a mixed install.
  local f
  STAGE="$(mktemp -d)"
  trap 'rm -rf "$STAGE"' EXIT
  for f in "${FILES[@]}"; do
    if [ -n "$src" ] && [ -f "$src/huddle.mjs" ]; then
      cp "$src/$f" "$STAGE/$f"
    else
      curl -fsSL "$BASE_URL/$f" -o "$STAGE/$f" || fail "could not download $BASE_URL/$f"
    fi
  done
  mkdir -p "$DEST"
  for f in "${FILES[@]}"; do mv -f "$STAGE/$f" "$DEST/$f"; done
  chmod +x "$DEST/huddle.mjs"
}

link_skill() {
  local link="$1"
  if [ -L "$link" ] && [ "$(readlink "$link")" = "$DEST" ]; then
    echo "  unchanged  $link"
    return
  fi
  mkdir -p "$(dirname "$link")"
  if [ -d "$link" ] && [ ! -L "$link" ]; then
    local backup="$link.bak-$(date +%Y%m%d%H%M%S)"
    mv "$link" "$backup"
    echo "  warning: $link was a real directory; moved to $backup" >&2
  fi
  ln -sfn "$DEST" "$link"
  echo "  linked     $link -> $DEST"
}

check_node
install_files

echo "Installed agent-huddle to $DEST"
link_skill "$CLAUDE_LINK"
if [ -d "$HOME/.gemini" ]; then
  link_skill "$GEMINI_LINK"
else
  echo "  skipped    $GEMINI_LINK (no ~/.gemini; Antigravity and Gemini CLI not found)"
fi

cat <<MSG

Next step:
  node ~/.agents/skills/agent-huddle/huddle.mjs new "my huddle"

Codex: its sandbox blocks localhost by default. Add this to ~/.codex/config.toml:
  [sandbox_workspace_write]
  network_access = true
MSG
