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
  { key: 'agy', label: 'Antigravity' },
  { key: 'gemini', label: 'Gemini CLI' },
  { key: 'opencode', label: 'opencode' },
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

export function onPath(binary, env = process.env) {
  for (const dir of (env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const file = path.join(dir, binary);
    try {
      if (!fs.statSync(file).isFile()) continue;
      fs.accessSync(file, fs.constants.X_OK);
      return true;
    } catch {}
  }
  return false;
}

function fixedAgents(env) {
  const { home, shared } = locations(env);
  return [
    { agent: 'codex', signal: path.join(home, '.codex'), path: shared },
    { agent: 'agy', signal: path.join(home, '.gemini', 'antigravity-cli'), path: path.join(home, '.gemini', 'antigravity-cli', 'skills') },
    { agent: 'gemini', signal: path.join(home, '.gemini', 'settings.json'), path: path.join(home, '.gemini', 'skills') },
    { agent: 'opencode', signal: path.join(home, '.config', 'opencode'), path: path.join(home, '.config', 'opencode', 'skills') },
  ];
}

export function defaultPath(agent, env = process.env) {
  if (agent === 'claude') return path.join(env.CLAUDE_CONFIG_DIR || path.join(locations(env).home, '.claude'), 'skills');
  return fixedAgents(env).find((a) => a.agent === agent)?.path ?? '';
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
// projects/ (Claude Code keeps session transcripts there); $CLAUDE_CONFIG_DIR is never idle.
export function claudeDirs(env = process.env) {
  const { home } = locations(env);
  const candidates = [];
  if (env.CLAUDE_CONFIG_DIR) candidates.push({ dir: env.CLAUDE_CONFIG_DIR, reason: 'CLAUDE_CONFIG_DIR', pinned: true });
  const dotClaude = path.join(home, '.claude');
  if (isDir(dotClaude)) candidates.push({ dir: dotClaude, reason: 'folder exists' });
  let names = [];
  try {
    names = fs.readdirSync(home).sort();
  } catch {}
  for (const name of names) {
    if (name.startsWith('.claude-') && isFile(path.join(home, name, 'settings.json'))) {
      candidates.push({ dir: path.join(home, name), reason: 'has settings.json' });
    }
  }
  // claude on PATH with no config dir yet: it will use ~/.claude on first run.
  if (!candidates.length && onPath('claude', env)) candidates.push({ dir: dotClaude, reason: 'claude on PATH' });
  const seen = new Set();
  const dirs = [];
  for (const c of candidates) {
    const key = resolvePath(c.dir);
    if (seen.has(key)) continue;
    seen.add(key);
    const idle = !c.pinned && isDir(c.dir) && !isDir(path.join(c.dir, 'projects'));
    dirs.push({ dir: c.dir, reason: c.reason, idle });
  }
  return dirs;
}

// One row per agent (one per Claude config dir). The Codex row is the shared copy.
export function detect(env = process.env) {
  const rows = [];
  const dirs = claudeDirs(env);
  for (const { dir, reason, idle } of dirs) {
    const detail = `${tilde(dir, env)} (${reason}${idle ? ', no sessions here' : ''})`;
    rows.push(makeRow('claude', path.join(dir, 'skills'), { found: true, selected: !idle, idle, detail }));
  }
  if (!dirs.length) {
    const dir = env.CLAUDE_CONFIG_DIR || path.join(locations(env).home, '.claude');
    rows.push(makeRow('claude', path.join(dir, 'skills'), { detail: `not found (no claude on PATH, no ${tilde(dir, env)})` }));
  }
  for (const { agent, signal, path: p } of fixedAgents(env)) {
    let reason = '';
    if (onPath(agent, env)) reason = `${agent} on PATH`;
    else if (fs.existsSync(signal)) reason = tilde(signal, env);
    const found = Boolean(reason);
    const detail = found ? reason : `not found (no ${agent} on PATH, no ${tilde(signal, env)})`;
    const shared = agent === 'codex';
    rows.push(makeRow(agent, p, { found, selected: found || shared, shared, detail }));
  }
  return rows;
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
  if (!knownAgent(agent)) throw new Error(`--dir: unknown agent '${agent}' (use claude, codex, agy, gemini, opencode or other)`);
  if (agent === 'codex') {
    if (given) throw new Error(`--dir: Codex reads the shared copy at ${tilde(locations(env).shared, env)}; give no path`);
    rows.find((r) => r.shared).hint = true;
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
  const lines = [];
  if (on('claude')) lines.push('Claude Code: /huddle-start "my room"');
  if (on('codex') || rows.some((r) => r.shared && (r.found || r.hint))) {
    lines.push(
      'Codex: $huddle-start "my room". Its sandbox blocks localhost by default; approve network',
      'access when Codex asks, or add this to ~/.codex/config.toml:',
      '  [sandbox_workspace_write]',
      '  network_access = true',
    );
  }
  const others = ['agy', 'gemini', 'opencode', 'other'].filter(on).map(labelOf);
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
