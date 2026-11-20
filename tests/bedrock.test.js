import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { listPacks, packOf, generate, checkPack, buildPack, manifest, stableUuid, fileName } from '../tools/bedrock/lib.js';
import { parseJsonc, samplesReady, samplesOf, DEFAULT_TAG } from '../tools/bedrock/samples.js';

// Mojang's samples are downloaded once by `npm run bedrock -- test`; without them the checks
// against vanilla are skipped instead of going online.
const skip = !samplesReady(DEFAULT_TAG) && 'bedrock-samples not downloaded yet (npm run bedrock -- test)';
const buf = o => Buffer.from(JSON.stringify(o));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bedrock-'));

test('Bedrock: Mojang\'s commented JSON is read, strings with // stay intact', () => {
  assert.deepEqual(parseJsonc('{\n  // a comment\n  "a": "http://x", /* b */ "b": [1, 2,],\n}'), { a: 'http://x', b: [1, 2] });
  assert.deepEqual(parseJsonc('{"q": "say \\"//hi\\""}'), { q: 'say "//hi"' });
});

test('Bedrock: pack UUIDs stay the same for a pack and differ between packs and parts', () => {
  const a = stableUuid('plank-cutter', 'bp-header');
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(a, stableUuid('plank-cutter', 'bp-header'));
  assert.notEqual(a, stableUuid('plank-cutter', 'bp-module'));
  assert.notEqual(a, stableUuid('calm-creepers', 'bp-header'));
});

test('Bedrock: manifest of a behavior pack and of an add-on', () => {
  const pack = { slug: 'probe', name: 'Probe', description: 'A probe', kind: 'behavior', minEngine: [1, 26, 60] };
  const m = manifest(pack, 'bp', '1.2');
  assert.equal(m.format_version, 2);
  assert.deepEqual(m.header.version, [1, 2, 0]);
  assert.deepEqual(m.header.min_engine_version, [1, 26, 60]);
  assert.equal(m.modules[0].type, 'data');
  assert.equal(m.dependencies, undefined);
  const addon = { ...pack, kind: 'addon' };
  const bp = manifest(addon, 'bp', '1.0');
  const rp = manifest(addon, 'rp', '1.0');
  assert.equal(rp.modules[0].type, 'resources');
  assert.deepEqual(bp.dependencies, [{ uuid: rp.header.uuid, version: [1, 0, 0] }], 'the behavior pack pulls in its resource pack');
  assert.equal(fileName(addon, '1.0'), 'Probe-1.0.mcaddon');
  assert.equal(fileName(pack, '1.0'), 'Probe-1.0.mcpack');
});

test('Bedrock: every pack folder is complete', () => {
  for (const slug of listPacks()) {
    const pack = packOf(slug);
    for (const f of ['pack.js', 'page.json', path.join('changelogs', '1.0.md')]) assert.ok(fs.existsSync(path.join(pack.dir, f)), `${slug}: ${f} is missing`);
  }
});

for (const slug of listPacks()) {
  test(`Bedrock ${slug}: the pack passes the checks against the samples and builds`, { skip }, async () => {
    const pack = packOf(slug);
    const samples = samplesOf(pack.samples);
    const files = await generate(pack, samples);
    assert.deepEqual(checkPack(pack, files, samples), []);
    const zip = new AdmZip(await buildPack(pack, files, '1.3', tmp()));
    const names = zip.getEntries().map(e => e.entryName);
    const manifests = names.filter(n => n.endsWith('manifest.json'));
    assert.equal(manifests.length, pack.kind === 'addon' ? 2 : 1);
    for (const m of manifests) assert.deepEqual(JSON.parse(zip.readAsText(m)).header.version, [1, 3, 0]);
  });
}

test('Bedrock: the checks catch what the game would not read', { skip }, () => {
  const samples = samplesOf(DEFAULT_TAG);
  const recipe = (item, extra = {}) => ({ format_version: '1.20.10', 'minecraft:recipe_shapeless': { description: { identifier: 'probe:x' }, ingredients: [{ item }], unlock: [{ item }], result: { item: 'minecraft:oak_stairs', count: 1 }, tags: ['stonecutter'], ...extra } });
  const pack = { slug: 'probe', kind: 'behavior' };
  const problems = checkPack(pack, {
    'bp/recipes/a.json': buf(recipe('minecraft:oak_plank')),
    'bp/recipes/b.json': buf({ format_version: '1.20.10', 'minecraft:recipe_shapeless': { description: { identifier: 'nonamespace' }, ingredients: [], result: { item: 'minecraft:stick' } } }),
    'bp/recipes/c.json': buf({ format_version: '1.20.10', 'minecraft:recipe_woodcutting': {} }),
    'bp/loot_tables/gameplay/fishing.json': buf({ format_version: '9.9', pools: [{ entries: [{ type: 'loot_table', name: 'loot_tables/gameplay/fishing/nope.json' }, { type: 'item', name: 'minecraft:fishy' }] }] }),
    'bp/Recipes/d.json': buf({}),
    'bp/recipes/e.json': Buffer.from('{ broken'),
    'bp/recipes/sub/f.json': buf(recipe('minecraft:oak_planks')),
    'rp/sounds/sound_definitions.json': buf({}),
    'bp/manifest.json': buf({})
  }, samples);
  const has = re => assert.ok(problems.some(p => re.test(p)), `expected a problem matching ${re}\n${problems.join('\n')}`);
  has(/a.json: unknown item minecraft:oak_plank/);
  has(/b.json: description.identifier needs a namespace/);
  has(/b.json: recipes since 1.20.10 need "unlock"/);
  has(/c.json: no known recipe type/);
  has(/fishing.json: replaces a vanilla file of format/);
  has(/fishing.json: loot table loot_tables\/gameplay\/fishing\/nope.json does not exist/);
  has(/fishing.json: unknown item minecraft:fishy/);
  has(/Recipes\/d.json: paths must be lowercase/);
  has(/e.json: not valid JSON/);
  has(/sub\/f.json: recipes lie flat in recipes\//);
  has(/rp\/sounds\/sound_definitions.json: a behavior pack only has bp\//);
  has(/manifest.json: manifest and icon are written by the build/);

  const sounds = checkPack({ slug: 'probe', kind: 'resource' }, {
    'rp/sounds/sound_definitions.json': buf({ format_version: '1.26.60', sound_definitions: { 'mob.villager.idle': { sounds: [{ name: 'sounds/mob/villager/idle9', volume: 0.4 }] }, 'mob.cow.mooo': { sounds: [] }, 'mob.cow.say': { sounds: [{ name: 'sounds/mob/cow/say1', volume: 2 }] } } })
  }, samples);
  assert.ok(sounds.some(p => /mob.villager.idle points to sounds\/mob\/villager\/idle9/.test(p)), sounds.join('\n'));
  assert.ok(sounds.some(p => /unknown vanilla sound event mob.cow.mooo/.test(p)), sounds.join('\n'));
  assert.ok(sounds.some(p => /volume 2 outside/.test(p)), sounds.join('\n'));
});
