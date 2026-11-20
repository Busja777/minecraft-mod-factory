import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { listPacks, packOf, generate, checkPack, buildZip, PACK_FORMAT, isMod, mcmeta, versionsOf, releaseName, formatOf } from '../tools/java/lib.js';
import { versionDir, javaFor } from '../tools/java/vanilla.js';
import { parseLoadLog, loadTest } from '../tools/java/loadtest.js';

// The vanilla reference data is downloaded once by `npm run java -- test`; without it these tests
// are skipped instead of going online.
const ready = version => fs.existsSync(path.join(versionDir(version), '.complete'));
const vanillaOf = version => {
  const dir = versionDir(version);
  return { dir, data: path.join(dir, 'data'), reports: path.join(dir, 'reports'), assets: path.join(dir, 'assets'), sounds: path.join(dir, 'sounds.json') };
};
const skip = !ready('1.21.1') && 'vanilla 1.21.1 not downloaded yet (npm run java -- test)';
const buf = o => Buffer.from(JSON.stringify(o));
// Fabric mods are checked in tests/fabric.test.js; these tests are for data and resource packs.
const packSlugs = () => listPacks().filter(slug => !isMod(packOf(slug)));

test('Java: every pack folder is complete', () => {
  for (const slug of packSlugs()) {
    const pack = packOf(slug);
    for (const mc of versionsOf(pack)) assert.ok(pack.gameVersions.includes(releaseName(mc)), `${slug}: gameVersions must include ${releaseName(mc)}`);
    for (const f of ['pack.js', 'page.json', path.join('changelogs', '1.0.md')]) assert.ok(fs.existsSync(path.join(pack.dir, f)), `${slug}: ${f} is missing`);
  }
});

for (const slug of packSlugs()) {
  test(`Java ${slug}: the pack passes the vanilla checks and zips with pack.mcmeta`, { skip }, async () => {
    const pack = packOf(slug);
    const vanilla = vanillaOf(pack.mc);
    const files = await generate(pack, vanilla);
    assert.deepEqual(checkPack(pack, files, vanilla), []);
    const more = [];
    for (const mc of pack.also || []) {
      if (!ready(mc)) return;   // the further versions are checked by `npm run java -- test`, which downloads them
      const theirs = await generate(pack, vanillaOf(mc), mc);
      assert.deepEqual(checkPack(pack, theirs, vanillaOf(mc)), [], `for Minecraft ${mc}`);
      more.push({ mc, files: theirs });
    }
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'java-zip-'));
    const zip = new AdmZip(await buildZip(pack, files, '1.2', out, more));
    const meta = JSON.parse(zip.readAsText('pack.mcmeta'));
    assert.equal(meta.pack.pack_format ?? meta.pack.min_format, formatOf(pack.mc, pack.kind));
    assert.match(meta.pack.description, /\(v1\.2\)$/);
    const rootFiles = more.length ? more.at(-1).files : files;
    const overlayFiles = zip.getEntries().filter(e => /^mc_[a-z0-9_]+\//.test(e.entryName)).length;
    assert.equal(zip.getEntries().length - overlayFiles, Object.keys(rootFiles).length + 1 + (fs.existsSync(path.join(pack.dir, 'logo.png')) ? 1 : 0));
  });
}

