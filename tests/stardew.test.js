import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { listPacks, packOf, generate, checkPack, buildZip, loadRef, latestVersion, semver, splitQueries, splitArgs, folderName } from '../tools/stardew/lib.js';
import { hasSchemas, loadSchema, parseObjectSprites, parseLoves, parseVillager, SEASONS } from '../tools/stardew/wiki.js';
import { validate, dotnetRegex } from '../tools/stardew/schema.js';
import { checkPage } from '../scripts/lib/page-check.js';
import { GIFTS } from '../tools/stardew/projects/villager-birthday-reminders/pack.js';

// The official schemas are downloaded once by `npm run stardew -- test`; without them the schema
// tests are skipped instead of going online. Everything else runs from the files in the repo.
const schemaSkip = !hasSchemas() && 'schemas not cached yet (npm run stardew -- test)';
const schemas = () => hasSchemas() ? { manifest: loadSchema('manifest'), contentPatcher: loadSchema('contentPatcher') } : null;
const ref = loadRef();
const buf = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o));

test('Stardew: every pack folder is complete', () => {
  assert.ok(listPacks().includes('villager-birthday-reminders'));
  for (const slug of listPacks()) {
    const pack = packOf(slug);
    assert.match(pack.uniqueId, /^SevEvolution\.[A-Z][A-Za-z0-9]+$/, slug);
    assert.match(pack.contentPatcher, /^\d+\.\d+\.\d+$/);
    assert.match(pack.minimumApiVersion, /^\d+\.\d+\.\d+$/);
    assert.ok(pack.gameVersions.length && pack.gameVersions.every(v => /^1\.6(\.\d+)?$/.test(v)), `${slug}: gameVersions must be 1.6.x`);
    for (const f of ['pack.js', 'page.json', path.join('changelogs', '1.0.md')]) assert.ok(fs.existsSync(path.join(pack.dir, f)), `${slug}: ${f} is missing`);
    const page = JSON.parse(fs.readFileSync(path.join(pack.dir, 'page.json'), 'utf-8'));
    assert.equal(page.class, 'Mods');
    assert.ok(['Gameplay Basics', 'Events', 'Visuals', 'Food', 'Items', 'UI', 'Miscellaneous'].includes(page.category), `${slug}: category ${page.category}`);
  }
});

