import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { stageToVersion, nextDueVersion, markVersionPublished, changelogFor } from '../scripts/lib/skinpacks.js';
import { buildMcpack, readMcpack, parseLang, manifestIssues, humanize } from '../scripts/lib/mcpack.js';
import { pickForUpdate, newEntry } from '../scripts/lib/cf-projects.js';

test('stage mapping V1/Un → versions', () => {
  assert.equal(stageToVersion('V1'), '1.0');
  assert.equal(stageToVersion('U1'), '1.1');
  assert.equal(stageToVersion('u4'), '1.4');
  assert.throws(() => stageToVersion('Granpa Skinpack U2'));
});

test('next due version and publishing', () => {
  const pack = { slug: 's', versions: [{ version: '1.0', status: 'published', skins: [] }, { version: '1.1', status: 'due', skins: [] }, { version: '1.2', status: 'due', skins: [] }] };
  assert.equal(nextDueVersion(pack).version, '1.1');
  markVersionPublished(pack, '1.1', { fileId: 7, now: new Date('2026-11-01T19:00:00Z') });
  assert.equal(nextDueVersion(pack).version, '1.2');
  assert.equal(pack.versions[1].fileId, 7);
});

test('changelog names every new skin', () => {
  const cl = changelogFor({ version: '1.2', title: 'The Celestial Guardians', note: 'Four guardians.', skins: [{ name: 'RAIKAGE — Storm Shogun' }] });
  assert.match(cl, /## V1\.2 — The Celestial Guardians/);
  assert.match(cl, /- RAIKAGE — Storm Shogun/);
});

test('buildMcpack round-trips through readMcpack with fresh UUIDs', () => {
  const png = Buffer.from('fakepng');
  const buf = buildMcpack({ packName: 'Samurai Saga', description: 'Test', skins: [{ name: 'RAIJIN — Thunder', png }, { name: 'MUGEN', png, slim: true }] });
  const pack = readMcpack(buf);
  assert.equal(pack.packTitle, 'Samurai Saga');
  assert.deepEqual(pack.skins.map(s => s.name), ['RAIJIN — Thunder', 'MUGEN']);
  assert.equal(pack.skins[1].slim, true);
  assert.notEqual(pack.manifest.header.uuid, pack.manifest.modules[0].uuid);
  assert.deepEqual(pack.issues, []);
  assert.ok(new AdmZip(buf).getEntry('texts/languages.json'));
});

test('manifest placeholders and 4D geometry are reported', () => {
  const issues = manifestIssues({ header: { name: 'pack.name || pack.description', description: '' }, modules: [] }, [{ texture: 'a.png', png: null, geometry: 'geometry.ronin4d' }]);
  assert.equal(issues.length, 4);
});

test('lang parsing and humanize', () => {
  assert.deepEqual(parseLang('skin.A.B=RAIJIN — X\n# c\n'), { 'skin.A.B': 'RAIJIN — X' });
  assert.equal(humanize('oni_kai_.png'), 'ONI KAI');
});

test('pickForUpdate respects the eligible filter across kinds', () => {
  const now = new Date('2026-11-01T19:00:00Z');
  const old = '2026-09-01T19:00:00Z';
  const mod = { ...newEntry({ modId: 'm', name: 'M' }), status: 'published', projectId: 1, lastPublishedAt: '2026-09-05T19:00:00Z' };
  const skin = { ...newEntry({ modId: 's', name: 'S', kind: 'skinpack' }), status: 'published', projectId: 2, lastPublishedAt: old };
  assert.equal(pickForUpdate([mod, skin], { now }).modId, 's');
  assert.equal(pickForUpdate([mod, skin], { now, eligible: p => p.kind !== 'skinpack' }).modId, 'm');
});

import { findPending, findUnassigned } from '../scripts/lib/cf-projects.js';

test('skin packs never enter the mod upload or kit backlog queues', () => {
  const skin = { ...newEntry({ modId: 's', name: 'S', kind: 'skinpack' }), projectId: 5 };
  const skinNoId = newEntry({ modId: 't', name: 'T', kind: 'skinpack' });
  assert.deepEqual(findPending([skin]), []);
  assert.deepEqual(findUnassigned([skinNoId]), []);
});

import { syncPackWithFiles } from '../scripts/platforms/curseforge-core.js';

test('CurseForge files mark matching versions as published and keep the latest game versions', () => {
  const pack = { versions: [{ version: '1.0', mcpack: 'A.mcpack', status: 'published' }, { version: '1.2', mcpack: 'C.mcpack', status: 'due' }, { version: '1.3', mcpack: 'D.mcpack', status: 'due' }] };
  const files = [{ id: 9, fileName: 'c.mcpack', fileDate: '2026-11-01T08:00:00Z', gameVersions: ['1.21.81', '26.60'] }, { id: 1, fileName: 'A.mcpack', fileDate: '2026-03-29T17:08:00Z', gameVersions: [] }];
  assert.deepEqual(syncPackWithFiles(pack, files), ['1.2']);
  assert.equal(pack.versions[1].fileId, 9);
  assert.equal(pack.versions[2].status, 'due');
  assert.deepEqual(pack.lastGameVersions, ['1.21.81', '26.60']);
});
