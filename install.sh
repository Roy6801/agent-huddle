#!/usr/bin/env bash
# Installs the agent-huddle skills and CLI into ~/.agents/skills and links each
# skill into the Claude Code, Gemini CLI and Antigravity CLI skill folders.
set -euo pipefail

BASE_URL="${AGENT_HUDDLE_BASE_URL:-https://agent-huddle.vercel.app}"
SKILLS_DIR="$HOME/.agents/skills"
CORE_FILES=(SKILL.md huddle.mjs page.html)
VERBS=(huddle-start huddle-join huddle-rooms huddle-end)
SKILLS=(agent-huddle "${VERBS[@]}")
CLAUDE_SKILLS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
GEMINI_SKILLS="$HOME/.gemini/skills"
ANTIGRAVITY_SKILLS="$HOME/.gemini/antigravity-cli/skills"

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
  # Piped installs (curl ... | bash) have no script path, so they always download.
  if [ -n "$script" ] && [ -f "$script" ]; then src="$(cd "$(dirname "$script")" && pwd)"; fi
  # Stage everything first so a failed download never leaves a mixed install.
  local f v
  local paths=()
  for f in "${CORE_FILES[@]}"; do paths+=("agent-huddle/$f"); done
  for v in "${VERBS[@]}"; do paths+=("$v/SKILL.md"); done
  STAGE="$(mktemp -d)"
  trap 'rm -rf "$STAGE"' EXIT
  for f in "${paths[@]}"; do
    mkdir -p "$STAGE/$(dirname "$f")"
    if [ -n "$src" ] && [ -f "$src/skills/agent-huddle/huddle.mjs" ]; then
      cp "$src/skills/$f" "$STAGE/$f"
    else
      curl -fsSL "$BASE_URL/skills/$f" -o "$STAGE/$f" || fail "could not download $BASE_URL/skills/$f"
    fi
  done
  for v in "${SKILLS[@]}"; do mkdir -p "$SKILLS_DIR/$v"; done
  for f in "${paths[@]}"; do mv -f "$STAGE/$f" "$SKILLS_DIR/$f"; done
  chmod +x "$SKILLS_DIR/agent-huddle/huddle.mjs"
}

link_skill() {
  local dest="$1" link="$2"
  if [ -L "$link" ] && [ "$(readlink "$link")" = "$dest" ]; then
    echo "  unchanged  $link"
    return
  fi
  mkdir -p "$(dirname "$link")"
  if [ -d "$link" ] && [ ! -L "$link" ]; then
    local backup="$link.bak-$(date +%Y%m%d%H%M%S)"
    mv "$link" "$backup"
    echo "  warning: $link was a real directory; moved to $backup" >&2
  fi
  ln -sfn "$dest" "$link"
  echo "  linked     $link -> $dest"
}

check_node
install_files

echo "Installed agent-huddle skills to $SKILLS_DIR"
for v in "${SKILLS[@]}"; do
  link_skill "$SKILLS_DIR/$v" "$CLAUDE_SKILLS/$v"
done
if [ -d "$HOME/.gemini" ]; then
  for v in "${SKILLS[@]}"; do
    link_skill "$SKILLS_DIR/$v" "$GEMINI_SKILLS/$v"
  done
else
  echo "  skipped    $GEMINI_SKILLS (no ~/.gemini; Gemini CLI not found)"
fi
if [ -d "$HOME/.gemini/antigravity-cli" ]; then
  for v in "${SKILLS[@]}"; do
    link_skill "$SKILLS_DIR/$v" "$ANTIGRAVITY_SKILLS/$v"
  done
else
  echo "  skipped    $ANTIGRAVITY_SKILLS (no ~/.gemini/antigravity-cli; Antigravity CLI not found)"
fi

cat <<MSG

Skills: agent-huddle (core), huddle-start, huddle-join, huddle-rooms, huddle-end

In any agent, run /huddle-start (Claude Code) or \$huddle-start (Codex), or just ask: start a huddle.

Codex: its sandbox blocks localhost by default. Approve the network request when Codex asks, or add this to ~/.codex/config.toml:
  [sandbox_workspace_write]
  network_access = true
MSG
