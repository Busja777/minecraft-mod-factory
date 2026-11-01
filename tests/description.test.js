import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDescription, renderUpdateSection, shortName, AI_NOTE } from '../scripts/lib/description.js';
import { logoFileName, coverFileName, slugify, pascalCase, rawUrl, fileBase } from '../scripts/lib/naming.js';

const versions = [
  { version: '1.0', note: 'Three realms.', skins: [{ name: 'RAIJIN — Thunder Samurai' }, { name: 'MUGEN — Void Ghost' }], images: ['https://x/v1.0.png'] },
  { version: '1.1', note: 'Four fallen generals return.', skins: [{ name: 'KAZE-KI — Wind Blade' }, { name: 'DOKU-HA — Poison Edge' }], images: ['https://x/v1.1.png'] }
];

test('skin pack description: legend, AI note, skins, then update sections in order', () => {
  const md = renderDescription({ kind: 'skinpack', name: 'Glowing Samurai', legend: 'Long ago...', versions });
  const order = ['# Glowing Samurai', 'Long ago...', AI_NOTE, '## The Skins', 'https://x/v1.0.png', '## Added in V1.1: KAZE-KI, DOKU-HA', 'https://x/v1.1.png', '## How to install'];
  let last = -1;
  for (const part of order) {
    const i = md.indexOf(part);
    assert.ok(i > last, `"${part}" missing or out of order`);
    last = i;
  }
});

test('description requires a legend', () => {
  assert.throws(() => renderDescription({ kind: 'skinpack', name: 'X', legend: ' ', versions }), /legend/);
});

test('mod description uses body and titled update sections', () => {
  const md = renderDescription({ kind: 'mod', name: 'AutoSort', legend: 'A tale.', body: '## Features\n- sort', versions: [{ version: '1.0.0' }, { version: '1.1.0', title: 'Chest presets', note: 'Presets now save.' }] });
  assert.match(md, /## Features/);
  assert.match(md, /## Added in V1\.1\.0: Chest presets/);
  assert.ok(md.indexOf(AI_NOTE) < md.indexOf('## Features'));
});

test('update section lists full skin names and the image', () => {
  const s = renderUpdateSection(versions[1], 'skinpack');
  assert.match(s, /\*\*KAZE-KI — Wind Blade\*\*/);
  assert.match(s, /!\[V1\.1 preview\]\(https:\/\/x\/v1\.1\.png\)/);
});

test('shortName cuts the epithet', () => {
  assert.equal(shortName('KAGAMI (鏡) — Mirror Wraith'), 'KAGAMI (鏡)');
  assert.equal(shortName('PLAIN'), 'PLAIN');
});

test('image file names follow the pack name', () => {
  assert.equal(logoFileName('Glowing Samurai'), 'Glowing Samurai.png');
  assert.equal(coverFileName('Black & White PVP'), 'Black & White PVP Cover.png');
  assert.equal(fileBase('A/B: C?'), 'AB C');
  assert.throws(() => fileBase('///'));
});

test('slug, pascal case and raw URLs', () => {
  assert.equal(slugify('Black & White PVP'), 'black-and-white-pvp');
  assert.equal(pascalCase('Glowing Samurai'), 'GlowingSamurai');
  assert.equal(rawUrl('data/skins/a b/Glowing Samurai Cover.png', { repo: 'o/r', branch: 'main' }),
    'https://raw.githubusercontent.com/o/r/main/data/skins/a%20b/Glowing%20Samurai%20Cover.png');
});
