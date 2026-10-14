import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SKILLS = ['agent-huddle', 'huddle-start', 'huddle-join', 'huddle-rooms', 'huddle-end'];
export const SKILL_FILES = [
  'agent-huddle/SKILL.md',
  'agent-huddle/huddle.mjs',
  'agent-huddle/page.html',
  ...SKILLS.slice(1).map((name) => `${name}/SKILL.md`),
];
export const AGENTS = [
  { key: 'claude', label: 'Claude Code' },
  { key: 'codex', label: 'Codex' },
  { key: 'agy', label: 'Antigravity CLI' },
  { key: 'agy-app', label: 'Antigravity app' },
  { key: 'gemini', label: 'Gemini CLI' },
  { key: 'opencode', label: 'opencode' },
  { key: 'dsh', label: 'DeepSeek Harness' },
  { key: 'other', label: 'Other' },
];
export const DEFAULT_BASE_URL = 'https://agent-huddle.vercel.app';

const isDir = (p) => fs.statSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false;
const isFile = (p) => fs.statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
const lexists = (p) => fs.lstatSync(p, { throwIfNoEntry: false }) !== undefined;

export function labelOf(agent) {
  return AGENTS.find((a) => a.key === agent)?.label ?? 'Other';
}

export function knownAgent(agent) {
  return AGENTS.some((a) => a.key === agent);
}

export function locations(env = process.env) {
  const home = env.HOME || os.homedir();
  const stateDir = env.AGENT_HUDDLE_HOME || path.join(home, '.agent-huddle');
  return { home, shared: path.join(home, '.agents', 'skills'), stateDir, saved: path.join(stateDir, 'install.json') };
}

export function tilde(p, env = process.env) {
  const { home } = locations(env);
  if (p === home) return '~';
  if (p.startsWith(home + path.sep)) return '~' + p.slice(home.length);
  return p;
}

// Physical path of p, or of its nearest existing parent plus the missing rest.
export function resolvePath(p) {
  let dir = path.resolve(p);
  const rest = [];
  while (!isDir(dir) && dir !== path.dirname(dir)) {
    rest.unshift(path.basename(dir));
    dir = path.dirname(dir);
  }
  return path.join(fs.realpathSync(dir), ...rest);
}

// Expands ~ and $VARS and makes the path absolute; throws when a variable is not set.
export function expandPath(input, env = process.env) {
  const { home } = locations(env);
  let s = input.trim();
  if (s === '~') s = home;
  else if (s.startsWith('~/')) s = home + s.slice(1);
  s = s.replace(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g, (_, braced, bare) => {
    const name = braced || bare;
    if (env[name] === undefined) throw new Error(`$${name} is not set`);
    return env[name];
  });
  return path.resolve(s);
}

// Folders that hold macOS desktop apps. AGENT_HUDDLE_APP_DIRS overrides them (tests).
export function appDirs(env = process.env) {
  if (env.AGENT_HUDDLE_APP_DIRS !== undefined) return env.AGENT_HUDDLE_APP_DIRS.split(path.delimiter).filter(Boolean);
  return ['/Applications', path.join(locations(env).home, 'Applications')];
}

