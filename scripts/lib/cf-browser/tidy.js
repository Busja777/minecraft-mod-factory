import { spawnSync } from 'child_process';

// Housekeeping around a helper run, so nothing is left for the operator after the click:
// pull before, commit + push data/ after, close the update issue once CurseForge shows the page.
// exec(cmd, args) → { status, stdout, stderr }; injected in tests.
export const shell = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf-8' });
  return { status: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
};

const out = (exec, cmd, args) => exec(cmd, args).stdout.trim();
const clean = exec => out(exec, 'git', ['status', '--porcelain']) === '';
export const onMain = exec => out(exec, 'git', ['rev-parse', '--abbrev-ref', 'HEAD']) === 'main';

// Fetches what the evening run committed. Only on main and only with a clean tree, so it never
// touches work in progress. → 'pulled' | 'skipped' | 'failed'
export function pullIfClean(exec = shell) {
  if (!onMain(exec) || !clean(exec)) return 'skipped';
  return exec('git', ['pull', '--ff-only', '--quiet']).status === 0 ? 'pulled' : 'failed';
}

// Commits and pushes data/ (project ids, published versions). Nothing else is staged.
// → 'nothing' | 'not-main' | 'pushed' | 'committed' (push failed; the next run pushes it)
export function commitData(message, exec = shell) {
  if (out(exec, 'git', ['status', '--porcelain', 'data/']) === '') return 'nothing';
  if (!onMain(exec)) return 'not-main';
  exec('git', ['add', 'data/']);
  if (exec('git', ['commit', '--quiet', '-m', `${message} [skip ci]`]).status !== 0) return 'nothing';
  const pushed = exec('git', ['pull', '--rebase', '--quiet']).status === 0 && exec('git', ['push', '--quiet']).status === 0;
  return pushed ? 'pushed' : 'committed';
}

// The evening run opens "Skinpack-Update V1.x: <name> (<slug>)" (label cf-skin-update) with the
// description section. Once the page shows that version, the issue is done.
// → closed issue number or null
export function closeUpdateIssue({ slug, version, note }, exec = shell) {
  const r = exec('gh', ['issue', 'list', '--label', 'cf-skin-update', '--state', 'open', '--limit', '100', '--json', 'number,title']);
  if (r.status !== 0) return null;
  let issues;
  try { issues = JSON.parse(r.stdout); } catch { return null; }
  const hit = issues.find(i => i.title.startsWith(`Skinpack-Update V${version}:`) && i.title.endsWith(`(${slug})`));
  if (!hit) return null;
  return exec('gh', ['issue', 'close', String(hit.number), '--comment', note]).status === 0 ? hit.number : null;
}
