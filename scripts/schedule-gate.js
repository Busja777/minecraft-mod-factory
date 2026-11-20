import fs from 'fs';
import { localParts, parseHHMM, formatMinutes, slotFor, decide, planAccounts, localMidnightUtcIso } from './lib/schedule.js';
import { loadProjects, findProject } from './lib/cf-projects.js';
import { activeAccounts, accountOf, gameOf, gameKeyOf } from './lib/games.js';
import { setOutputs, arg, flag } from './lib/github-output.js';

// Gate for the scheduled workflows. Decides whether this 30-minute cron fire is "the one" today.
// node scripts/schedule-gate.js --window morning|evening [--job <heavyJobName>] [--dry-run]
// node scripts/schedule-gate.js --window evening --per-account
//   One leg per CurseForge account (config.games.<key>.account) that owns a published project: every
//   account draws its own slot and gets at most one update per day. Never sleeps; writes the legs
//   that start in this fire as `matrix` ([{ account, tokenEnv, sleep }], sleep in minutes) and `any`.
//   The heavy job of a leg is named update-<account>.
// env: NOW (ISO override for tests), FORCE=true (bypass), GITHUB_TOKEN/GITHUB_REPOSITORY/GITHUB_RUN_ID/GITHUB_WORKFLOW_REF,
//      INPUT_MOD_ID / INPUT_ACCOUNT (--per-account: only that project's account / that account; FORCE needs one of them)
const argv = process.argv.slice(2);
const windowName = arg(argv, '--window');
if (!windowName) throw new Error('Usage: node scripts/schedule-gate.js --window morning|evening');
const dryRun = flag(argv, '--dry-run');
const perAccount = flag(argv, '--per-account');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const timeZone = config.timezone || 'Europe/Berlin';
const win = config.windows?.[windowName];
if (!win) throw new Error(`No window "${windowName}" in config.json`);
const [start, end] = win.map(parseHHMM);
const heavyJob = arg(argv, '--job', windowName === 'morning' ? 'publish' : 'update');

const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const local = localParts(now, timeZone);
const repo = process.env.GITHUB_REPOSITORY || 'local';
const slot = slotFor({ dateKey: local.dateKey, windowName, salt: repo, start, end });

if (!perAccount) console.log(`Gate ${windowName}: local ${local.dateKey} ${formatMinutes(local.minutesOfDay)} (${timeZone}), window ${win[0]}-${win[1]}, today's slot ${formatMinutes(slot)}`);

if (perAccount) console.log(`Gate ${windowName}, one leg per account: local ${local.dateKey} ${formatMinutes(local.minutesOfDay)} (${timeZone}), window ${win[0]}-${win[1]}`);

// The jobs of today's earlier runs of this workflow. A heavy job counts as "ran today" when it
// succeeded or is still running (a leg waiting for its slot is running too).
const counts = j => j.conclusion === 'success' || j.status === 'in_progress' || j.status === 'queued';
async function jobsToday() {
  const token = process.env.GITHUB_TOKEN;
  if (!token || repo === 'local') { console.log('No GITHUB_TOKEN — assuming no run today'); return []; }
  const workflowFile = (process.env.GITHUB_WORKFLOW_REF || '').split('@')[0].split('/').pop() || `${windowName}.yml`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const since = localMidnightUtcIso(now, timeZone);
  const q = new URLSearchParams({ created: `>=${since}`, per_page: '50' });
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs?${q}`, { headers });
  if (!res.ok) { console.log(`::warning::Could not list runs (${res.status}) — assuming no run today`); return []; }
  const all = [];
  for (const run of (await res.json()).workflow_runs || []) {
    if (String(run.id) === String(process.env.GITHUB_RUN_ID)) continue;
    const jr = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs?per_page=50`, { headers });
    if (jr.ok) all.push(...((await jr.json()).jobs || []));
  }
  return all;
}

if (perAccount) {
  const projects = loadProjects();
  const modId = (process.env.INPUT_MOD_ID || '').trim();
  let only = (process.env.INPUT_ACCOUNT || '').trim() || null;
  let tokenEnvOfOnly = null;
  if (modId) {
    const p = findProject(projects, modId);
    if (!p) throw new Error(`No project with modId "${modId}" in data/cf-projects.json`);
    const g = gameOf(config, gameKeyOf(p));
    if (only && only !== g.account) throw new Error(`"${modId}" belongs to the account "${g.account}", not "${only}"`);
    only = g.account;
    tokenEnvOfOnly = g.tokenEnv;
  }
  const active = activeAccounts(config, projects);
  const tokenEnvOf = account => active.find(a => a.account === account)?.tokenEnv
    || Object.keys(config.games || {}).map(k => gameOf(config, k)).find(g => g.account === account)?.tokenEnv;
  if (only && !tokenEnvOfOnly) tokenEnvOfOnly = tokenEnvOf(only);
  if (only && !tokenEnvOfOnly) throw new Error(`Unknown account "${only}" — no game in config.json uses it`);

  let legs;
  if (process.env.FORCE === 'true') {
    if (!only) throw new Error('FORCE needs a modId or an account: a forced run starts exactly one account');
    console.log(`FORCE=true — running "${only}" immediately`);
    legs = [{ account: only, tokenEnv: tokenEnvOfOnly, sleep: 0 }];
  } else {
    // Runs from before the per-account split named the heavy job just "update"; it was the Minecraft account.
    const legacy = config.games?.bedrock ? gameOf(config, 'bedrock').account : null;
    const todays = await jobsToday();
    const ran = new Set(active.filter(a => todays.some(j => (j.name === `update-${a.account}` || (a.account === legacy && j.name === 'update')) && counts(j))).map(a => a.account));
    const plan = planAccounts({ accounts: active.map(a => a.account), dateKey: local.dateKey, windowName, salt: repo, start, end, nowMinutes: local.minutesOfDay, ran })
      .filter(x => !only || x.account === only);
    for (const x of plan) console.log(`  ${x.account}: slot ${formatMinutes(x.slot)}, run=${x.run} (${x.reason})${x.sleepMinutes ? `, starts in ${x.sleepMinutes} min` : ''}`);
    if (!plan.length) console.log('  no account has a published project');
    legs = plan.filter(x => x.run).map(x => ({ account: x.account, tokenEnv: tokenEnvOf(x.account), sleep: x.sleepMinutes }));
  }
  setOutputs({ matrix: JSON.stringify(legs), any: String(legs.length > 0), dateKey: local.dateKey });
  process.exit(0);
}

if (process.env.FORCE === 'true') {
  console.log('FORCE=true — running immediately');
  setOutputs({ run: 'true', slot: formatMinutes(slot), reason: 'forced', dateKey: local.dateKey });
  process.exit(0);
}

const already = (await jobsToday()).some(j => j.name === heavyJob && counts(j));
const decision = decide({ nowMinutes: local.minutesOfDay, slot, windowEnd: end, ranToday: already });
console.log(`Decision: run=${decision.run} (${decision.reason})${decision.sleepMinutes ? `, sleeping ${decision.sleepMinutes} min until slot` : ''}`);

if (decision.run && decision.sleepMinutes > 0 && !dryRun) {
  await new Promise(r => setTimeout(r, decision.sleepMinutes * 60 * 1000));
}
setOutputs({ run: String(decision.run), slot: formatMinutes(slot), reason: decision.reason, dateKey: local.dateKey });
