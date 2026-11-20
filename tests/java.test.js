import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { listPacks, packOf, generate, checkPack, buildZip, PACK_FORMAT, isMod } from '../tools/java/lib.js';
import { versionDir } from '../tools/java/vanilla.js';

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
    assert.ok(PACK_FORMAT[pack.mc], `${slug}: unknown Minecraft version`);
    assert.ok(pack.gameVersions.includes(pack.mc), `${slug}: gameVersions must include ${pack.mc}`);
    for (const f of ['pack.js', 'page.json', path.join('changelogs', '1.0.md')]) assert.ok(fs.existsSync(path.join(pack.dir, f)), `${slug}: ${f} is missing`);
  }
});

for (const slug of packSlugs()) {
  test(`Java ${slug}: the pack passes the vanilla checks and zips with pack.mcmeta`, { skip }, async () => {
    const pack = packOf(slug);
    const vanilla = vanillaOf(pack.mc);
    const files = await generate(pack, vanilla);
    assert.deepEqual(checkPack(pack, files, vanilla), []);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'java-zip-'));
    const zip = new AdmZip(await buildZip(pack, files, '1.2', out));
    const meta = JSON.parse(zip.readAsText('pack.mcmeta'));
    assert.equal(meta.pack.pack_format, PACK_FORMAT[pack.mc][pack.kind]);
    assert.match(meta.pack.description, /\(v1\.2\)$/);
    assert.equal(zip.getEntries().length, Object.keys(files).length + 1 + (fs.existsSync(path.join(pack.dir, 'logo.png')) ? 1 : 0));
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
