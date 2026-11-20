import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayPlan } from '../scripts/lib/cf-browser/tasks.js';
import { pullIfClean, commitData, closeUpdateIssue } from '../scripts/lib/cf-browser/tidy.js';

const NOW = new Date('2026-11-20T20:30:00Z');
const todo = [
  { cmd: 'seite', kind: 'skinpack', id: 'ninjas', label: 'Beschreibung nachziehen: Ninjas V1.2' },
  { cmd: 'publish', kind: 'skinpack', id: 'due-pack', label: 'Neues Projekt veröffentlichen: Due (Skinpack)' },
  { cmd: 'publish', kind: 'skinpack', id: 'later-pack', label: 'Neues Projekt veröffentlichen: Later (Skinpack)' },
  { cmd: 'update', kind: 'skinpack', id: 'samurai', label: 'Skinpack-Update hochladen: Samurai V1.3' },
  { cmd: 'seite', kind: 'skinpack', id: 'easter', label: 'Beschreibung nachziehen: Easter V1.1' }
];
const reviews = {
  'due-pack': { status: 'faellig', slot: '2026-11-20T08:00:00Z' },
  'later-pack': { status: 'geplant', slot: '2026-11-23T08:00:00Z' }
};

test('day list: files first, then due new projects, then descriptions; planned projects wait for their date', () => {
  const plan = dayPlan({ todo, waitingForGo: 2, reviews, now: NOW });
  assert.deepEqual(plan.tasks.map(t => `${t.cmd}:${t.id}`), ['update:samurai', 'publish:due-pack', 'seite:ninjas', 'seite:easter']);
  assert.equal(plan.planned, 1);
  assert.deepEqual(plan.counts, { uploads: 1, projects: 1, pages: 2 });
  assert.equal(plan.summary, 'Heute: 2 Beschreibungen, 1 neues Projekt, 1 Upload von Hand (1 neues Projekt ist für später geplant, 2 warten im Studio auf dein Go)');
  // A planned project becomes part of the day once its slot has passed, even before the Studio tick ran.
  const later = dayPlan({ todo, reviews, now: new Date('2026-11-23T09:00:00Z') });
  assert.ok(later.tasks.some(t => t.id === 'later-pack'));
  assert.equal(dayPlan({ todo: [], now: NOW }).summary, 'Heute ist nichts offen');
  assert.equal(dayPlan({ todo: [todo[0]], now: NOW }).summary, 'Heute: 1 Beschreibung');
});

// Fake shell: answers by command line, records every call.
function fakeShell(answers) {
  const calls = [];
  const exec = (cmd, args) => {
    const line = `${cmd} ${args.join(' ')}`;
    calls.push(line);
    const hit = Object.entries(answers).find(([k]) => line.startsWith(k));
    const a = hit ? hit[1] : {};
    return { status: a.status ?? 0, stdout: a.stdout ?? '', stderr: '' };
  };
  return { exec, calls };
}

test('pull only on main with a clean tree', () => {
  const clean = fakeShell({ 'git rev-parse': { stdout: 'main\n' }, 'git status': { stdout: '' } });
  assert.equal(pullIfClean(clean.exec), 'pulled');
  assert.ok(clean.calls.includes('git pull --ff-only --quiet'));
  const dirty = fakeShell({ 'git rev-parse': { stdout: 'main\n' }, 'git status': { stdout: ' M scripts/cf.js\n' } });
  assert.equal(pullIfClean(dirty.exec), 'skipped');
  assert.ok(!dirty.calls.some(c => c.startsWith('git pull')), 'work in progress is never touched');
  const branch = fakeShell({ 'git rev-parse': { stdout: 'feat/x\n' }, 'git status': { stdout: '' } });
  assert.equal(pullIfClean(branch.exec), 'skipped');
});

test('data/ is committed and pushed after a run, and nothing else is staged', () => {
  const sh = fakeShell({ 'git status --porcelain data/': { stdout: ' M data/cf-projects.json\n' }, 'git rev-parse': { stdout: 'main\n' } });
  assert.equal(commitData('chore(cf): neon-ninja project 123', sh.exec), 'pushed');
  assert.deepEqual(sh.calls.filter(c => /^git (add|commit|pull|push)/.test(c)), [
    'git add data/', 'git commit --quiet -m chore(cf): neon-ninja project 123 [skip ci]', 'git pull --rebase --quiet', 'git push --quiet'
  ]);
  assert.equal(commitData('x', fakeShell({ 'git status --porcelain data/': { stdout: '' } }).exec), 'nothing');
  const branch = fakeShell({ 'git status --porcelain data/': { stdout: ' M data/x\n' }, 'git rev-parse': { stdout: 'feat/x\n' } });
  assert.equal(commitData('x', branch.exec), 'not-main');
  assert.ok(!branch.calls.some(c => c.startsWith('git commit')), 'no commit outside main');
  const offline = fakeShell({ 'git status --porcelain data/': { stdout: ' M data/x\n' }, 'git rev-parse': { stdout: 'main\n' }, 'git push': { status: 1 } });
  assert.equal(commitData('x', offline.exec), 'committed');
});

test('the update issue is closed once the page shows the version, and only that issue', () => {
  const issues = JSON.stringify([
    { number: 21, title: 'Skinpack-Update V1.1: The Last Ninjas (the-last-ninjas)' },
    { number: 22, title: 'Skinpack-Update V1.2: The Last Ninjas (the-last-ninjas)' },
    { number: 23, title: "Skinpack-Update V1.2: Yubi's Easter Skins (yubi-s-easter-skins)" }
  ]);
  const sh = fakeShell({ 'gh issue list': { stdout: issues } });
  assert.equal(closeUpdateIssue({ slug: 'the-last-ninjas', version: '1.2', note: 'done' }, sh.exec), 22);
  assert.ok(sh.calls.includes('gh issue close 22 --comment done'));
  assert.equal(closeUpdateIssue({ slug: 'the-last-ninjas', version: '1.3', note: 'done' }, fakeShell({ 'gh issue list': { stdout: issues } }).exec), null);
  assert.equal(closeUpdateIssue({ slug: 'x', version: '1.0', note: 'n' }, fakeShell({ 'gh issue list': { status: 1 } }).exec), null, 'no gh, no crash');
});
