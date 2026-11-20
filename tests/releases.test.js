import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'node:child_process';
import {
  listReleaseProjects, loadReleaseProject, saveReleaseProject, newReleaseProject, addVersion,
  releaseFile, syncReleasesWithFiles, checkRelease
} from '../scripts/lib/releases.js';
import { nextDueVersion, hasDueVersion, markVersionPublished } from '../scripts/lib/skinpacks.js';

const REPO = path.resolve('.');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));

function project(root, { published = true } = {}) {
  const p = newReleaseProject({ slug: 'cozy-farm', game: 'stardewvalley', name: 'Cozy Farm', projectId: 4242 });
  addVersion(p, { version: '1.0', file: 'CozyFarm-1.0.zip', changelog: '## V1.0\n\nFirst release.' });
  addVersion(p, { version: '1.1', file: 'CozyFarm-1.1.zip', changelog: '## V1.1\n\nTwo new barns.' });
  if (published) p.versions[0].status = 'published';
  saveReleaseProject(p, root);
  fs.writeFileSync(releaseFile('cozy-farm', 'CozyFarm-1.0.zip', root), 'ZIP-ONE');
  fs.writeFileSync(releaseFile('cozy-farm', 'CozyFarm-1.1.zip', root), 'ZIP-TWO');
  return p;
}

test('a project round-trips and the skin pack helpers pick its next due version', () => {
  const root = tmp();
  assert.deepEqual(listReleaseProjects(root), []);
  project(root);
  assert.deepEqual(listReleaseProjects(root), ['cozy-farm']);
  const p = loadReleaseProject('cozy-farm', root);
  assert.equal(p.cfProjectId, 4242);
  assert.equal(nextDueVersion(p).version, '1.1');
  markVersionPublished(p, '1.1', { fileId: 9 });
  assert.equal(hasDueVersion(p), false);
  assert.equal(p.versions[1].fileId, 9);
  assert.throws(() => loadReleaseProject('nope', root), /No project/);
});

test('newReleaseProject and addVersion refuse incomplete or duplicate input', () => {
  assert.throws(() => newReleaseProject({ slug: 'Cozy Farm', game: 'x', name: 'x', projectId: 1 }), /Invalid slug/);
  assert.throws(() => newReleaseProject({ slug: 'cozy', game: 'x', name: 'x', projectId: 'abc' }), /projectId/);
  assert.equal(newReleaseProject({ slug: 'cozy', game: 'x', name: 'x', projectId: null }).cfProjectId, null, 'stock before the page exists');
  const p = newReleaseProject({ slug: 'cozy', game: 'stardewvalley', name: 'Cozy', projectId: 1 });
  const v = addVersion(p, { version: '1.0', file: 'a.zip', changelog: ' text \n', gameVersions: ['1.6.15'], displayName: 'Cozy 1.0' });
  assert.deepEqual(v, { version: '1.0', file: 'a.zip', changelog: 'text', status: 'due', displayName: 'Cozy 1.0', gameVersions: ['1.6.15'] });
  assert.throws(() => addVersion(p, { version: '1.0', file: 'b.zip', changelog: 'x' }), /already has a version 1.0/);
  assert.throws(() => addVersion(p, { version: '1.1', file: 'A.ZIP', changelog: 'x' }), /already has a file/);
  assert.throws(() => addVersion(p, { version: '1.1', file: 'b.zip', changelog: '  ' }), /changelog/);
  assert.throws(() => addVersion(p, { version: '1.1', changelog: 'x' }), /needs a file/);
});

test('a file uploaded by hand counts as published and hands its game versions on', () => {
  const root = tmp();
  const p = project(root);
  const changed = syncReleasesWithFiles(p, [
    { id: 71, fileName: 'cozyfarm-1.1.zip', fileDate: '2026-11-10T10:00:00Z', gameVersions: ['1.6.14', '1.6.15'] },
    { id: 70, fileName: 'CozyFarm-1.0.zip', fileDate: '2026-10-01T10:00:00Z', gameVersions: ['1.6.14'] }
  ]);
  assert.deepEqual(changed, ['1.1']);
  assert.equal(p.versions[1].status, 'published');
  assert.equal(p.versions[1].fileId, 71);
  assert.deepEqual(p.lastGameVersions, ['1.6.14', '1.6.15'], 'from the newest file');
  assert.deepEqual(syncReleasesWithFiles(p, []), []);
});