test('Stardew: the reference data names its sources and is plausible', () => {
  for (const d of [ref.items, ref.npcs]) assert.match(d.fetched, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(ref.items.source, /^https:\/\/stardewvalleywiki\.com\//);
  assert.match(ref.npcs.source.loves, /Gift_taste_data/);
  assert.equal(ref.items.items['(O)24'], 'Parsnip');
  assert.equal(ref.items.items['(O)128'], 'Pufferfish');
  assert.ok(Object.keys(ref.items.items).length > 500);
  const npcs = ref.npcs.npcs;
  assert.equal(Object.keys(npcs).length, 34);
  assert.deepEqual(npcs.Abigail.birthday, { season: 'fall', day: 13 });
  assert.deepEqual(npcs.Krobus.birthday, { season: 'winter', day: 1 });
  assert.equal(npcs.Leo.island, true);
  const days = new Set();
  for (const [name, n] of Object.entries(npcs)) {
    assert.ok(SEASONS.includes(n.birthday.season) && n.birthday.day >= 1 && n.birthday.day <= 28, name);
    const key = `${n.birthday.season} ${n.birthday.day}`;
    assert.ok(!days.has(key), `two birthdays on ${key}`);
    days.add(key);
    assert.ok(n.loves.length, `${name} has no loved gifts`);
    assert.ok(n.loves.every(id => /^\(O\)\S+$/.test(id)), name);
  }
});

test('Stardew: the wiki parsers read the documented formats', () => {
  const sprites = '{|\n|-\n|[[File:Parsnip.png|24px|center]]\n|[[File:Springobjects025.png|24px|center]]\n|-\n|024\n|025\n|}';
  assert.deepEqual(parseObjectSprites(sprites), { '(O)24': 'Parsnip' });
  const gifts = 'as of {{version|1.6.15}}\n<syntaxhighlight lang="json">\n{\n  "Universal_Love": "74 446",\n  "Jas": "a/221 -5 doll_item FairyBox/b/1/c/2/d/3/e//"\n}\n</syntaxhighlight>';
  assert.deepEqual(parseLoves(gifts), { version: '1.6.15', loves: { Universal_Love: { ids: ['(O)74', '(O)446'], tags: [] }, Jas: { ids: ['(O)221', '(O)FairyBox'], tags: ['doll_item'] } } });
  assert.deepEqual(parseVillager('|birthday  = {{Season|Fall|13}}\n|favorites = {{Name|Amethyst}}{{Name|Pumpkin}}'), { birthday: { season: 'fall', day: 13 }, favorites: ['Amethyst', 'Pumpkin'] });
  assert.deepEqual(parseVillager('|birthday  = {{Season|Summer}} 8\n|favorites = {{Name|Orange}}').birthday, { season: 'summer', day: 8 });
});

test('Stardew: argument and condition splitting follows the trigger action format', () => {
  assert.deepEqual(splitArgs('AddFriendshipPoints "Mister Qi" 10'), ['AddFriendshipPoints', 'Mister Qi', '10']);
  assert.deepEqual(splitQueries('SEASON_DAY fall 13, !PLAYER_HAS_MET Current Abigail'), [['SEASON_DAY', 'fall', '13'], ['!PLAYER_HAS_MET', 'Current', 'Abigail']]);
  assert.deepEqual(splitQueries('ANY "SEASON spring, YEAR 2" TRUE'), [['ANY', 'SEASON spring, YEAR 2', 'TRUE']]);
  assert.equal(semver('1.0'), '1.0.0');
  assert.equal(semver('1.2.3'), '1.2.3');
  assert.throws(() => semver('1.x'), /Invalid version/);
});

for (const slug of listPacks()) {
  test(`Stardew ${slug}: passes every check and zips into one "[CP] <Name>" folder`, async () => {
    const pack = packOf(slug);
    const files = await generate(pack, ref, '1.2');
    assert.deepEqual(checkPack(pack, files, ref, schemas()), []);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'stardew-zip-'));
    const zip = new AdmZip(buildZip(pack, files, '1.2', out));
    const names = zip.getEntries().map(e => e.entryName);
    const tops = new Set(names.map(n => n.split('/')[0]));
    assert.deepEqual([...tops], [folderName(pack)]);
    const manifest = JSON.parse(zip.readAsText(`${folderName(pack)}/manifest.json`));
    assert.equal(manifest.Version, '1.2.0');
    assert.equal(manifest.UniqueID, pack.uniqueId);
    assert.equal(names.filter(n => !n.endsWith('/')).length, Object.keys(files).length);
    assert.throws(() => buildZip(pack, files, '1.3', out), /expected 1\.3\.0/);
    assert.ok(latestVersion(pack));
  });
}

