import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { skinsUpTo, stableUuid, missingSkins, ensureCompletePack } from '../scripts/lib/complete-pack.js';
import { buildMcpack, readMcpack } from '../scripts/lib/mcpack.js';
import { changelogFor } from '../scripts/lib/skinpacks.js';
import { syncPackWithFiles } from '../scripts/platforms/curseforge-core.js';

// Pack with three versions; files on disk under <tmp>/skins/<version>/<file>.
function fixture({ dueMcpack }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'complete-pack-'));
  const skins = { '1.0': ['a', 'b'], '1.1': ['c'], '1.2': ['d', 'e'] };
  const pack = { slug: 'test-pack', name: 'Test Pack', packName: 'Test Saga', versions: [] };
  for (const [version, names] of Object.entries(skins)) {
    fs.mkdirSync(path.join(dir, 'skins', version), { recursive: true });
    for (const n of names) fs.writeFileSync(path.join(dir, 'skins', version, `${n}.png`), `png-${n}`);
    pack.versions.push({ version, status: version === '1.2' ? 'due' : 'published', skins: names.map(n => ({ file: `${n}.png`, name: n.toUpperCase(), slim: false })) });
  }
  if (dueMcpack) {
    fs.mkdirSync(path.join(dir, 'mcpack'), { recursive: true });
    const png = n => Buffer.from(`png-${n}`);
    fs.writeFileSync(path.join(dir, 'mcpack', 'Due.mcpack'), buildMcpack({ packName: 'Due', description: 'd', skins: dueMcpack.map(n => ({ name: n.toUpperCase(), png: png(n) })) }));
    pack.versions[2].mcpack = 'Due.mcpack';
  }
  return { dir, pack, v: pack.versions[2] };
}

test('skinsUpTo collects the version and every earlier one, newest first', () => {
  const { pack } = fixture({});
  assert.deepEqual(skinsUpTo(pack, '1.2').map(s => s.name), ['D', 'E', 'C', 'A', 'B']);
  assert.deepEqual(skinsUpTo(pack, '1.1').map(s => s.name), ['C', 'A', 'B']);
});

test('an update file with only the new skins is replaced by a complete pack', () => {
  const { dir, pack, v } = fixture({ dueMcpack: ['d', 'e'] });
  const r = ensureCompletePack(pack, v, dir);
  assert.equal(r.built, true);
  assert.equal(r.total, 5);
  assert.equal(r.missing, 3);
  assert.equal(v.mcpack, 'Test_Saga_V1_2_Complete.mcpack');
  assert.equal(v.sourceMcpack, 'Due.mcpack');
  const built = readMcpack(path.join(dir, 'mcpack', v.mcpack));
  assert.equal(built.skins.length, 5);
  assert.deepEqual(built.issues, []);
  assert.deepEqual(built.manifest.header.version, [1, 2, 0]);
  assert.equal(built.manifest.header.uuid, stableUuid('test-pack:header'));
});

test('an update file that already has every skin is kept as it is', () => {
  const { dir, pack, v } = fixture({ dueMcpack: ['d', 'e', 'c', 'a', 'b'] });
  const before = fs.readFileSync(path.join(dir, 'mcpack', 'Due.mcpack'));
  const r = ensureCompletePack(pack, v, dir);
  assert.equal(r.built, false);
  assert.equal(v.mcpack, 'Due.mcpack');
  assert.equal(v.sourceMcpack, undefined);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'mcpack', 'Due.mcpack')), before);
});

test('a version without any .mcpack gets a complete pack too', () => {
  const { dir, pack, v } = fixture({});
  const r = ensureCompletePack(pack, v, dir);
  assert.equal(r.built, true);
  assert.equal(readMcpack(path.join(dir, 'mcpack', v.mcpack)).skins.length, 5);
});

test('complete packs of the same pack share a stable, valid UUID', () => {
  const u = stableUuid('glowing-samurai:header');
  assert.equal(u, stableUuid('glowing-samurai:header'));
  assert.notEqual(u, stableUuid('glowing-samurai:module'));
  assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('missingSkins finds textures that are missing and skins that were renamed', () => {
  const buf = buildMcpack({ packName: 'P', description: 'd', skins: [{ name: 'Blitz Haeuptling', png: Buffer.from('x') }, { name: 'Same', png: Buffer.from('z') }] });
  assert.deepEqual(missingSkins(buf, [{ name: 'Same', png: Buffer.from('z') }, { name: 'Y', png: Buffer.from('y') }]).map(s => s.name), ['Y']);
  assert.deepEqual(missingSkins(buf, [{ name: 'Lightning Chief', png: Buffer.from('x') }]).map(s => s.name), ['Lightning Chief'], 'a translated name needs a new file');
});

test('the changelog tells players the download has every skin', () => {
  const v = { version: '1.2', skins: [{ name: 'D' }, { name: 'E' }] };
  assert.match(changelogFor(v, { total: 5 }), /contains all 5 skins/);
  assert.doesNotMatch(changelogFor(v, { total: 2 }), /contains all/);
});

test('a hand upload of the original file is still recognised after the rename', () => {
  const pack = { versions: [{ version: '1.2', status: 'due', mcpack: 'Test_Saga_V1_2_Complete.mcpack', sourceMcpack: 'Due.mcpack' }] };
  assert.deepEqual(syncPackWithFiles(pack, [{ id: 9, fileName: 'Due.mcpack', fileDate: '2026-11-19T10:00:00Z', gameVersions: [] }]), ['1.2']);
});
