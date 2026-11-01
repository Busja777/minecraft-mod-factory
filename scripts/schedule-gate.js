import fs from 'fs';
import { localParts, parseHHMM, formatMinutes, slotFor, decide, localMidnightUtcIso } from './lib/schedule.js';
import { setOutputs, arg, flag } from './lib/github-output.js';

// Gate for the scheduled workflows. Decides whether this 30-minute cron fire is "the one" today.
// node scripts/schedule-gate.js --window morning|evening [--job <heavyJobName>] [--dry-run]
// env: NOW (ISO override for tests), FORCE=true (bypass), GITHUB_TOKEN/GITHUB_REPOSITORY/GITHUB_RUN_ID/GITHUB_WORKFLOW_REF
const argv = process.argv.slice(2);
const windowName = arg(argv, '--window');
if (!windowName) throw new Error('Usage: node scripts/schedule-gate.js --window morning|evening');
const dryRun = flag(argv, '--dry-run');

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

console.log(`Gate ${windowName}: local ${local.dateKey} ${formatMinutes(local.minutesOfDay)} (${timeZone}), window ${win[0]}-${win[1]}, today's slot ${formatMinutes(slot)}`);

if (process.env.FORCE === 'true') {
  console.log('FORCE=true — running immediately');
  setOutputs({ run: 'true', slot: formatMinutes(slot), reason: 'forced', dateKey: local.dateKey });
  process.exit(0);
}

// "Already ran today": a previous run of this workflow today whose heavy job succeeded or is still running.
async function ranToday() {
  const token = process.env.GITHUB_TOKEN;
  if (!token || repo === 'local') { console.log('No GITHUB_TOKEN — assuming no run today'); return false; }
  const workflowFile = (process.env.GITHUB_WORKFLOW_REF || '').split('@')[0].split('/').pop() || `${windowName}.yml`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const since = localMidnightUtcIso(now, timeZone);
  const q = new URLSearchParams({ created: `>=${since}`, per_page: '50' });
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs?${q}`, { headers });
  if (!res.ok) { console.log(`::warning::Could not list runs (${res.status}) — assuming no run today`); return false; }
  const runs = (await res.json()).workflow_runs || [];
  for (const run of runs) {
    if (String(run.id) === String(process.env.GITHUB_RUN_ID)) continue;
    const jr = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs?per_page=50`, { headers });
    if (!jr.ok) continue;
    const jobs = (await jr.json()).jobs || [];
    const heavy = jobs.find(j => j.name === heavyJob);
    if (heavy && (heavy.conclusion === 'success' || heavy.status === 'in_progress' || heavy.status === 'queued')) {
      console.log(`Heavy job "${heavyJob}" already ${heavy.conclusion || heavy.status} today in run ${run.id}`);
      return true;
    }
  }
  return false;
}

const already = await ranToday();
const decision = decide({ nowMinutes: local.minutesOfDay, slot, windowEnd: end, ranToday: already });
console.log(`Decision: run=${decision.run} (${decision.reason})${decision.sleepMinutes ? `, sleeping ${decision.sleepMinutes} min until slot` : ''}`);

if (decision.run && decision.sleepMinutes > 0 && !dryRun) {
  await new Promise(r => setTimeout(r, decision.sleepMinutes * 60 * 1000));
}
setOutputs({ run: String(decision.run), slot: formatMinutes(slot), reason: decision.reason, dateKey: local.dateKey });
