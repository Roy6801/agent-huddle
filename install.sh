#!/usr/bin/env bash
# Installs the agent-huddle skills into ~/.agents/skills (the shared copy) and links
# them into the skills folders of the coding agents you pick.
# Test/CI knob: AGENT_HUDDLE_NO_TTY=1 never opens /dev/tty for prompts.
set -euo pipefail

BASE_URL="${AGENT_HUDDLE_BASE_URL:-https://agent-huddle.vercel.app}"
SKILLS_DIR="$HOME/.agents/skills"
STATE_DIR="${AGENT_HUDDLE_HOME:-$HOME/.agent-huddle}"
SAVED="$STATE_DIR/install.json"
CORE_FILES=(SKILL.md huddle.mjs page.html)
VERBS=(huddle-start huddle-join huddle-rooms huddle-end)
SKILLS=(agent-huddle "${VERBS[@]}")
AGENTS=(claude codex agy gemini opencode other)

YES=0 INTERACTIVE=0 UNINSTALL=0 PROMPT=0 NO_TERMINAL=0 CODEX_HINT=0
DIRS=()
# Menu rows as parallel arrays (bash 3.2 has no associative arrays).
# FOUND: 1 detected, 0 not detected, - added by hand. ADDED: removable with `d N`.
R_AGENT=() R_PATH=() R_ON=() R_CUSTOM=() R_ADDED=() R_FOUND=() R_NEW=()
P_ACT=() P_LINK=() P_DEST=() P_NOTE=()
STAMP="$(date +%Y%m%d%H%M%S)"

fail() { echo "$1" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Usage: install.sh [--yes] [--dir agent[=path]]... [--interactive] [--uninstall] [--help]

Copies the agent-huddle skills to ~/.agents/skills and links them into your agents' skills folders.

  --yes, -y            No prompts: use the saved targets, else the detected agents.
  --dir agent[=path]   Install for exactly these agents (repeatable). Agents: claude, codex, agy,
                       gemini, opencode, other. Without a path the agent's default folder is used.
  --interactive, -i    Show the menu and read answers from stdin (for piping answers).
  --uninstall          Remove our links, the shared skill folders and the saved targets.
  --help, -h           Show this help.

Env: AGENT_HUDDLE_BASE_URL (download source), AGENT_HUDDLE_HOME (where install.json lives),
AGENT_HUDDLE_NO_TTY=1 (never prompt through /dev/tty; for tests and CI).
USAGE
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      -y|--yes) YES=1 ;;
      -i|--interactive) INTERACTIVE=1 ;;
      --uninstall) UNINSTALL=1 ;;
      -h|--help) usage; exit 0 ;;
      --dir)
        [ $# -ge 2 ] || fail "--dir needs agent[=path]"
        DIRS+=("$2")
        shift
        ;;
      --dir=*) DIRS+=("${1#--dir=}") ;;
      *) usage >&2; fail "unknown option: $1" ;;
    esac
    shift
  done
}

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
  echo "✓ Node $version"
}

stage_files() {
  local src="" script="${BASH_SOURCE[0]:-}" from
  # Piped installs (curl ... | bash) have no script path, so they always download.
  if [ -n "$script" ] && [ -f "$script" ]; then src="$(cd "$(dirname "$script")" && pwd)"; fi
  # Stage everything first so a failed download never leaves a mixed install.
  local f v
  STAGED=()
  for f in "${CORE_FILES[@]}"; do STAGED+=("agent-huddle/$f"); done
  for v in "${VERBS[@]}"; do STAGED+=("$v/SKILL.md"); done
  STAGE="$(mktemp -d)"
  trap 'rm -rf "$STAGE"' EXIT
  from="$BASE_URL"
  if [ -n "$src" ] && [ -f "$src/skills/agent-huddle/huddle.mjs" ]; then from="$src/skills"; fi
  for f in "${STAGED[@]}"; do
    mkdir -p "$STAGE/$(dirname "$f")"
    if [ "$from" = "$BASE_URL" ]; then
      curl -fsSL "$BASE_URL/skills/$f" -o "$STAGE/$f" || fail "could not download $BASE_URL/skills/$f"
    else
      cp "$src/skills/$f" "$STAGE/$f"
    fi
  done
  echo "✓ Skills staged from $from"
}

