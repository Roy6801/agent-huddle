#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import { determineAgent } from '@vercel/detect-agent';
import {
  AGENTS, DEFAULT_BASE_URL, SKILLS, applyDirs, applyPlan, applySaved, buildPlan, claudeWarning, customRow, detect,
  expandPath, labelOf, loadSaved, locations, nextSteps, pathError, planLines, saveTargets, stageSkills, tilde,
  uninstall, uninstallPlan,
} from './core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const INVITE_LINE = 'No skill in some agent? Paste the invite that /huddle-start prints instead.';

const USAGE = `Usage: install.sh [--yes] [--dir agent[=path]]... [--dry-run] [--uninstall] [--help]
       node install.mjs [same options]

Copies the agent-huddle skills to ~/.agents/skills and links them into your agents' skills folders.
In a terminal it asks which agents to install for; otherwise it prints the plan and installs only
with --yes or --dir.

  --yes, -y            Install without prompts: the saved targets, else the detected agents.
  --dir agent[=path]   Install for exactly these agents (repeatable). Agents: claude, codex, agy,
                       gemini, opencode, other. Without a path the agent's default folder is used.
  --dry-run            Print the plan and exit.
  --uninstall          Remove our links, the shared skill folders and the saved targets
                       (asks first in a terminal; otherwise needs --yes).
  --help, -h           Show this help.

Env: AGENT_HUDDLE_BASE_URL (download source), AGENT_HUDDLE_HOME (where install.json lives),
AGENT_HUDDLE_NO_TTY=1 (install.sh never reads answers from /dev/tty; for tests and CI).`;

function parseArgs(argv) {
  const opts = { yes: false, dirs: [], dryRun: false, uninstall: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-y' || arg === '--yes') opts.yes = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--uninstall') opts.uninstall = true;
    else if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg.startsWith('--dir=')) opts.dirs.push(arg.slice('--dir='.length));
    else if (arg === '--dir') {
      if (i + 1 >= argv.length) throw new Error('--dir needs agent[=path]');
      opts.dirs.push(argv[++i]);
    } else throw new Error(`unknown option: ${arg}`);
  }
  return opts;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// Clack shows hints only on the focused or checked option, so the path goes in the label.
function rowHint(row) {
  const notes = [];
  if (row.custom) notes.push('custom');
  if (row.isNew) notes.push('new since last install');
  if (row.idle) notes.push('no sessions here');
  if (!row.found && !row.added) notes.push('not found');
  return notes.join(', ') || undefined;
}

function detectedLines(rows) {
  return rows
    .filter((r) => !r.added)
    .map((r) => `${r.found ? '✓' : '-'} ${r.label.padEnd(12)} ${r.detail}`);
}

function sharedLine(env) {
  return `The shared copy ${tilde(locations(env).shared, env)} is always installed (Codex reads it directly).`;
}

// Applies --dir or the saved targets to the detected rows. Returns warning lines.
function prepareRows(rows, opts, env) {
  if (opts.dirs.length) return applyDirs(rows, opts.dirs, env);
  try {
    const saved = loadSaved(env);
    if (saved) applySaved(rows, saved, env);
    return [];
  } catch {
    return [`Could not read ${tilde(locations(env).saved, env)}; using detected agents`];
  }
}

async function stage(env) {
  const staged = await stageSkills({ sourceDir: SCRIPT_DIR, baseUrl: env.AGENT_HUDDLE_BASE_URL || DEFAULT_BASE_URL });
  process.on('exit', () => fs.rmSync(staged.dir, { recursive: true, force: true }));
  return staged;
}

function install(rows, plan, staged, env) {
  applyPlan(plan, staged.dir);
  return saveTargets(rows, env);
}

async function runPlain(opts, env, agent) {
  const rows = detect(env);
  let warnings;
  try {
    warnings = prepareRows(rows, opts, env);
  } catch (err) {
    fail(err.message);
  }
  console.log('Agents:');
  for (const line of detectedLines(rows)) console.log(`  ${line}`);
  console.log(`  ${sharedLine(env)}`);
  for (const w of warnings) console.log(`! ${w}`);
  const plan = buildPlan(rows, env);
  console.log('\nPlan:');
  for (const line of planLines(plan, env)) console.log(`  ${line}`);
  if (opts.dryRun) {
    console.log('\nDry run; nothing installed.');
    return;
  }
  if (!opts.yes && !opts.dirs.length) {
    console.log('\nNothing installed. Rerun with --yes to install this plan, or --dir agent[=path] to choose.');
    if (agent.isAgent) console.log(`Running inside ${agent.agent.name}: ask your user which agents to install for before rerunning.`);
    return;
  }
  let staged;
  try {
    staged = await stage(env);
  } catch (err) {
    fail(err.message);
  }
  console.log(`\n✓ Skills staged from ${tilde(staged.from, env)}`);
  const saved = install(rows, plan, staged, env);
  console.log(`✓ Installed: ${planLines(plan, env).join('; ')}`);
  console.log(`✓ Saved targets to ${tilde(saved, env)}`);
  const next = nextSteps(rows);
  if (next.length) console.log(`\nNext:\n${next.map((l) => `  ${l}`).join('\n')}`);
  console.log(`\n${INVITE_LINE}`);
}

async function ask(prompt) {
  const value = await prompt;
  if (p.isCancel(value)) {
    p.cancel('Nothing changed.');
    process.exit(0);
  }
  return value;
}

function folderOptions(rows, env) {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.shared)
    .map(({ row, index }) => ({ value: index, label: `${row.label.padEnd(12)} ${tilde(row.path, env)}`, hint: rowHint(row) }));
}