const isExecutable = (file) => {
  try {
    if (!fs.statSync(file).isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

// Full path of binary on PATH, or ''.
export function which(binary, env = process.env) {
  for (const dir of (env.PATH || '').split(path.delimiter)) {
    if (dir && isExecutable(path.join(dir, binary))) return path.join(dir, binary);
  }
  return '';
}

export function onPath(binary, env = process.env) {
  return Boolean(which(binary, env));
}

// Every harness we detect. bins: where a usable CLI may be, best first (the PATH name, then fixed
// installs and copies bundled in desktop apps), so a launcher can take the first that exists.
// signals: folders or apps that prove the harness is installed. skills: the folder it reads; Codex
// and DeepSeek Harness read the shared copy. Claude Code's folders come from claudeDirs, and its
// signals are the desktop app. Mirrored in skills/agent-huddle/huddle.mjs (harnesses).
export function harnesses(env = process.env) {
  const { home, shared } = locations(env);
  const at = (...p) => path.join(home, ...p);
  const cli = (name) => ({ name, label: `${name} on PATH` });
  const file = (p, label = tilde(p, env)) => ({ file: p, label });
  const app = (name, label, ...inside) => appDirs(env).map((dir) => file(path.join(dir, `${name}.app`, ...inside), label));
  return [
    {
      agent: 'claude',
      bins: [cli('claude')],
      signals: app('Claude', 'Claude desktop app'),
      skills: '',
    },
    {
      agent: 'codex',
      bins: [
        cli('codex'),
        ...app('ChatGPT', 'ChatGPT app', 'Contents', 'Resources', 'codex-cli', 'bin', 'codex'),
        ...app('Codex', 'Codex app', 'Contents', 'Resources', 'codex-cli', 'bin', 'codex'),
      ],
      signals: [file(at('.codex'))],
      skills: shared,
    },
    {
      agent: 'agy',
      bins: [cli('agy'), file(at('.local', 'bin', 'agy'))],
      signals: [file(at('.gemini', 'antigravity-cli'))],
      skills: at('.gemini', 'antigravity-cli', 'skills'),
    },
    {
      agent: 'agy-app',
      bins: [],
      signals: app('Antigravity', 'Antigravity app'),
      skills: at('.gemini', 'config', 'skills'),
    },
    {
      agent: 'gemini',
      bins: [cli('gemini')],
      signals: [file(at('.gemini', 'settings.json'))],
      skills: at('.gemini', 'skills'),
    },
    {
      agent: 'opencode',
      bins: [
        cli('opencode'),
        file(at('.opencode', 'bin', 'opencode')),
        ...app('OpenCode', 'OpenCode app', 'Contents', 'Resources', 'opencode-cli'),
      ],
      signals: [file(at('.config', 'opencode')), file(at('.local', 'share', 'opencode'))],
      skills: at('.config', 'opencode', 'skills'),
    },
    {
      agent: 'dsh',
      bins: [cli('dsh'), ...app('DeepSeek Harness', 'DeepSeek Harness app', 'Contents', 'Resources', 'runtime', 'cli', 'bin', 'dsh')],
      signals: [file(at('.dsh'))],
      skills: shared,
    },
  ];
}

const harness = (agent, env) => harnesses(env).find((h) => h.agent === agent);

// The binaries of a harness that exist, as { file, label }, one per real file.
export function foundBins(h, env = process.env) {
  const seen = new Set();
  const found = [];
  for (const bin of h.bins) {
    const file = bin.name ? which(bin.name, env) : isExecutable(bin.file) ? bin.file : '';
    if (!file || seen.has(fs.realpathSync(file))) continue;
    seen.add(fs.realpathSync(file));
    found.push({ file, label: bin.label });
  }
  return found;
}

// How a harness was found ('' when it was not): its binaries, else its first signal.
export function foundBy(h, env = process.env) {
  const bins = [...new Set(foundBins(h, env).map((b) => b.label))];
  if (bins.length) return bins.join(', ');
  return h.signals.find((s) => fs.existsSync(s.file))?.label ?? '';
}

function notFound(h) {
  const labels = [...new Set([h.bins[0], ...h.signals].filter(Boolean).map((s) => s.label))].slice(0, 2);
  return `not found (${labels.map((label) => `no ${label}`).join(', ')})`;
}

export function defaultPath(agent, env = process.env) {
  if (agent === 'claude') return path.join(env.CLAUDE_CONFIG_DIR || path.join(locations(env).home, '.claude'), 'skills');
  return harness(agent, env)?.skills ?? '';
}

function makeRow(agent, p, extra = {}) {
  return {
    agent,
    label: labelOf(agent),
    path: p,
    found: false,
    selected: false,
    custom: false,
    added: false,
    shared: false,
    idle: false,
    isNew: false,
    hint: false,
    detail: '',
    ...extra,
  };
}

export function customRow(agent, p) {
  return makeRow(agent, p, { custom: true, added: true, selected: true });
}

// Claude Code config dirs, deduplicated by resolved path. A dir is idle when it exists but has no
// projects/ (Claude Code keeps session transcripts there); $CLAUDE_CONFIG_DIR is never idle, and
// neither is ~/.claude when the Claude desktop app is installed: the app reads ~/.claude whatever
// CLAUDE_CONFIG_DIR says.
export function claudeDirs(env = process.env) {
  const { home } = locations(env);
  const desktop = foundBy({ bins: [], signals: harness('claude', env).signals }, env);
  const candidates = [];
  if (env.CLAUDE_CONFIG_DIR) candidates.push({ dir: env.CLAUDE_CONFIG_DIR, reason: 'CLAUDE_CONFIG_DIR', pinned: true });
  const dotClaude = path.join(home, '.claude');
  if (isDir(dotClaude)) {
    candidates.push({ dir: dotClaude, reason: desktop ? `folder exists, ${desktop} reads it` : 'folder exists', pinned: Boolean(desktop) });
  }
  let names = [];
  try {
    names = fs.readdirSync(home).sort();
  } catch {}
  for (const name of names) {
    if (name.startsWith('.claude-') && isFile(path.join(home, name, 'settings.json'))) {
      candidates.push({ dir: path.join(home, name), reason: 'has settings.json' });
    }
  }
  // claude on PATH or the desktop app without ~/.claude: either creates it on first use. Preselected
  // only when there is no other config dir, so installing never recreates a folder the user does not use.
  const via = desktop ? `${desktop} reads it` : !env.CLAUDE_CONFIG_DIR && onPath('claude', env) ? 'claude on PATH' : '';
  if (!isDir(dotClaude) && via) {
    const alone = !candidates.length;
    candidates.push({ dir: dotClaude, reason: alone ? via : `${via}, not created yet`, idle: !alone });
  }
  const seen = new Set();
  const dirs = [];
  for (const c of candidates) {
    const key = resolvePath(c.dir);
    if (seen.has(key)) continue;
    seen.add(key);
    const idle = c.idle ?? (!c.pinned && isDir(c.dir) && !isDir(path.join(c.dir, 'projects')));
    dirs.push({ dir: c.dir, reason: c.reason, idle });
  }
  return dirs;
}

// One row per agent (one per Claude config dir). Rows of agents that read the shared copy are
// marked shared: the copy is always installed, so they are never targets of their own.
export function detect(env = process.env) {
  const rows = [];
  const dirs = claudeDirs(env);
  for (const { dir, reason, idle } of dirs) {
    const absent = !isDir(dir);
    const detail = `${tilde(dir, env)} (${reason}${idle && !absent ? ', no sessions here' : ''})`;
    rows.push(makeRow('claude', path.join(dir, 'skills'), { found: true, selected: !idle, idle, absent, detail }));
  }
  if (!dirs.length) {
    const dir = env.CLAUDE_CONFIG_DIR || path.join(locations(env).home, '.claude');
    rows.push(makeRow('claude', path.join(dir, 'skills'), { detail: `not found (no claude on PATH, no ${tilde(dir, env)})` }));
  }
  const { shared } = locations(env);
  for (const h of harnesses(env)) {
    if (h.agent === 'claude') continue;
    const how = foundBy(h, env);
    const reads = h.skills === shared;
    const codex = h.agent === 'codex';
    const detail = how ? `${how}${reads && !codex ? ' (reads the shared copy)' : ''}` : notFound(h);
    rows.push(makeRow(h.agent, h.skills, { found: Boolean(how), selected: codex || (Boolean(how) && !reads), shared: reads, detail }));
  }
  return rows;
}

// The agents that read the shared copy, with the verb: "Codex and DeepSeek Harness read".
export function sharedReaders(rows) {
  const names = [...new Set(rows.filter((r) => r.shared).map((r) => r.label))];
  if (names.length < 2) return `${names[0] ?? 'No agent'} reads`;
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} read`;
}

// One line naming detected agents that are not among the saved targets, or ''.
export function newAgentsLine(rows, env = process.env) {
  const fresh = rows.filter((r) => r.isNew);
  if (!fresh.length) return '';
  const names = fresh.map((r) => `${r.label} (--dir ${r.agent === 'claude' ? `claude=${tilde(r.path, env)}` : r.agent})`);
  return `Found since last install, not added: ${names.join(', ')}. To add them, rerun install.sh without --yes, or pass --dir for every agent you want, saved ones included.`;
}

// Saved targets, or null when there is no install.json. Throws when it cannot be read.
export function loadSaved(env = process.env) {
  const file = locations(env).saved;
  if (!fs.existsSync(file)) return null;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const targets = Array.isArray(json?.targets) ? json.targets : [];
  return targets
    .filter((t) => t && typeof t.agent === 'string' && typeof t.path === 'string' && path.isAbsolute(t.path))
    .map((t) => ({ agent: knownAgent(t.agent) ? t.agent : 'other', path: t.path, custom: Boolean(t.custom) }));
}

// Saved targets win; detected agents missing from them are offered unchecked as new.
export function applySaved(rows, targets, env = process.env) {
  const { shared } = locations(env);
  const matched = new Set();
  for (const row of rows) if (!row.shared) row.selected = false;
  for (const t of targets) {
    if (t.agent === 'codex' && t.path === shared) continue;
    const want = resolvePath(t.path);
    const row = rows.find(
      (r) => r.agent === t.agent && !r.added && !r.shared && !matched.has(r) && (t.agent !== 'claude' || resolvePath(r.path) === want),
    );
    if (row) {
      Object.assign(row, { path: t.path, custom: t.custom, selected: true });
      matched.add(row);
    } else {
      const added = makeRow(t.agent, t.path, { custom: t.custom, selected: true, added: true });
      rows.push(added);
      matched.add(added);
    }
  }
  for (const row of rows) {
    if (!matched.has(row) && !row.shared && row.found && !row.idle) row.isNew = true;
  }
  return rows;
}

// Why a path cannot be a target, or ''. `skip` is the index of the row being edited (-1 for none).
export function pathError(rows, p, skip = -1, env = process.env) {
  if (fs.existsSync(p) && !isDir(p)) return `${tilde(p, env)} is a file`;
  const want = resolvePath(p);
  if (want === resolvePath(locations(env).shared)) return 'that is the shared copy itself';
  const dup = rows.findIndex((r, i) => i !== skip && resolvePath(r.path) === want);
  if (dup >= 0) return `already listed for ${rows[dup].label}`;
  let anc = p;
  while (!fs.existsSync(anc)) anc = path.dirname(anc);
  try {
    fs.accessSync(anc, fs.constants.W_OK);
  } catch {
    return `${tilde(anc, env)} is not writable`;
  }
  return '';
}

export function claudeWarning(agent, p, env = process.env) {
  const parent = path.dirname(p);
  if (agent !== 'claude' || isFile(path.join(parent, 'settings.json'))) return '';
  return `${tilde(parent, env)} has no settings.json; it may not be a Claude Code config dir`;
}

// Splits "agent=path" and applies it to the rows (in place). Throws on bad input before anything is written.
function applyDir(rows, spec, env) {
  const eq = spec.indexOf('=');
  const agent = eq < 0 ? spec : spec.slice(0, eq);
  const given = eq < 0 ? '' : spec.slice(eq + 1);
  if (!knownAgent(agent)) {
    const keys = AGENTS.map((a) => a.key);
    throw new Error(`--dir: unknown agent '${agent}' (use ${keys.slice(0, -1).join(', ')} or ${keys.at(-1)})`);
  }
  const reader = rows.find((r) => r.agent === agent && r.shared);
  if (reader) {
    if (given) throw new Error(`--dir: ${reader.label} reads the shared copy at ${tilde(locations(env).shared, env)}; give no path`);
    reader.hint = true;
    return '';
  }
  let p;
  if (given) {
    try {
      p = expandPath(given, env);
    } catch (err) {
      throw new Error(`--dir: could not expand '${spec}' (${err.message})`);
    }
  } else {
    if (agent === 'other') throw new Error('--dir: other needs a path (other=/path/to/skills)');
    p = defaultPath(agent, env);
  }
  const want = resolvePath(p);
  const index =
    agent === 'claude'
      ? rows.findIndex((r) => r.agent === 'claude' && resolvePath(r.path) === want)
      : rows.findIndex((r) => r.agent === agent && !r.added && !r.shared && !r.selected);
  const err = pathError(rows, p, index, env);
  if (err) throw new Error(`--dir ${spec}: ${err}`);
  if (index >= 0) Object.assign(rows[index], { path: p, custom: Boolean(given), selected: true });
  else rows.push(makeRow(agent, p, { custom: Boolean(given), selected: true, added: true }));
  return claudeWarning(agent, p, env);
}

// --dir: the targets are exactly these agents plus the shared copy. Returns warnings.
export function applyDirs(rows, specs, env = process.env) {
  for (const row of rows) if (!row.shared) row.selected = false;
  return specs.map((spec) => applyDir(rows, spec, env)).filter(Boolean);
}

export function timestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function readLink(p) {
  try {
    return fs.readlinkSync(p);
  } catch {
    return null;
  }
}

// Everything an install would do, in order. Nothing is written here.
export function buildPlan(rows, env = process.env, stamp = timestamp()) {
  const { shared } = locations(env);
  const actions = SKILLS.map((name) => ({ kind: 'copy', target: shared, name, path: path.join(shared, name) }));
  const sharedKey = resolvePath(shared);
  for (const row of rows) {
    if (!row.selected || row.shared) continue;
    const target = row.path;
    if (resolvePath(target) === sharedKey) {
      actions.push({ kind: 'unchanged', target, sameAsShared: true });
      continue;
    }
    if (!isDir(target)) actions.push({ kind: 'create', target });
    for (const name of SKILLS) {
      const link = path.join(target, name);
      const dest = path.join(shared, name);
      const was = readLink(link);
      if (was === dest) actions.push({ kind: 'unchanged', target, name, link, dest });
      else if (was !== null) actions.push({ kind: 'replace', target, name, link, dest, was });
      else if (lexists(link)) actions.push({ kind: 'backup', target, name, link, dest, backup: `${link}.bak-${stamp}` });
      else actions.push({ kind: 'link', target, name, link, dest });
    }
  }
  return { stamp, shared, actions };
}

// One line per target, plus explicit lines for anything that moves or replaces an existing entry.
export function planLines(plan, env = process.env) {
  const groups = new Map();
  for (const a of plan.actions) {
    const key = a.kind === 'copy' ? 'copy' : `target ${a.target}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  const lines = [];
  for (const actions of groups.values()) {
    const t = tilde(actions[0].target, env);
    const count = (kind) => actions.filter((a) => a.kind === kind).length;
    const skills = (n) => `${n} skill${n === 1 ? '' : 's'}`;
    if (actions[0].kind === 'copy') {
      lines.push(`copy ${skills(actions.length)} → ${t} (shared copy)`);
      continue;
    }
    if (actions[0].sameAsShared) {
      lines.push(`unchanged ${t} (same folder as the shared copy)`);
      continue;
    }
    const links = count('link');
    const unchanged = count('unchanged');
    const already = unchanged ? `${skills(unchanged)} already linked` : '';
    if (links) {
      const create = count('create') ? ' (create folder)' : '';
      lines.push(`link ${skills(links)} → ${t}${create}${already ? `; ${already}` : ''}`);
    } else if (unchanged) {
      lines.push(`unchanged ${t} (${already})`);
    }
    for (const a of actions) {
      if (a.kind === 'backup') lines.push(`backup ${tilde(a.link, env)} → ${path.basename(a.backup)}, then link`);
      if (a.kind === 'replace') lines.push(`replace ${tilde(a.link, env)} (was → ${a.was})`);
    }
  }
  return lines;
}

function link(dest, at) {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  if (lexists(at)) fs.unlinkSync(at);
  fs.symlinkSync(dest, at);
}

// Copies the staged files into the shared copy, then links, backs up and replaces as planned.
export function applyPlan(plan, stagedDir) {
  for (const file of SKILL_FILES) {
    const to = path.join(plan.shared, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(stagedDir, file), to);
  }
  fs.chmodSync(path.join(plan.shared, 'agent-huddle', 'huddle.mjs'), 0o755);
  for (const a of plan.actions) {
    if (a.kind === 'create') fs.mkdirSync(a.target, { recursive: true });
    if (a.kind === 'link' || a.kind === 'replace') link(a.dest, a.link);
    if (a.kind === 'backup') {
      fs.renameSync(a.link, a.backup);
      link(a.dest, a.link);
    }
  }
}

export function saveTargets(rows, env = process.env, date = new Date()) {
  const { stateDir, saved, shared } = locations(env);
  const targets = rows.filter((r) => r.selected).map((r) => ({ agent: r.agent, path: r.path, custom: r.custom }));
  const installedAt = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.chmodSync(stateDir, 0o700);
  fs.writeFileSync(saved, JSON.stringify({ version: 1, shared, targets, installedAt }, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(saved, 0o600);
  return saved;
}

// Next steps for the agents that were installed.
export function nextSteps(rows) {
  const on = (agent) => rows.some((r) => r.agent === agent && r.selected && !r.shared);
  const reads = (agent) => on(agent) || rows.some((r) => r.agent === agent && r.shared && (r.found || r.hint));
  const lines = [];
  if (on('claude')) lines.push('Claude Code: /huddle-start "my room"');
  if (reads('codex')) {
    lines.push(
      'Codex: $huddle-start "my room". Its sandbox blocks localhost by default; approve network',
      'access when Codex asks, or add this to ~/.codex/config.toml:',
      '  [sandbox_workspace_write]',
      '  network_access = true',
    );
  }
  const others = ['agy', 'agy-app', 'gemini', 'opencode', 'dsh', 'other'].filter(reads).map(labelOf);
  if (others.length) lines.push(`${others.join(', ')}: ask "start a huddle"`);
  return lines;
}

// What --uninstall removes: our links at detected and saved targets, the shared skill dirs and install.json.
export function uninstallPlan(env = process.env) {
  const { shared, saved } = locations(env);
  let targets = [];
  try {
    targets = loadSaved(env) ?? [];
  } catch {}
  const dirs = new Set([...detect(env).filter((r) => !r.shared).map((r) => r.path), ...targets.map((t) => t.path)]);
  dirs.delete(shared);
  const paths = [];
  for (const dir of dirs) {
    for (const name of SKILLS) {
      const at = path.join(dir, name);
      if (readLink(at) === path.join(shared, name)) paths.push(at);
    }
  }
  for (const name of SKILLS) {
    const dir = path.join(shared, name);
    if (isDir(dir) && readLink(dir) === null) paths.push(dir);
  }
  if (fs.existsSync(saved)) paths.push(saved);
  return paths;
}

export function uninstall(paths) {
  for (const p of paths) fs.rmSync(p, { recursive: true, force: true });
}

// Stages every skill file in a temp dir first, so a failed download never leaves a mixed install.
export async function stageSkills({ sourceDir, baseUrl = DEFAULT_BASE_URL } = {}) {
  const local = sourceDir && isFile(path.join(sourceDir, 'skills', 'agent-huddle', 'huddle.mjs')) ? path.join(sourceDir, 'skills') : null;
  const base = baseUrl.replace(/\/+$/, '');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-huddle-'));
  try {
    for (const file of SKILL_FILES) {
      const to = path.join(dir, file);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (local) fs.copyFileSync(path.join(local, file), to);
      else fs.writeFileSync(to, await download(`${base}/skills/${file}`));
    }
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  return { dir, from: local ?? base };
}

async function download(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`could not download ${url} (${err.cause?.code ?? err.message})`);
  }
  if (!res.ok) throw new Error(`could not download ${url} (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