install_shared() {
  local f v
  for v in "${SKILLS[@]}"; do mkdir -p "$SKILLS_DIR/$v"; done
  for f in "${STAGED[@]}"; do mv -f "$STAGE/$f" "$SKILLS_DIR/$f"; done
  chmod +x "$SKILLS_DIR/agent-huddle/huddle.mjs"
}

tilde() {
  case "$1" in
    "$HOME") echo "~" ;;
    "$HOME"/*) echo "~${1#"$HOME"}" ;;
    *) echo "$1" ;;
  esac
}

# Physical path of $1, or of its nearest existing parent plus the missing rest.
resolve() {
  local p="$1" rest=""
  while [ ! -d "$p" ] && [ "$p" != "/" ]; do
    rest="/$(basename "$p")$rest"
    p="$(dirname "$p")"
  done
  echo "$(cd -P "$p" && pwd -P)$rest"
}

# Expands ~ and $VARS and makes the path absolute; prints an error for unset variables.
expand_path() {
  node -e '
    let s = process.argv[1];
    const home = process.env.HOME;
    if (s === "~") s = home;
    else if (s.startsWith("~/")) s = home + s.slice(1);
    let missing = "";
    s = s.replace(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g, (m, a, b) => {
      const v = process.env[a || b];
      if (v === undefined) missing = a || b;
      return v ?? "";
    });
    if (missing) { console.error("  error: $" + missing + " is not set"); process.exit(1); }
    console.log(require("path").resolve(s));
  ' "$1"
}

on_path() { command -v "$1" >/dev/null 2>&1; }

agent_label() {
  case "$1" in
    claude) echo "Claude Code" ;;
    codex) echo "Codex" ;;
    agy) echo "Antigravity" ;;
    gemini) echo "Gemini CLI" ;;
    opencode) echo "opencode" ;;
    *) echo "Other" ;;
  esac
}

agent_signal() {
  case "$1" in
    codex) echo "$HOME/.codex" ;;
    agy) echo "$HOME/.gemini/antigravity-cli" ;;
    gemini) echo "$HOME/.gemini/settings.json" ;;
    opencode) echo "$HOME/.config/opencode" ;;
  esac
}

default_path() {
  case "$1" in
    claude) echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills" ;;
    codex) echo "$SKILLS_DIR" ;;
    agy) echo "$HOME/.gemini/antigravity-cli/skills" ;;
    gemini) echo "$HOME/.gemini/skills" ;;
    opencode) echo "$HOME/.config/opencode/skills" ;;
  esac
}

known_agent() {
  case " ${AGENTS[*]} " in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

row_count() { echo "${#R_AGENT[@]}"; }

add_row() {
  R_AGENT+=("$1") R_PATH+=("$2") R_ON+=("$3") R_CUSTOM+=("$4") R_ADDED+=("$5") R_FOUND+=("$6") R_NEW+=("0")
}

drop_row() {
  local i="$1" j=$(($1 + 1))
  R_AGENT=("${R_AGENT[@]:0:i}" "${R_AGENT[@]:j}")
  R_PATH=("${R_PATH[@]:0:i}" "${R_PATH[@]:j}")
  R_ON=("${R_ON[@]:0:i}" "${R_ON[@]:j}")
  R_CUSTOM=("${R_CUSTOM[@]:0:i}" "${R_CUSTOM[@]:j}")
  R_ADDED=("${R_ADDED[@]:0:i}" "${R_ADDED[@]:j}")
  R_FOUND=("${R_FOUND[@]:0:i}" "${R_FOUND[@]:j}")
  R_NEW=("${R_NEW[@]:0:i}" "${R_NEW[@]:j}")
}

is_shared() {
  [ "${R_AGENT[$1]}" = codex ] && [ "${R_PATH[$1]}" = "$SKILLS_DIR" ]
}

# Index of the row (other than $2) whose resolved path equals $1, or -1.
row_with_path() {
  local want i=0 n
  want="$(resolve "$1")"
  n="$(row_count)"
  while [ "$i" -lt "$n" ]; do
    if [ "$i" != "$2" ] && [ "$(resolve "${R_PATH[$i]}")" = "$want" ]; then echo "$i"; return; fi
    i=$((i + 1))
  done
  echo -1
}

# Claude Code config dirs, one per line as "dir<TAB>reason", deduplicated by resolved path.
claude_dirs() {
  local d seen=" " r
  local cands=() whys=()
  if [ -n "${CLAUDE_CONFIG_DIR:-}" ]; then cands+=("$CLAUDE_CONFIG_DIR"); whys+=("CLAUDE_CONFIG_DIR"); fi
  if [ -d "$HOME/.claude" ]; then
    cands+=("$HOME/.claude"); whys+=("folder exists")
  elif [ -z "${CLAUDE_CONFIG_DIR:-}" ] && on_path claude; then
    cands+=("$HOME/.claude"); whys+=("claude on PATH")
  fi
  for d in "$HOME"/.claude-*; do
    if [ -f "$d/settings.json" ]; then cands+=("$d"); whys+=("has settings.json"); fi
  done
  local i=0
  while [ "$i" -lt "${#cands[@]}" ]; do
    r="$(resolve "${cands[$i]}")"
    case "$seen" in
      *" $r "*) ;;
      *) seen="$seen$r "; printf '%s\t%s\n' "${cands[$i]}" "${whys[$i]}" ;;
    esac
    i=$((i + 1))
  done
}

# Builds one row per agent (one per Claude config dir) from what is installed.
detect_rows() {
  local quiet="$1" agent sig dirs d why label
  dirs="$(claude_dirs)"
  if [ "$quiet" = 0 ]; then echo; echo "Agents:"; fi
  if [ -n "$dirs" ]; then
    while IFS=$'\t' read -r d why; do
      add_row claude "$d/skills" 1 0 0 1
      if [ "$quiet" = 0 ]; then printf '  ✓ %-12s %s (%s)\n' "Claude Code" "$(tilde "$d")" "$why"; fi
    done <<<"$dirs"
  else
    add_row claude "$(default_path claude)" 0 0 0 0
    if [ "$quiet" = 0 ]; then printf '  - %-12s not found (no claude on PATH, no %s)\n' "Claude Code" "$(tilde "${CLAUDE_CONFIG_DIR:-$HOME/.claude}")"; fi
  fi
  for agent in codex agy gemini opencode; do
    sig="$(agent_signal "$agent")"
    label="$(agent_label "$agent")"
    if on_path "$agent"; then
      why="$agent on PATH"
    elif [ -e "$sig" ]; then
      why="$(tilde "$sig")"
    else
      why=""
    fi
    if [ -n "$why" ]; then
      add_row "$agent" "$(default_path "$agent")" 1 0 0 1
      if [ "$quiet" = 0 ]; then printf '  ✓ %-12s %s\n' "$label" "$why"; fi
    else
      add_row "$agent" "$(default_path "$agent")" 0 0 0 0
      if [ "$quiet" = 0 ]; then printf '  - %-12s not found (no %s on PATH, no %s)\n' "$label" "$agent" "$(tilde "$sig")"; fi
    fi
    if [ "$agent" = codex ]; then
      CODEX_HINT="${R_FOUND[$(($(row_count) - 1))]}"
      R_ON[$(($(row_count) - 1))]=1
    fi
  done
}

read_saved() {
  node -e '
    const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const t of j.targets || []) {
      if (t && typeof t.agent === "string" && typeof t.path === "string" && t.path.startsWith("/")) {
        console.log([t.agent, t.custom ? 1 : 0, t.path].join("\t"));
      }
    }
  ' "$1"
}

# Row index a saved target maps onto: Claude rows by path, other agents by key.
saved_row_for() {
  local agent="$1" p="$2" matched="$3" i=0 n want
  n="$(row_count)"
  want="$(resolve "$p")"
  while [ "$i" -lt "$n" ]; do
    if [ "${R_AGENT[$i]}" = "$agent" ] && [ "${R_ADDED[$i]}" = 0 ]; then
      case "$matched" in
        *" $i "*) ;;
        *)
          if [ "$agent" != claude ] || [ "$(resolve "${R_PATH[$i]}")" = "$want" ]; then echo "$i"; return; fi
          ;;
      esac
    fi
    i=$((i + 1))
  done
  echo -1
}

# Saved targets win; detected agents missing from them are offered unchecked as new.
apply_saved() {
  local lines a c p i n matched=" "
  [ -f "$SAVED" ] || return 0
  if ! lines="$(read_saved "$SAVED" 2>/dev/null)"; then
    echo "! Could not read $(tilde "$SAVED"); using detected agents"
    return 0
  fi
  n="$(row_count)"
  i=0
  while [ "$i" -lt "$n" ]; do
    if ! is_shared "$i"; then R_ON[$i]=0; fi
    i=$((i + 1))
  done
  while IFS=$'\t' read -r a c p; do
    [ -n "$a" ] || continue
    known_agent "$a" || a=other
    if [ "$a" = codex ] && [ "$p" = "$SKILLS_DIR" ]; then continue; fi
    i="$(saved_row_for "$a" "$p" "$matched")"
    if [ "$i" -ge 0 ]; then
      R_PATH[$i]="$p" R_CUSTOM[$i]="$c" R_ON[$i]=1
      matched="$matched$i "
    else
      add_row "$a" "$p" 1 "$c" 1 -
      matched="$matched$(($(row_count) - 1)) "
    fi
  done <<<"$lines"
  n="$(row_count)"
  i=0
  while [ "$i" -lt "$n" ]; do
    case "$matched" in
      *" $i "*) ;;
      *) if ! is_shared "$i" && [ "${R_FOUND[$i]}" = 1 ]; then R_NEW[$i]=1; fi ;;
    esac
    i=$((i + 1))
  done
}

# Prints why a path cannot be used, or nothing. $2 is the row being edited (-1 for none).
path_error() {
  local p="$1" skip="$2" dup anc
  if [ -e "$p" ] && [ ! -d "$p" ]; then echo "error: $(tilde "$p") is a file"; return; fi
  if [ "$(resolve "$p")" = "$(resolve "$SKILLS_DIR")" ]; then echo "error: that is the shared copy itself"; return; fi
  dup="$(row_with_path "$p" "$skip")"
  if [ "$dup" -ge 0 ]; then echo "error: already listed as row $((dup + 1))"; return; fi
  anc="$p"
  while [ ! -e "$anc" ]; do anc="$(dirname "$anc")"; done
  if [ ! -w "$anc" ]; then echo "error: $(tilde "$anc") is not writable"; fi
}

claude_warning() {
  if [ "$1" = claude ] && [ ! -f "$(dirname "$2")/settings.json" ]; then
    echo "$(tilde "$(dirname "$2")") has no settings.json; it may not be a Claude Code config dir"
  fi
}

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  echo "${s%"${s##*[![:space:]]}"}"
}

# Reads one answer from fd 3 into REPLY. Input that ends aborts without changes.
ask() {
  printf '%s' "$1"
  if ! IFS= read -r REPLY <&3; then
    echo
    echo "Input ended; nothing changed."
    exit 1
  fi
  if [ ! -t 3 ]; then echo "$REPLY"; fi
  REPLY="$(trim "$REPLY")"
}

confirm() {
  while :; do
    ask "$1"
    case "$REPLY" in
      [yY]|[yY][eE][sS]) return 0 ;;
      [nN]|[nN][oO]) return 1 ;;
      '') [ "$2" = y ]; return ;;
      *) echo "  Answer y or n." ;;
    esac
  done
}

# Asks the warnings and the create question for a path; 0 means use it.
accept_path() {
  local agent="$1" p="$2" skip="$3" err warn
  err="$(path_error "$p" "$skip")"
  if [ -n "$err" ]; then echo "  $err"; return 1; fi
  warn="$(claude_warning "$agent" "$p")"
  if [ -n "$warn" ]; then confirm "! $warn. Use it anyway? [y/N] " n || return 1; fi
  if [ ! -d "$p" ]; then confirm "$(tilde "$p") does not exist. Create it? [Y/n] " y || return 1; fi
  return 0
}

# Prompts until the answer is an accepted path (PICKED) or empty (returns 1).
pick_path() {
  local agent="$1" skip="$2" def="$3" p
  while :; do
    if [ -n "$def" ]; then ask "Path [$(tilde "$def")]: "; else ask "Path (empty cancels): "; fi
    if [ -z "$REPLY" ]; then
      [ -n "$def" ] || return 1
      p="$def"
    else
      p="$(expand_path "$REPLY")" || continue
    fi
    if accept_path "$agent" "$p" "$skip"; then PICKED="$p"; return 0; fi
  done
}

row_note() {
  local i="$1" notes=()
  if is_shared "$i"; then
    notes+=("(shared copy)")
  else
    if [ "${R_CUSTOM[$i]}" = 1 ]; then notes+=("(custom)"); fi
    if [ "${R_NEW[$i]}" = 1 ]; then notes+=("new since last install"); fi
    if [ "${R_FOUND[$i]}" = 0 ]; then
      if [ -d "${R_PATH[$i]}" ]; then notes+=("not found"); else notes+=("not found, folder will be created"); fi
    elif [ ! -d "${R_PATH[$i]}" ]; then
      notes+=("folder will be created")
    fi
  fi
  local k=0 out=""
  while [ "$k" -lt "${#notes[@]}" ]; do
    out="${out:+$out, }${notes[$k]}"
    k=$((k + 1))
  done
  if [ -n "$out" ]; then echo "  $out"; fi
}

show_menu() {
  local i=0 n mark
  n="$(row_count)"
  echo
  echo "Install the skills for:"
  while [ "$i" -lt "$n" ]; do
    mark=" "
    if [ "${R_ON[$i]}" = 1 ]; then mark=x; fi
    printf '  %d [%s] %-12s %s%s\n' $((i + 1)) "$mark" "$(agent_label "${R_AGENT[$i]}")" "$(tilde "${R_PATH[$i]}")" "$(row_note "$i")"
    i=$((i + 1))
  done
  echo "Enter continue · N toggle · e N edit path · a add · d N remove · ? help · q quit"
}

show_help() {
  cat <<'HELP'
  Enter   continue to the plan (nothing is written before you confirm it)
  N       check or uncheck row N
  e N     edit the skills folder of row N
  a       add a row: pick an agent, then a folder
  d N     remove row N (only rows added with a)
  q       quit without changes
HELP
}

# Parses a 1-based row number into the 0-based ROW; returns 1 when it is not a row.
parse_row() {
  local n
  n="$(trim "$1")"
  case "$n" in
    ''|*[!0-9]*) echo "  Unknown row: $1"; return 1 ;;
  esac
  if [ "$n" -lt 1 ] || [ "$n" -gt "$(row_count)" ]; then echo "  No row $n"; return 1; fi
  ROW=$((n - 1))
}

toggle_row() {
  local i="$1"
  if is_shared "$i"; then echo "  Codex reads the shared copy; it is always installed."; return; fi
  if [ "${R_ON[$i]}" = 1 ]; then R_ON[$i]=0; else R_ON[$i]=1; fi
}

edit_row() {
  local i="$1"
  if is_shared "$i"; then echo "  Codex reads the shared copy; it is always installed."; return; fi
  echo "  Current: $(tilde "${R_PATH[$i]}")"
  while :; do
    ask "New path (empty keeps): "
    if [ -z "$REPLY" ]; then return; fi
    local p
    p="$(expand_path "$REPLY")" || continue
    if accept_path "${R_AGENT[$i]}" "$p" "$i"; then
      R_PATH[$i]="$p" R_CUSTOM[$i]=1 R_ON[$i]=1
      return
    fi
  done
}

add_row_menu() {
  local agent def
  echo "  Agent: 1) Claude Code  2) Codex  3) Antigravity  4) Gemini CLI  5) opencode  6) Other"
  while :; do
    ask "Agent [1-6, empty cancels]: "
    case "$REPLY" in
      '') return ;;
      [1-6]) break ;;
      *) echo "  Pick 1-6." ;;
    esac
  done
  agent="${AGENTS[$((REPLY - 1))]}"
  def="$(default_path "$agent")"
  pick_path "$agent" -1 "$def" || return 0
  if [ "$PICKED" = "$def" ]; then add_row "$agent" "$PICKED" 1 0 1 -; else add_row "$agent" "$PICKED" 1 1 1 -; fi
}

remove_row() {
  if [ "${R_ADDED[$1]}" != 1 ]; then echo "  Only rows added with a can be removed; uncheck it with $(($1 + 1)) instead."; return; fi
  drop_row "$1"
}

run_menu() {
  show_menu
  while :; do
    ask "> "
    case "$REPLY" in
      '') return ;;
      q|Q) echo "Nothing changed."; exit 0 ;;
      '?') show_help; continue ;;
      a|A) add_row_menu ;;
      [eE]*) parse_row "${REPLY#?}" || continue; edit_row "$ROW" ;;
      [dD]*) parse_row "${REPLY#?}" || continue; remove_row "$ROW" ;;
      *[!0-9]*) echo "  Unknown command; ? shows help."; continue ;;
      *) parse_row "$REPLY" || continue; toggle_row "$ROW" ;;
    esac
    show_menu
  done
}

# --dir: the targets are exactly these agents plus the shared copy.
apply_dirs() {
  local k=0 i n spec agent p custom err warn
  n="$(row_count)"
  i=0
  while [ "$i" -lt "$n" ]; do
    if ! is_shared "$i"; then R_ON[$i]=0; fi
    i=$((i + 1))
  done
  while [ "$k" -lt "${#DIRS[@]}" ]; do
    spec="${DIRS[$k]}"
    k=$((k + 1))
    agent="${spec%%=*}" p="" custom=0
    case "$spec" in *=*) p="${spec#*=}" ;; esac
    known_agent "$agent" || fail "--dir: unknown agent '$agent' (use claude, codex, agy, gemini, opencode or other)"
    if [ "$agent" = codex ]; then
      [ -z "$p" ] || fail "--dir: Codex reads the shared copy at $(tilde "$SKILLS_DIR"); give no path"
      CODEX_HINT=1
      continue
    fi
    if [ -n "$p" ]; then
      p="$(expand_path "$p")" || fail "--dir: could not expand '$spec'"
      custom=1
    else
      [ "$agent" != other ] || fail "--dir: other needs a path (other=/path/to/skills)"
      p="$(default_path "$agent")"
    fi
    if [ "$agent" = claude ]; then
      i="$(row_with_path "$p" -1)"
      if [ "$i" -ge 0 ] && [ "${R_AGENT[$i]}" != claude ]; then i=-1; fi
    else
      i="$(saved_row_for "$agent" "$p" " $(on_rows) ")"
    fi
    err="$(path_error "$p" "$i")"
    [ -z "$err" ] || fail "--dir $spec: $err"
    warn="$(claude_warning "$agent" "$p")"
    if [ -n "$warn" ]; then echo "! $warn"; fi
    if [ "$i" -ge 0 ]; then
      R_PATH[$i]="$p" R_CUSTOM[$i]="$custom" R_ON[$i]=1
    else
      add_row "$agent" "$p" 1 "$custom" 1 -
    fi
  done
}

on_rows() {
  local i=0 n out=""
  n="$(row_count)"
  while [ "$i" -lt "$n" ]; do
    if [ "${R_ON[$i]}" = 1 ]; then out="$out $i"; fi
    i=$((i + 1))
  done
  echo "$out"
}

plan_add() { P_ACT+=("$1") P_LINK+=("$2") P_DEST+=("$3") P_NOTE+=("$4"); }

build_plan() {
  local i=0 n v link dest note shared
  P_ACT=() P_LINK=() P_DEST=() P_NOTE=()
  shared="$(resolve "$SKILLS_DIR")"
  note="(shared copy)"
  for v in "${SKILLS[@]}"; do plan_add copy "$SKILLS_DIR/$v" "" "$note"; note=""; done
  n="$(row_count)"
  while [ "$i" -lt "$n" ]; do
    if [ "${R_ON[$i]}" = 1 ] && ! is_shared "$i"; then
      if [ "$(resolve "${R_PATH[$i]}")" = "$shared" ]; then
        plan_add unchanged "${R_PATH[$i]}" "" "(same folder as the shared copy)"
      else
        note=""
        if [ ! -d "${R_PATH[$i]}" ]; then note="(create folder)"; fi
        for v in "${SKILLS[@]}"; do
          link="${R_PATH[$i]}/$v" dest="$SKILLS_DIR/$v"
          if [ -L "$link" ] && [ "$(readlink "$link")" = "$dest" ]; then
            plan_add unchanged "$link" "$dest" ""
          elif [ -L "$link" ]; then
            plan_add replace "$link" "$dest" "(was -> $(readlink "$link"))"
          elif [ -e "$link" ]; then
            plan_add backup "$link" "$dest" "(moved to $v.bak-$STAMP, then linked)"
          else
            plan_add link "$link" "$dest" "$note"
            note=""
          fi
        done
      fi
    fi
    i=$((i + 1))
  done
}

show_plan() {
  local k=0
  echo
  echo "Plan:"
  while [ "$k" -lt "${#P_ACT[@]}" ]; do
    printf '  %-10s %s%s\n' "${P_ACT[$k]}" "$(tilde "${P_LINK[$k]}")" "${P_NOTE[$k]:+  ${P_NOTE[$k]}}"
    k=$((k + 1))
  done
}

execute_plan() {
  local k=0 link dest
  echo
  install_shared
  echo "✓ Copied ${#SKILLS[@]} skills to $(tilde "$SKILLS_DIR")"
  while [ "$k" -lt "${#P_ACT[@]}" ]; do
    link="${P_LINK[$k]}" dest="${P_DEST[$k]}"
    case "${P_ACT[$k]}" in
      unchanged) echo "✓ Unchanged $(tilde "$link")" ;;
      link|replace)
        mkdir -p "$(dirname "$link")"
        ln -sfn "$dest" "$link"
        echo "✓ Linked $(tilde "$link")"
        ;;
      backup)
        mv "$link" "$link.bak-$STAMP"
        ln -sfn "$dest" "$link"
        echo "✓ Moved $(tilde "$link") to $(basename "$link").bak-$STAMP and linked it"
        ;;
    esac
    k=$((k + 1))
  done
}

save_targets() {
  local i=0 n args=()
  n="$(row_count)"
  while [ "$i" -lt "$n" ]; do
    if [ "${R_ON[$i]}" = 1 ]; then args+=("${R_AGENT[$i]}" "${R_PATH[$i]}" "${R_CUSTOM[$i]}"); fi
    i=$((i + 1))
  done
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"
  node -e '
    const fs = require("fs");
    const [file, shared, installedAt, ...rest] = process.argv.slice(1);
    const targets = [];
    for (let i = 0; i < rest.length; i += 3) targets.push({ agent: rest[i], path: rest[i + 1], custom: rest[i + 2] === "1" });
    fs.writeFileSync(file, JSON.stringify({ version: 1, shared, targets, installedAt }, null, 2) + "\n", { mode: 0o600 });
    fs.chmodSync(file, 0o600);
  ' "$SAVED" "$SKILLS_DIR" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" ${args[@]+"${args[@]}"}
  echo "✓ Saved targets to $(tilde "$SAVED")"
}

agent_on() {
  local i=0 n
  n="$(row_count)"
  while [ "$i" -lt "$n" ]; do
    if [ "${R_AGENT[$i]}" = "$1" ] && [ "${R_ON[$i]}" = 1 ]; then return 0; fi
    i=$((i + 1))
  done
  return 1
}

next_hints() {
  local agent others=""
  echo
  echo "Next:"
  if agent_on claude; then echo '  Claude Code: /huddle-start "my room"'; fi
  if [ "$CODEX_HINT" = 1 ]; then
    echo '  Codex: $huddle-start "my room". Its sandbox blocks localhost by default; approve network'
    echo '  access when Codex asks, or add this to ~/.codex/config.toml:'
    echo '    [sandbox_workspace_write]'
    echo '    network_access = true'
  fi
  for agent in agy gemini opencode other; do
    if agent_on "$agent"; then others="${others:+$others, }$(agent_label "$agent")"; fi
  done
  if [ -n "$others" ]; then echo "  $others: ask \"start a huddle\""; fi
  echo
  echo "No skill in some agent? Paste the invite that /huddle-start prints instead."
}

# Prompts come from stdin when it is a terminal (or --interactive), else /dev/tty
# (curl | bash), else nowhere: defaults are used.
choose_input() {
  if [ "$YES" = 1 ]; then return; fi
  if [ "$INTERACTIVE" = 1 ] || [ -t 0 ]; then
    exec 3<&0
    PROMPT=1
  elif [ "${#DIRS[@]}" -gt 0 ]; then
    return
  elif [ -z "${AGENT_HUDDLE_NO_TTY:-}" ] && { : </dev/tty; } 2>/dev/null; then
    exec 3</dev/tty
    PROMPT=1
  else
    NO_TERMINAL=1
  fi
}

uninstall() {
  local i=0 n v link removed=0
  detect_rows 1
  apply_saved >/dev/null
  n="$(row_count)"
  while [ "$i" -lt "$n" ]; do
    if ! is_shared "$i"; then
      for v in "${SKILLS[@]}"; do
        link="${R_PATH[$i]}/$v"
        if [ -L "$link" ] && [ "$(readlink "$link")" = "$SKILLS_DIR/$v" ]; then
          rm "$link"
          echo "✓ Removed $(tilde "$link")"
          removed=1
        fi
      done
    fi
    i=$((i + 1))
  done
  for v in "${SKILLS[@]}"; do
    if [ -d "$SKILLS_DIR/$v" ] && [ ! -L "$SKILLS_DIR/$v" ]; then
      rm -rf "${SKILLS_DIR:?}/$v"
      echo "✓ Removed $(tilde "$SKILLS_DIR/$v")"
      removed=1
    fi
  done
  if [ -f "$SAVED" ]; then
    rm "$SAVED"
    echo "✓ Removed $(tilde "$SAVED")"
    removed=1
  fi
  if [ "$removed" = 0 ]; then echo "Nothing to remove."; fi
}

main() {
  parse_args "$@"
  check_node
  if [ "$UNINSTALL" = 1 ]; then uninstall; return; fi
  stage_files
  detect_rows 0
  if [ "${#DIRS[@]}" -gt 0 ]; then apply_dirs; else apply_saved; fi
  choose_input
  if [ "$PROMPT" = 1 ]; then run_menu; fi
  build_plan
  show_plan
  if [ "$PROMPT" = 1 ] && ! confirm "Proceed? [Y/n] " y; then
    echo "Nothing changed."
    return
  fi
  execute_plan
  save_targets
  if [ "$NO_TERMINAL" = 1 ]; then
    echo
    echo "No terminal; installed to detected targets. Rerun with --dir to choose."
  fi
  next_hints
}

main "$@"