test('Java: the checks catch what the game would ignore or reject', { skip }, () => {
  const vanilla = vanillaOf('1.21.1');
  const data = { kind: 'data', mc: '1.21.1' };
  const problems = checkPack(data, {
    'data/x/recipes/a.json': buf({ type: 'minecraft:stonecutting', ingredient: { item: 'minecraft:oak_planks' }, result: { id: 'minecraft:oak_stairs', count: 1 } }),
    'data/x/recipe/b.json': buf({ type: 'minecraft:stonecutting', ingredient: { item: 'minecraft:oak_plank' }, result: { item: 'minecraft:oak_stairs' } }),
    'data/x/recipe/c.json': buf({ type: 'minecraft:woodcutting', ingredient: { tag: 'minecraft:planks' }, result: { id: 'minecraft:stick', count: 2 } }),
    'data/x/advancement/d.json': buf({ parent: 'minecraft:husbandry/nope', criteria: { a: { trigger: 'minecraft:planted' } }, display: { icon: { item: 'minecraft:wheat' } } }),
    'data/x/recipe/E.json': buf({}),
    'data/x/recipe/f.json': Buffer.from('{ broken'),
    'assets/minecraft/sounds.json': buf({})
  }, vanilla);
  const has = re => assert.ok(problems.some(p => re.test(p)), `expected a problem matching ${re}\n${problems.join('\n')}`);
  has(/recipes\/a.json: the folder is "recipe" since 1.21/);
  has(/b.json: unknown item minecraft:oak_plank/);
  has(/b.json: result needs an "id"/);
  has(/c.json: unknown recipe type minecraft:woodcutting/);
  has(/d.json: criterion a has unknown trigger minecraft:planted/);
  has(/d.json: display.icon needs an "id"/);
  has(/d.json: parent minecraft:husbandry\/nope does not exist/);
  has(/E.json: paths must be lowercase/);
  has(/f.json: not valid JSON/);
  has(/assets\/minecraft\/sounds.json: a data pack only has data\//);

  const sounds = checkPack({ kind: 'resource', mc: '1.21.1' }, {
    'assets/minecraft/sounds.json': buf({
      'entity.villager.ambient': { replace: true, sounds: [{ name: 'mob/villager/idle1', volume: 0.4 }, { name: 'mob/villager/idle9', volume: 0.4 }] },
      'entity.cow.mooo': { sounds: ['mob/cow/say1'] },
      'entity.cow.ambient': { sounds: [{ name: 'mob/cow/say1', volume: 2 }] }
    })
  }, vanilla);
  assert.ok(sounds.some(p => /points to missing sound mob\/villager\/idle9/.test(p)));
  assert.ok(sounds.some(p => /unknown sound event entity.cow.mooo/.test(p)));
  assert.ok(sounds.some(p => /volume 2 outside/.test(p)));
  assert.ok(!sounds.some(p => /idle1/.test(p)), 'a real sound passes');
});

// ── More than one Minecraft version in one zip ────────────────────────────────────────────────
test('Java: pack.mcmeta is written the way each version reads it', () => {
  assert.deepEqual(mcmeta({ kind: 'data', description: 'd', min: 48, max: 48 }), { pack: { description: 'd', pack_format: 48 } });
  assert.deepEqual(mcmeta({ kind: 'data', description: 'd', min: 121, max: 121 }), { pack: { description: 'd', min_format: 121, max_format: 121 } });
  // old and new: both spellings, the old version's files in an overlay that carries "formats" for the old game
  assert.deepEqual(mcmeta({ kind: 'data', description: 'd', min: 48, max: 121, overlays: [{ format: 48, to: 120, directory: 'mc_1_21_1' }] }), {
    pack: { description: 'd', pack_format: 48, supported_formats: { min_inclusive: 48, max_inclusive: 121 }, min_format: 48, max_format: 121 },
    overlays: { entries: [{ formats: { min_inclusive: 48, max_inclusive: 120 }, min_format: 48, max_format: 120, directory: 'mc_1_21_1' }] }
  });
  // new versions only: no "formats" (Minecraft 26.3 refuses it on overlays from format 82 on)
  assert.deepEqual(mcmeta({ kind: 'data', description: 'd', min: 121, max: 128, overlays: [{ format: 121, to: 127, directory: 'mc_26_3' }] }).overlays.entries, [{ min_format: 121, max_format: 127, directory: 'mc_26_3' }]);
  // an old game cannot read an overlay entry without "formats", the new game refuses one with it
  assert.throws(() => mcmeta({ kind: 'data', description: 'd', min: 48, max: 128, overlays: [{ format: 48, to: 120, directory: 'a' }, { format: 121, to: 127, directory: 'b' }] }), /cannot carry an overlay for format 121/);
  assert.equal(mcmeta({ kind: 'resource', description: 'd', min: 34, max: 34 }).pack.pack_format, 34);
});

test('Java: a pack for two versions keeps the newest files in the root and the old ones in an overlay', async () => {
  const pack = { slug: 'probe', name: 'Probe', description: 'Probe', kind: 'data', mc: '1.21.1', dir: fs.mkdtempSync(path.join(os.tmpdir(), 'java-probe-')) };
  const oldFiles = { 'data/p/recipe/a.json': buf({ ingredient: { item: 'minecraft:stone' } }), 'data/p/recipe/same.json': buf({ same: true }), 'data/p/recipe/old_only.json': buf({ old: true }) };
  const newFiles = { 'data/p/recipe/a.json': buf({ ingredient: 'minecraft:stone' }), 'data/p/recipe/same.json': buf({ same: true }) };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'java-zip-'));
  const zip = new AdmZip(await buildZip(pack, oldFiles, '1.1', out, [{ mc: '26.3', files: newFiles }]));
  assert.deepEqual(zip.getEntries().map(e => e.entryName).sort(), ['data/p/recipe/a.json', 'data/p/recipe/same.json', 'mc_1_21_1/data/p/recipe/a.json', 'mc_1_21_1/data/p/recipe/old_only.json', 'pack.mcmeta']);
  assert.equal(zip.readAsText('data/p/recipe/a.json'), newFiles['data/p/recipe/a.json'].toString());
  assert.equal(zip.readAsText('mc_1_21_1/data/p/recipe/a.json'), oldFiles['data/p/recipe/a.json'].toString());
  const meta = JSON.parse(zip.readAsText('pack.mcmeta'));
  assert.equal(meta.pack.pack_format, PACK_FORMAT['1.21.1'].data);
  assert.equal(meta.pack.max_format, PACK_FORMAT['26.3'].data);
  assert.equal(meta.overlays.entries[0].directory, 'mc_1_21_1');

  // nothing differs: no overlay folder, only the wider range
  const same = new AdmZip(await buildZip(pack, newFiles, '1.2', out, [{ mc: '26.3', files: newFiles }]));
  assert.equal(JSON.parse(same.readAsText('pack.mcmeta')).overlays, undefined);
  assert.equal(JSON.parse(same.readAsText('pack.mcmeta')).pack.supported_formats.max_inclusive, 121);
  // a file only the new version has would also be read by the old game
  await assert.rejects(buildZip(pack, { 'data/p/recipe/a.json': oldFiles['data/p/recipe/a.json'] }, '1.3', out, [{ mc: '26.3', files: newFiles }]), /only exist for 26.3/);
  await assert.rejects(buildZip({ ...pack, mc: '26.3' }, newFiles, '1.3', out, [{ mc: '1.21.1', files: oldFiles }]), /older than the base version/);
});