test('checkRelease refuses a missing, empty or unchanged file', () => {
  const root = tmp();
  const p = project(root);
  const v = nextDueVersion(p);
  assert.equal(checkRelease(p, v, root), releaseFile('cozy-farm', 'CozyFarm-1.1.zip', root));
  fs.writeFileSync(releaseFile('cozy-farm', 'CozyFarm-1.1.zip', root), 'ZIP-ONE');
  assert.throws(() => checkRelease(p, v, root), /identical to V1.0/);
  fs.writeFileSync(releaseFile('cozy-farm', 'CozyFarm-1.1.zip', root), '');
  assert.throws(() => checkRelease(p, v, root), /is empty/);
  fs.rmSync(releaseFile('cozy-farm', 'CozyFarm-1.1.zip', root));
  assert.throws(() => checkRelease(p, v, root), /is missing/);
});

// ── scripts in a throw-away repo: no token, no network ─────────────────────────────────────────
function repo({ entry = {}, published = true } = {}) {
  const dir = tmp();
  const config = JSON.parse(fs.readFileSync(path.join(REPO, 'config.json'), 'utf-8'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
  fs.mkdirSync(path.join(dir, 'data'));
  project(path.join(dir, 'data', 'projects'), { published });
  const entries = [
    { modId: 'cozy-farm', kind: 'file', game: 'stardewvalley', name: 'Cozy Farm', projectId: 4242, status: 'published', version: '1.0', lastPublishedAt: '2026-10-01T10:00:00.000Z', nextUpdateDue: null, updateCount: 0, files: [], ...entry },
    { modId: 'old-pack', kind: 'skinpack', game: 'bedrock', name: 'Old Pack', projectId: 77, status: 'published', version: '1.0', lastPublishedAt: '2026-09-01T10:00:00.000Z', nextUpdateDue: null, updateCount: 0, files: [] }
  ];
  fs.writeFileSync(path.join(dir, 'data', 'cf-projects.json'), JSON.stringify(entries, null, 2));
  return dir;
}
const cleanEnv = extra => ({ PATH: process.env.PATH, HOME: process.env.HOME, NOW: '2026-11-20T18:30:00Z', ...extra });
const run = (dir, script, args = [], env = {}) => execFileSync(process.execPath, [path.join(REPO, 'scripts', script), ...args], { cwd: dir, env: cleanEnv(env), encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });

test('release.js --dry-run shows the upload and changes nothing', () => {
  const dir = repo();
  const before = fs.readFileSync(path.join(dir, 'data', 'projects', 'cozy-farm', 'project.json'), 'utf-8');
  const out = run(dir, 'release.js', ['--project', 'cozy-farm', '--dry-run']);
  assert.match(out, /CF_API_TOKEN_STARDEWVALLEY not set/);
  assert.match(out, /"displayName": "CozyFarm-1.1.zip"/);
  assert.match(out, /Two new barns/);
  assert.match(out, /cozy-farm V1.1 \(Stardew Valley\): checked, nothing uploaded \[dry-run\]/);
  assert.equal(fs.readFileSync(path.join(dir, 'data', 'projects', 'cozy-farm', 'project.json'), 'utf-8'), before);
});

test('release.js refuses a real upload without the token of the game\'s account', () => {
  const dir = repo();
  assert.throws(() => run(dir, 'release.js', ['--project', 'cozy-farm'], { CF_API_TOKEN: 'token-of-the-minecraft-account' }), /CF_API_TOKEN_STARDEWVALLEY is missing/);
});

test('select-mode picks only projects of the leg\'s account', () => {
  const dir = repo();
  const stardew = run(dir, 'select-mode.js', [], { MODE: 'update', ACCOUNT: 'stardewvalley' });
  assert.match(stardew, /::output mode=update/);
  assert.match(stardew, /::output modId=cozy-farm/);
  assert.match(stardew, /::output kind=file/);
  // the Minecraft leg sees only the skin pack, which has nothing prepared here
  const minecraft = run(dir, 'select-mode.js', [], { MODE: 'update', ACCOUNT: 'minecraft' });
  assert.match(minecraft, /::output mode=skip/);
});

test('select-mode: a file project waits its 23 days and needs a prepared version', () => {
  const tooSoon = repo({ entry: { lastPublishedAt: '2026-11-10T10:00:00.000Z' } });
  assert.match(run(tooSoon, 'select-mode.js', [], { MODE: 'update', ACCOUNT: 'stardewvalley' }), /::output mode=skip/);
  const nothing = repo();
  const p = loadReleaseProject('cozy-farm', path.join(nothing, 'data', 'projects'));
  p.versions[1].status = 'published';
  saveReleaseProject(p, path.join(nothing, 'data', 'projects'));
  assert.match(run(nothing, 'select-mode.js', [], { MODE: 'update', ACCOUNT: 'stardewvalley' }), /::output mode=skip/);
});

test('select-mode: the first file of a new project only starts when asked for by name', () => {
  const dir = repo({ entry: { status: 'pending', lastPublishedAt: null }, published: false });
  assert.match(run(dir, 'select-mode.js', [], { MODE: 'update', ACCOUNT: 'stardewvalley' }), /::output mode=skip/);
  const asked = run(dir, 'select-mode.js', [], { MODE: 'update', ACCOUNT: 'stardewvalley', INPUT_MOD_ID: 'cozy-farm' });
  assert.match(asked, /::output modId=cozy-farm/);
  assert.match(asked, /::output kind=file/);
});

test('select-mode: a series project with its ID entered gets its first file by itself, before any update', () => {
  const dir = repo({ entry: { status: 'pending', lastPublishedAt: null, autoStart: true, serie: { reihe: 'stardew', nr: 3 } }, published: false });
  const out = run(dir, 'select-mode.js', [], { MODE: 'update', ACCOUNT: 'stardewvalley' });
  assert.match(out, /::output modId=cozy-farm/);
  assert.match(out, /::output reason=first-file/);
  assert.match(out, /::output kind=file/);
  // the gate opens a leg for an account that only has such a waiting project
  const gate = run(dir, 'schedule-gate.js', ['--window', 'evening', '--per-account'], { NOW: '2026-11-20T19:55:00Z' });
  assert.ok(JSON.parse(/::output matrix=(.*)/.exec(gate)[1]).some(l => l.account === 'stardewvalley'));
  // other accounts never see it
  assert.match(run(dir, 'select-mode.js', [], { MODE: 'update', ACCOUNT: 'minecraft' }), /::output mode=skip/);
});

test('release.js: a Minecraft Java file needs its exact game versions', () => {
  const dir = repo();
  const file = path.join(dir, 'data', 'projects', 'cozy-farm', 'project.json');
  const p = JSON.parse(fs.readFileSync(file, 'utf-8'));
  p.game = 'java';
  fs.writeFileSync(file, JSON.stringify(p));
  assert.throws(() => run(dir, 'release.js', ['--project', 'cozy-farm', '--dry-run']), /needs its game versions/);
  p.versions[1].gameVersions = ['1.21.1', 'Fabric'];
  fs.writeFileSync(file, JSON.stringify(p));
  assert.match(run(dir, 'release.js', ['--project', 'cozy-farm', '--dry-run']), /checked, nothing uploaded \[dry-run\]/);
});

test('schedule-gate --per-account: one leg per account, a forced run starts exactly one', () => {
  const dir = repo();
  const out = run(dir, 'schedule-gate.js', ['--window', 'evening', '--per-account'], { NOW: '2026-11-20T19:55:00Z' }); // 20:55 Berlin: every slot has passed
  const legs = JSON.parse(/::output matrix=(.*)/.exec(out)[1]);
  assert.deepEqual(legs, [
    { account: 'minecraft', tokenEnv: 'CF_API_TOKEN', sleep: 0 },
    { account: 'stardewvalley', tokenEnv: 'CF_API_TOKEN_STARDEWVALLEY', sleep: 0 }
  ]);
  assert.match(out, /::output any=true/);
  const early = run(dir, 'schedule-gate.js', ['--window', 'evening', '--per-account'], { NOW: '2026-11-20T15:00:00Z' });
  assert.match(early, /::output matrix=\[\]/);
  assert.match(early, /::output any=false/);
  const forced = run(dir, 'schedule-gate.js', ['--window', 'evening', '--per-account'], { NOW: '2026-11-20T08:00:00Z', FORCE: 'true', INPUT_MOD_ID: 'cozy-farm' });
  assert.deepEqual(JSON.parse(/::output matrix=(.*)/.exec(forced)[1]), [{ account: 'stardewvalley', tokenEnv: 'CF_API_TOKEN_STARDEWVALLEY', sleep: 0 }]);
  assert.throws(() => run(dir, 'schedule-gate.js', ['--window', 'evening', '--per-account'], { FORCE: 'true' }), /FORCE needs a modId or an account/);
  assert.throws(() => run(dir, 'schedule-gate.js', ['--window', 'evening', '--per-account'], { FORCE: 'true', INPUT_ACCOUNT: 'tetris' }), /Unknown account "tetris"/);
});