test('Stardew: the checks catch packs the game or Content Patcher would reject', () => {
  const pack = { uniqueId: 'SevEvolution.Broken', contentPatcher: '2.9.0' };
  const manifest = { Name: 'Broken', Author: 'SevEvolution', Version: '1.0.0', Description: 'x', UniqueID: 'SevEvolution.Broken', UpdateKeys: [], ContentPackFor: { UniqueID: 'Pathoschild.ContentPatcher', MinimumVersion: '2.9.0' } };
  const problems = checkPack(pack, {
    'manifest.json': buf(manifest),
    'content.json': buf({
      Format: '2.8.0',
      Changes: [
        { Action: 'EditData', Target: 'Data/Mail2', Entries: {} },
        { Action: 'EditData', Target: 'Characters/Dialogue/Abigale', Entries: {} },
        { Action: 'EditData', Target: 'Data/mail', Entries: { '{{ModId}}_A': '{{i18n:letter.a}}%item id (O)99999 1 %%[#]A', Plain: 'no title', '{{ModId}}_Cooking': 'x[#]y', '{{ModId}}_Sale': 'Now 50% off![#]Sale' } },
        { Action: 'EditData', Target: 'Data/TriggerActions', Entries: {
          '{{ModId}}_T': { Id: '{{ModId}}_X', Trigger: 'DayStarting', Condition: 'SEASON_DAY spring 30, PLAYER_HAS_MET Current Abbie, SEASONS spring', Actions: ['AddMail Current {{ModId}}_Missing Now', 'AddMail Someone {{ModId}}_A Later', 'Explode now', 'AddItem 24', 'AddFriendshipPoints Lewiss 10'] }
        } },
        { Action: 'EditData', Target: 'Data/Shops', Entries: { X: { Items: [{ ItemId: '24' }, { ItemId: '(BC)99999' }] } } }
      ]
    }),
    'i18n/default.json': buf({ 'letter.b': 'hi' }),
    'i18n/de.json': buf({ 'letter.c': 'hallo' }),
    'assets/Big.PNG': Buffer.from('x'),
    'readme.txt': Buffer.from('x')
  }, ref, null);
  const has = re => assert.ok(problems.some(p => re.test(p)), `expected a problem matching ${re}\n${problems.join('\n')}`);
  has(/Format 2\.8\.0 does not match Content Patcher 2\.9\.0/);
  has(/Target "Data\/Mail2" is not a known 1\.6 asset/);
  has(/Characters\/Dialogue\/Abigale: unknown NPC "Abigale"/);
  has(/unknown item \(O\)99999/);
  has(/unknown item \(BC\)99999/);
  has(/ItemId: "24" is not a qualified item ID/);
  has(/i18n key "letter\.a" is missing/);
  has(/key "letter\.b" is never used/);
  has(/i18n\/de\.json: key "letter\.c" is not in default\.json/);
  has(/mail key "Plain" must start with \{\{ModId\}\}_/);
  has(/letter "Plain" needs exactly one "\[#\]/);
  has(/contains Cooking\/passOut/);
  has(/letter "\{\{ModId\}\}_Sale" has a stray %/);
  // the closing %% of a mail command is not a stray %
  assert.ok(!problems.some(p => /letter "\{\{ModId\}\}_A" has a stray %/.test(p)), problems.join('\n'));
  has(/Id must equal the entry key/);
  has(/unknown trigger DayStarting/);
  has(/SEASON_DAY day "30" is not 1 to 28/);
  has(/unknown NPC "Abbie"/);
  has(/unknown game state query SEASONS/);
  has(/AddMail sends "\{\{ModId\}\}_Missing", which no Data\/mail entry/);
  has(/AddMail needs a player/);
  has(/AddMail type "Later"/);
  has(/unknown action Explode/);
  has(/AddItem needs a qualified item ID/);
  has(/unknown NPC "Lewiss"/);
  has(/assets\/Big\.PNG: unexpected file/);
  has(/readme\.txt: unexpected file/);

  const wrongManifest = checkPack(pack, { 'manifest.json': buf({ ...manifest, Author: 'Someone', UniqueID: 'Someone.Else', ContentPackFor: { UniqueID: 'Pathoschild.ContentPatcher', MinimumVersion: '2.8.0' } }), 'content.json': buf({ Format: '2.9.1', Changes: [] }) }, ref, null);
  assert.ok(wrongManifest.some(p => /Author must be SevEvolution/.test(p)));
  assert.ok(wrongManifest.some(p => /UniqueID must be SevEvolution/.test(p)));
  assert.ok(wrongManifest.some(p => /MinimumVersion must be 2\.9\.0/.test(p)));
  assert.ok(wrongManifest.some(p => /Format 2\.9\.1 does not match Content Patcher 2\.9\.0/.test(p)), 'a Format newer than the required Content Patcher is wrong');
  assert.ok(checkPack(pack, { 'content.json': Buffer.from('{ broken') }, ref, null).some(p => /content\.json: not valid JSON/.test(p)));
  assert.ok(checkPack(pack, { 'content.json': buf({ Format: '2.9.0', Changes: [] }) }, ref, null).some(p => /manifest\.json is missing/.test(p)));
});

test('Stardew: the official schemas reject broken files', { skip: schemaSkip }, () => {
  const { manifest, contentPatcher } = schemas();
  const ok = { Name: 'x', Author: 'SevEvolution', Version: '1.0.0', Description: 'd', UniqueID: 'SevEvolution.X', UpdateKeys: ['CurseForge:123'], ContentPackFor: { UniqueID: 'Pathoschild.ContentPatcher', MinimumVersion: '2.9.0' } };
  assert.deepEqual(validate(manifest, ok), []);
  const bad = validate(manifest, { ...ok, Version: 'one', UniqueID: 'a b', UpdateKeys: ['Steam:1'], Extra: 1, EntryDll: 'x.dll' });
  for (const re of [/Version/, /UniqueID/, /UpdateKeys\[0\]/, /unknown field Extra/, /exactly one allowed form/]) assert.ok(bad.some(p => re.test(p)), `${re}\n${bad.join('\n')}`);
  assert.ok(validate(manifest, { Name: 'x' }).some(p => /missing required field Author/.test(p)));

  assert.deepEqual(validate(contentPatcher, { Format: '2.9.0', Changes: [{ Action: 'EditData', Target: 'Data/mail', Entries: { a: 'b[#]c' } }] }), []);
  const cp = validate(contentPatcher, { Format: '2.8.0', Changes: [{ Action: 'Explode' }, { Action: 'Load', Target: 'Content/Data/mail.xnb' }, { Action: 'EditData', Target: 'Data/mail', Bogus: 1 }] });
  for (const re of [/\$\.Format/, /Changes\[0\]\.Action/, /Changes\[1\]\.Target: matches a forbidden form/, /Changes\[1\]: missing required field FromFile/, /Changes\[2\]\.Bogus/]) assert.ok(cp.some(p => re.test(p)), `${re}\n${cp.join('\n')}`);
  assert.ok(validate(contentPatcher, { Changes: [] }).some(p => /missing required field Format/.test(p)));
});

test('Stardew: .NET schema patterns are translated, unknown keywords are not ignored', () => {
  assert.ok(dotnetRegex('^(?i)(CurseForge:\\d+)$').test('curseforge:12'));
  assert.ok(dotnetRegex('^(?>(?:0|[1-9]\\d*))\\.(?>(?:0|[1-9]\\d*))$').test('1.0'));
  assert.throws(() => validate({ maxLength: 3 }, 'abcd'), /not supported/);
  assert.deepEqual(validate({ if: { properties: { a: { const: 1 } } }, then: { required: ['b'] } }, { a: 2 }), []);
  assert.equal(validate({ if: { properties: { a: { const: 1 } } }, then: { required: ['b'] } }, { a: 1 }).length, 1);
});

test('Villager Birthday Reminders: one letter per villager, sent on the birthday with a loved gift', async () => {
  const pack = packOf('villager-birthday-reminders');
  const files = await generate(pack, ref, '1.0');
  const content = JSON.parse(files['content.json'].toString('utf-8'));
  const i18n = JSON.parse(files['i18n/default.json'].toString('utf-8'));
  const mail = content.Changes.find(c => c.Target === 'Data/mail').Entries;
  const triggers = content.Changes.find(c => c.Target === 'Data/TriggerActions').Entries;
  const villagers = Object.entries(ref.npcs.npcs).filter(([, n]) => !n.island).map(([name]) => name).sort();
  assert.equal(villagers.length, 33);
  assert.deepEqual(Object.keys(GIFTS).sort(), villagers);
  assert.equal(Object.keys(mail).length, 33);
  for (const name of villagers) {
    const id = `{{ModId}}_Birthday_${name}`;
    const { season, day } = ref.npcs.npcs[name].birthday;
    const t = triggers[id];
    assert.equal(t.Trigger, 'DayStarted');
    assert.equal(t.Condition, `SEASON_DAY ${season} ${day}, PLAYER_HAS_MET Current ${name}`);
    assert.equal(t.MarkActionApplied, false, 'must repeat every year');
    assert.deepEqual(t.Actions, [`RemoveMail Current ${id} Received`, `AddMail Current ${id} Now`]);
    const [gift] = GIFTS[name];
    assert.ok(ref.npcs.npcs[name].loves.includes(gift), `${name} loves ${gift}`);
    const text = i18n[`letter.${name}`];
    assert.ok(text.startsWith('Dear @,^^Today is '), name);
    assert.ok(text.includes(ref.items.items[gift].replace(/s$/, '')), `${name}: letter names ${ref.items.items[gift]}`);
    assert.ok(!/[%#[\]¦]/.test(text), `${name}: no mail commands inside the text`);
  }
  assert.equal(new Set(Object.values(GIFTS).map(g => g[0])).size, 33, 'every villager gets a different gift idea');
});

test('Villager Birthday Reminders: the page passes the text checks', async () => {
  const page = JSON.parse(fs.readFileSync(path.join(packOf('villager-birthday-reminders').dir, 'page.json'), 'utf-8'));
  page.description = page.description.join('\n');
  // the AI note depends on which banner was chosen (tests/serie.test.js checks it against the plan)
  const results = await checkPage(page, {}, { bannerFrom: page.description.endsWith('*(The logo and banner are AI-generated.)*') ? 'chatgpt' : null });
  const text = results.filter(r => ['name', 'summary', 'description', 'category'].includes(r.id));
  assert.deepEqual(text.filter(r => r.level !== 'ok'), []);
  assert.match(page.description, /SMAPI/);
  assert.match(page.description, /Content Patcher/);
  assert.match(page.description, /1\.6/);
  assert.match(page.description, /documented/);
  assert.doesNotMatch(page.description, /tested/i);
  assert.equal(page.cover.bullets.length, 3);
  assert.ok(page.cover.tagline.length <= 45 && page.cover.bullets.every(b => b.length <= 34));
});