// Asks for a folder until it is valid and any Claude warning is accepted. Returns the expanded path.
async function askFolder(rows, agent, skip, initialValue, env) {
  let value = initialValue;
  for (;;) {
    const answer = await ask(
      p.text({
        message: `Skills folder for ${labelOf(agent)}`,
        initialValue: value,
        placeholder: '~/path/to/skills',
        validate(input) {
          if (!input?.trim()) return 'Enter a folder';
          try {
            return pathError(rows, expandPath(input, env), skip, env) || undefined;
          } catch (err) {
            return err.message;
          }
        },
      }),
    );
    const folder = expandPath(answer, env);
    const warning = claudeWarning(agent, folder, env);
    if (!warning || (await ask(p.confirm({ message: `${warning}. Use it anyway?`, initialValue: false })))) return folder;
    value = answer;
  }
}

async function editFolder(rows, env) {
  const index = await ask(p.select({ message: 'Edit which folder?', options: folderOptions(rows, env) }));
  const row = rows[index];
  const folder = await askFolder(rows, row.agent, index, tilde(row.path, env), env);
  if (folder === row.path) return;
  Object.assign(row, { path: folder, custom: true, selected: true, isNew: false });
  p.log.step(`${row.label} → ${tilde(folder, env)} (custom)`);
}

async function addFolder(rows, env) {
  const agent = await ask(
    p.select({ message: 'Which agent reads this folder?', options: AGENTS.map((a) => ({ value: a.key, label: a.label })) }),
  );
  const folder = await askFolder(rows, agent, -1, '', env);
  const row = customRow(agent, folder);
  rows.push(row);
  p.log.step(`${row.label} → ${tilde(folder, env)} (custom)`);
}

async function chooseTargets(rows, env) {
  const shared = rows.findIndex((row) => row.shared);
  const options = folderOptions(rows, env);
  if (shared >= 0) {
    const row = rows[shared];
    options.unshift({ value: shared, label: `${row.label.padEnd(12)} ${tilde(row.path, env)}`, hint: 'shared copy, always installed' });
  }
  const picked = await ask(
    p.multiselect({
      message: 'Install the skills for',
      options,
      initialValues: options.filter((o) => rows[o.value].selected || o.value === shared).map((o) => o.value),
      required: false,
    }),
  );
  for (const o of options) rows[o.value].selected = picked.includes(o.value);
  if (shared >= 0 && !rows[shared].selected) {
    rows[shared].selected = true;
    p.log.warn(`Codex reads the shared copy ${tilde(rows[shared].path, env)}, so it is always installed.`);
  }
  for (;;) {
    const choice = await ask(
      p.select({
        message: 'Folders',
        initialValue: 'continue',
        options: [
          { value: 'continue', label: 'Continue' },
          { value: 'edit', label: 'Edit a folder' },
          { value: 'add', label: 'Add a custom folder' },
        ],
      }),
    );
    if (choice === 'continue') return;
    if (choice === 'edit') await editFolder(rows, env);
    else await addFolder(rows, env);
  }
}

async function runInteractive(env) {
  p.intro('agent-huddle');
  const spin = p.spinner();
  spin.start('Getting skills');
  let staged;
  try {
    staged = await stage(env);
  } catch (err) {
    spin.error(err.message);
    process.exit(1);
  }
  spin.stop(`${SKILLS.length} skills ready`);

  const rows = detect(env);
  const warnings = prepareRows(rows, { dirs: [] }, env);
  p.log.info(['Agents:', ...detectedLines(rows), sharedLine(env)].join('\n'));
  for (const w of warnings) p.log.warn(w);

  await chooseTargets(rows, env);
  const plan = buildPlan(rows, env);
  p.note(planLines(plan, env).join('\n'), 'Plan');
  if (!(await ask(p.confirm({ message: 'Proceed?', initialValue: true })))) {
    p.cancel('Nothing changed.');
    process.exit(0);
  }

  spin.start('Installing');
  const saved = install(rows, plan, staged, env);
  spin.stop(`Installed; saved targets to ${tilde(saved, env)}`);
  const next = nextSteps(rows);
  if (next.length) p.note(next.join('\n'), 'Next');
  p.outro(INVITE_LINE);
}

async function runUninstall(opts, env, canPrompt) {
  const paths = uninstallPlan(env);
  if (!paths.length) {
    console.log('Nothing to remove.');
    return;
  }
  const list = paths.map((x) => tilde(x, env));
  if (opts.yes) {
    uninstall(paths);
    for (const x of list) console.log(`✓ Removed ${x}`);
    return;
  }
  if (!canPrompt) {
    console.log(`Would remove:\n${list.map((x) => `  ${x}`).join('\n')}`);
    console.log('\nNothing removed. Rerun with --uninstall --yes to remove these.');
    return;
  }
  p.intro('agent-huddle uninstall');
  p.note(list.join('\n'), 'Remove');
  if (!(await ask(p.confirm({ message: 'Remove these?', initialValue: false })))) {
    p.cancel('Nothing changed.');
    process.exit(0);
  }
  uninstall(paths);
  p.outro(`Removed ${paths.length} item${paths.length === 1 ? '' : 's'}.`);
}

async function main(argv = process.argv.slice(2), env = process.env) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(USAGE);
    fail(err.message);
  }
  if (opts.help) {
    console.log(USAGE);
    return;
  }
  const agent = await determineAgent();
  const canPrompt = Boolean(process.stdin.isTTY) && !agent.isAgent;
  if (opts.uninstall) return runUninstall(opts, env, canPrompt);
  if (canPrompt && !opts.yes && !opts.dirs.length && !opts.dryRun) return runInteractive(env);
  return runPlain(opts, env, agent);
}

await main();