test('Java: the game\'s load report becomes a list of problems', () => {
  const log = [
    '[23:14:34] [ServerMain/INFO]: Included zip pack probe.zip',
    '[23:14:35] [ServerMain/ERROR]: Registry loading errors:',
    '> Errors in registry minecraft:recipe:',
    '>> Errors in element probe:oak_stairs:',
    'java.lang.IllegalStateException: Failed to parse probe:oak_stairs from pack file/probe.zip',
    '\tat net.minecraft.resources.RegistryLoadTask.x(RegistryLoadTask.java:1)',
    'Caused by: java.lang.IllegalStateException: Not a string: {"item":"minecraft:oak_planks"}',
    'Caused by: something deeper',
    '>> Errors in element probe:birch_stairs:',
    'Caused by: Unknown item minecraft:birch_plank',
    '[23:14:35] [ServerMain/WARN]: Failed to read pack file/other.zip metadata',
    '[23:14:36] [Server thread/INFO]: Started game test server'
  ].join('\n');
  assert.deepEqual(parseLoadLog(log), [
    { registry: 'minecraft:recipe', element: 'probe:oak_stairs', message: 'Not a string: {"item":"minecraft:oak_planks"}' },
    { registry: 'minecraft:recipe', element: 'probe:birch_stairs', message: 'Unknown item minecraft:birch_plank' },
    { registry: null, element: null, message: 'Failed to read pack file/other.zip metadata' }
  ]);
  assert.deepEqual(parseLoadLog('[23:14:36] [Server thread/INFO]: Started game test server'), []);
});

// The real thing, when Minecraft 26.3 is in the cache and a Java 25 is installed: Mojang's own
// headless test server loads the zip (tools/java/loadtest.js).
const noLoadTest = (!ready('26.3') && 'Minecraft 26.3 not downloaded yet (npm run radar)') || (!javaFor(25) && 'needs Java 25');
test('Java: Minecraft 26.3 loads a two-version pack and reports a wrong one', { skip: noLoadTest }, async () => {
  const pack = { slug: 'probe', name: 'Probe', description: 'Probe', kind: 'data', mc: '1.21.1', dir: fs.mkdtempSync(path.join(os.tmpdir(), 'java-probe-')) };
  const recipe = ingredient => buf({ type: 'minecraft:stonecutting', ingredient, result: { id: 'minecraft:oak_stairs', count: 1 } });
  const oldFiles = { 'data/probe/recipe/oak_stairs.json': recipe({ item: 'minecraft:oak_planks' }) };
  const newFiles = { 'data/probe/recipe/oak_stairs.json': recipe('minecraft:oak_planks') };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'java-zip-'));
  const good = loadTest('26.3', [await buildZip(pack, oldFiles, '1.0', out, [{ mc: '26.3', files: newFiles }])]);
  assert.deepEqual(good.errors, []);
  assert.deepEqual(good.included, ['Probe-1.0.zip']);
  // the old spelling in the root: 26.3 must name the recipe
  const bad = loadTest('26.3', [await buildZip({ ...pack, name: 'Wrong' }, newFiles, '1.0', out, [{ mc: '26.3', files: oldFiles }])]);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some(e => e.registry === 'minecraft:recipe' && e.element === 'probe:oak_stairs'), JSON.stringify(bad.errors));
});
