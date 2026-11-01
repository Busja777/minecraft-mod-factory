import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { saveMod, loadMod, listMods, metaFromGenerated, bumpMinor, latestChangelog, resolveWorkingMod } from '../scripts/lib/mods.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mods-'));
const gen = {
  name: 'HungerAlert', modId: 'hunger-alert', description: 'Warns on low hunger.',
  changelog: '## v1.0.0\n- Initial', javaCode: 'public class ModMain {}', imagePrompt: 'icon', features: ['hunger']
};

test('saveMod/loadMod round-trip and listMods', () => {
  const root = tmp();
  const meta = metaFromGenerated(gen, { now: new Date('2026-11-01T00:00:00Z') });
  saveMod('hunger-alert', { meta, javaCode: gen.javaCode }, root);
  const loaded = loadMod('hunger-alert', root);
  assert.equal(loaded.javaCode, gen.javaCode);
  assert.equal(loaded.meta.version, '1.0.0');
  assert.equal(loaded.meta.changelog[0].date, '2026-11-01');
  assert.deepEqual(listMods(root), ['hunger-alert']);
});

test('metaFromGenerated falls back for optional fields', () => {
  const meta = metaFromGenerated(gen);
  assert.equal(meta.pageDescription, gen.description);
  assert.equal(meta.cfCategory, 'Utility & QoL');
  assert.deepEqual(meta.altNames, []);
});

test('bumpMinor and latestChangelog', () => {
  assert.equal(bumpMinor('1.0.0'), '1.1.0');
  assert.equal(bumpMinor('2.9.3'), '2.10.0');
  assert.throws(() => bumpMinor('1.0'), /semver/);
  assert.equal(latestChangelog({ changelog: [{ text: 'a' }, { text: 'b' }] }), 'b');
  assert.equal(latestChangelog({}), '');
});

test('resolveWorkingMod reads stored mod with --mod and generated-mod.json without', () => {
  const root = tmp();
  saveMod('hunger-alert', { meta: metaFromGenerated(gen), javaCode: 'stored' }, root);
  const stored = resolveWorkingMod(['--mod', 'hunger-alert'], { root });
  assert.equal(stored.source, 'stored');
  assert.equal(stored.javaCode, 'stored');
  stored.saveJava('fixed');
  assert.equal(loadMod('hunger-alert', root).javaCode, 'fixed');

  const genPath = path.join(root, 'generated-mod.json');
  fs.writeFileSync(genPath, JSON.stringify(gen));
  const fresh = resolveWorkingMod([], { root, generatedPath: genPath });
  assert.equal(fresh.source, 'generated');
  assert.equal(fresh.modId, 'hunger-alert');
  fresh.saveJava('fixed2');
  assert.equal(JSON.parse(fs.readFileSync(genPath, 'utf-8')).javaCode, 'fixed2');
  assert.throws(() => resolveWorkingMod(['--mod'], { root }), /requires a modId/);
});
