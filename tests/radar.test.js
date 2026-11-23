import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { latestJava, latestBedrockSamples, changes, merged, added, nextContent, compatLine, olderThan, waitingFor } from '../scripts/lib/radar.js';

test('radar: the newest Java release and test version come from Mojang\'s manifest', () => {
  assert.deepEqual(latestJava({ latest: { release: '26.3', snapshot: '26.4-snapshot-10' } }), { release: '26.3', snapshot: '26.4-snapshot-10' });
  // right after a release the manifest names the release as its own newest snapshot
  assert.deepEqual(latestJava({ latest: { release: '26.4', snapshot: '26.4' } }), { release: '26.4', snapshot: null });
});

test('radar: bedrock-samples tags split into release and preview', () => {
  const releases = [{ tag_name: 'v1.26.70.26-preview' }, { tag_name: 'v1.26.60.5' }, { tag_name: 'v1.26.70.24-preview' }, { tag_name: 'v1.26.50.3' }];
  assert.deepEqual(latestBedrockSamples(releases), { release: 'v1.26.60.5', preview: 'v1.26.70.26-preview' });
  assert.deepEqual(latestBedrockSamples([]), { release: null, preview: null });
});

test('radar: only what was read today can be a change, and the baseline keeps the rest', () => {
  const baseline = { checked: '2026-11-20', note: 'n', minecraftJava: { release: '26.3', snapshot: '26.4-snapshot-10', source: 'url' }, wowRetail: { newest: '12.1.7' } };
  assert.deepEqual(changes(baseline, { minecraftJava: { release: '26.3', snapshot: '26.4-snapshot-10' } }), []);
  const now = { minecraftJava: { release: '26.4', snapshot: null }, smapi: { newest: '4.5.3' } };
  assert.deepEqual(changes(baseline, now), [
    { source: 'minecraftJava', key: 'release', from: '26.3', to: '26.4' },
    { source: 'minecraftJava', key: 'snapshot', from: '26.4-snapshot-10', to: null },
    { source: 'smapi', key: 'newest', from: null, to: '4.5.3' }
  ]);
  const out = merged(baseline, now, '2026-12-15');
  assert.equal(out.checked, '2026-12-15');
  assert.deepEqual(out.minecraftJava, { release: '26.4', snapshot: null, source: 'url' });
  assert.deepEqual(out.wowRetail, { newest: '12.1.7' }, 'a source that was not read stays as it was');
  assert.equal(out.note, 'n');
});

test('radar: what the next version adds, per registry', () => {
  assert.deepEqual(added(new Set(['stone', 'ice']), new Set(['ice', 'snow_bricks', 'icicle', 'stone'])), ['icicle', 'snow_bricks']);
  const before = { item: new Set(['stone']), block: new Set(['stone']), biome: new Set(['plains']) };
  const after = { item: new Set(['stone', 'icicle']), block: new Set(['stone']), biome: new Set(['plains', 'ice_caves']), mob_effect: new Set(['freezing']) };
  assert.deepEqual(nextContent(before, after), { item: ['icicle'], biome: ['ice_caves'], mob_effect: ['freezing'] });
});

test('radar: one line per pack and version', () => {
  assert.equal(compatLine('hush', '26.3', { ok: true, loaded: false, problems: [] }), '✓ hush on 26.3 (checked against the data)');
  assert.equal(compatLine('villages-nearby', '26.3', { ok: true, loaded: true, problems: [] }), '✓ villages-nearby on 26.3 (loaded by the game)');
  assert.equal(compatLine('x', '26.3', { ok: false, loaded: true, problems: ['a', 'b'], more: 48 }), '✗ x on 26.3: 50 problem(s), first: a');
});

test('radar: the baseline and the report in data/radar are well-formed', () => {
  const versions = JSON.parse(fs.readFileSync('data/radar/versions.json', 'utf-8'));
  assert.match(versions.checked, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(versions.minecraftJava.release);
  if (!fs.existsSync('data/radar/java.json')) return;
  const java = JSON.parse(fs.readFileSync('data/radar/java.json', 'utf-8'));
  assert.ok(java.release);
  for (const [slug, pack] of Object.entries(java.packs)) {
    for (const version of [java.release, java.snapshot].filter(Boolean)) {
      if (!pack[version]) continue;
      if (pack[version].waiting) {
        // built ahead for a coming version: not checked on older ones (scripts/radar.js)
        assert.equal(pack[version].ok, null, `${slug} on ${version}: waiting, so not checked`);
        assert.match(pack[version].waiting, /^\d/, `${slug} on ${version}: waits for a version`);
        continue;
      }
      assert.equal(typeof pack[version].ok, 'boolean', `${slug} on ${version}`);
      assert.equal(pack[version].ok, pack[version].problems.length === 0, `${slug} on ${version}: ok and problems disagree`);
    }
  }
});

test('radar: a pack built ahead for a coming version waits instead of failing on older ones', () => {
  assert.equal(olderThan('26.3', '26.4'), true);
  assert.equal(olderThan('26.4-snapshot-10', '26.4'), false);
  assert.equal(olderThan('26.4', '26.4'), false);
  assert.equal(olderThan('1.21.1', '26.3'), true);
  assert.equal(olderThan('26.10', '26.4'), false);
  const ahead = { slug: 'ice-cave-advancements', waitsFor: '26.4' };
  assert.equal(waitingFor(ahead, '26.3'), '26.4');
  assert.equal(waitingFor(ahead, '26.4-snapshot-10'), null);
  assert.equal(waitingFor({ slug: 'hush' }, '26.3'), null);
  assert.equal(compatLine('ice-cave-advancements', '26.3', { ok: null, waiting: '26.4' }), '… ice-cave-advancements on 26.3: waits for 26.4');
});
