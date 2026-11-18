import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMacroBundle, pickUpdateVersion, missingSources } from '../scripts/lib/macro-bundle.js';

const config = { mcVersion: '1.21.1', bedrock: { galleryTitle: 'MCPEDL', versionPrefix: '26.' } };
const outDir = '/Users/x/Desktop/minecraft-mod-factory/Macros/aktuell';
const pack = {
  slug: 'glowing-samurai', name: 'Glowing Samurai', summary: 'Glowing samurai.', legend: 'Long ago...', altNames: [],
  versions: [
    { version: '1.0', status: 'published', fileId: 1, mcpack: 'A.mcpack', skins: [{ name: 'RAIJIN — Thunder' }], media: ['media/v1.0-skins.png'], note: 'Base.' },
    { version: '1.1', status: 'published', fileId: null, manual: true, mcpack: 'B.mcpack', skins: [{ name: 'KAZE-KI — Wind' }], media: ['media/v1.1-skins.png'], note: 'More.', changelog: '## V1.1 — Wind\n' },
    { version: '1.2', status: 'due', mcpack: 'C.mcpack', skins: [{ name: 'RAIKAGE — Storm' }], media: [], note: 'Storm.' }
  ]
};
const byName = b => Object.fromEntries(b.entries.map(e => [e.name, e]));

test('new skin pack bundle has every form value as a file, without trailing newlines', () => {
  const f = byName(buildMacroBundle({ kind: 'skinpack', mode: 'new', pack, config, outDir }));
  assert.equal(f['typ.txt'].text, 'skinpack-neu');
  assert.equal(f['name.txt'].text, 'Glowing Samurai');
  assert.equal(f['slug.txt'].text, 'glowing-samurai');
  assert.equal(f['kategorie.txt'].text, 'Players');
  assert.equal(f['zusatz-kategorien.txt'].text, 'Skin Packs');
  assert.equal(f['media-titel.txt'].text, 'MCPEDL');
  assert.equal(f['media-beschreibung.txt'].text, 'Glowing Samurai Cover.png');
  for (const e of Object.values(f)) if (e.text !== undefined && e.name !== 'CHECKLISTE.md') assert.ok(!e.text.endsWith('\n'), `${e.name} ends with a newline`);
  assert.match(f['beschreibung.md'].text, /^# Glowing Samurai/);
  assert.match(f['CHECKLISTE.md'].text, /Projekt-Kit/);
});

test('uploads keep their original names and come with an absolute path file', () => {
  const f = byName(buildMacroBundle({ kind: 'skinpack', mode: 'new', pack, config, outDir }));
  assert.equal(f['logo/Glowing Samurai.png'].from, 'data/skins/glowing-samurai/Glowing Samurai.png');
  assert.equal(f['logo-pfad.txt'].text, `${outDir}/logo/Glowing Samurai.png`);
  assert.equal(f['cover-pfad.txt'].text, `${outDir}/cover/Glowing Samurai Cover.png`);
  assert.equal(f['upload/A.mcpack'].from, 'data/skins/glowing-samurai/mcpack/A.mcpack');
  assert.equal(f['datei-name.txt'].text, 'A.mcpack');
});

test('refresh bundle has no first file', () => {
  const f = byName(buildMacroBundle({ kind: 'skinpack', mode: 'refresh', pack, config, outDir }));
  assert.equal(f['typ.txt'].text, 'skinpack-auffrischen');
  assert.ok(!f['datei-pfad.txt']);
});

test('update picks the version CI released for a manual upload, not the next due one', () => {
  assert.equal(pickUpdateVersion(pack).version, '1.1');
  const f = byName(buildMacroBundle({ kind: 'skinpack', mode: 'update', pack, config, outDir }));
  assert.equal(f['version.txt'].text, '1.1');
  assert.equal(f['datei-pfad.txt'].text, `${outDir}/upload/B.mcpack`);
  assert.equal(f['changelog.md'].text, '## V1.1 — Wind');
  assert.match(f['beschreibungs-abschnitt.md'].text, /^## Added in V1\.1: KAZE-KI/);
  assert.doesNotMatch(f['beschreibungs-abschnitt.md'].text, /RAIKAGE/);
});

test('update without a waiting version explains what to do', () => {
  const done = { ...pack, versions: pack.versions.map(v => ({ ...v, manual: false, fileId: v.fileId ?? 9 })) };
  assert.throws(() => pickUpdateVersion(done), /wartet keine Version.*V1\.2.*--version/);
  assert.equal(pickUpdateVersion(done, '1.2').version, '1.2');
  assert.throws(() => pickUpdateVersion(done, '9.9'), /keine Version 9\.9/);
});

test('mod bundle uses the mod name as gallery title and MIT license', () => {
  const meta = { name: 'AutoSort', description: 'Sorts chests.', cfCategory: 'Storage', legend: 'A tale.', pageDescription: '## Features', changelog: [{ version: '1.0.0' }] };
  const f = byName(buildMacroBundle({ kind: 'mod', meta, modId: 'autosort', config, outDir }));
  assert.equal(f['typ.txt'].text, 'mod');
  assert.equal(f['media-titel.txt'].text, 'AutoSort');
  assert.equal(f['lizenz.txt'].text, 'MIT');
  assert.equal(f['logo/AutoSort.png'].from, 'data/mods/autosort/AutoSort.png');
  assert.ok(!f['datei-pfad.txt'], 'mod jars are uploaded by the API');
});

test('missingSources lists source files that do not exist', () => {
  const b = buildMacroBundle({ kind: 'skinpack', mode: 'refresh', pack, config, outDir });
  assert.deepEqual(missingSources(b, p => !p.endsWith('Cover.png')), ['data/skins/glowing-samurai/Glowing Samurai Cover.png']);
});
