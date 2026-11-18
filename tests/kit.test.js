import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skinpackKit, skinpackUpdateKit, modKit, packVersionsForDescription } from '../scripts/lib/kit.js';

const config = { mcVersion: '26.3', bedrock: { class: 'Skins', mainCategory: 'Players', additionalCategories: ['Skin Packs'], license: 'All Rights Reserved', distribution: 'Allow distribution to 3rd party', source: 'The source code is not publicly available', galleryTitle: 'MCPEDL', versionPrefix: '26.' } };
const pack = {
  slug: 'glowing-samurai', name: 'Glowing Samurai', packName: 'Samurai Saga', summary: 'These are glowing samurai.', legend: 'Long ago...', altNames: ['Neon Ronin', 'Shogun Glow'],
  versions: [
    { version: '1.0', status: 'published', mcpack: 'A.mcpack', skins: [{ name: 'RAIJIN — Thunder' }], media: ['media/v1.0-skins.png'], note: 'Base.' },
    { version: '1.1', status: 'published', mcpack: 'B.mcpack', skins: [{ name: 'KAZE-KI — Wind' }], media: ['media/v1.1-skins.png'], note: 'More.' },
    { version: '1.2', status: 'due', mcpack: 'C.mcpack', skins: [{ name: 'RAIKAGE — Storm' }], media: ['media/v1.2-skins.png'], note: 'Storm.' }
  ]
};

test('skin pack kit has every CurseForge field from the reference project', () => {
  const kit = skinpackKit(pack, config, { mode: 'new' });
  for (const s of ['Glowing Samurai.png', 'Glowing Samurai Cover.png', '| Media → Title | **MCPEDL**', 'Players', 'Skin Packs', 'All Rights Reserved', 'Allow distribution to 3rd party', 'not publicly available', 'These are glowing samurai.', 'Neon Ronin', '★']) {
    assert.ok(kit.includes(s), `missing ${s}`);
  }
  assert.match(kit, /## Added in V1\.1: KAZE-KI/);
  assert.doesNotMatch(kit, /V1\.2/, 'unreleased version must not appear in the description');
});

test('update kit adds only the new section and the manual upload when the API is off', () => {
  const body = skinpackUpdateKit(pack, { ...pack.versions[2], changelog: '## V1.2' }, config, { uploaded: false });
  assert.match(body, /## Added in V1\.2: RAIKAGE/);
  assert.match(body, /Add File.*C\.mcpack/);
  assert.match(body, /## V1\.2/);
  assert.doesNotMatch(body, /KAZE-KI/);
});

test('description versions include the version being released', () => {
  assert.deepEqual(packVersionsForDescription(pack, { through: '1.2' }).map(v => v.version), ['1.0', '1.1', '1.2']);
  assert.match(packVersionsForDescription(pack)[0].images[0], /raw\.githubusercontent\.com\/.*\/data\/skins\/glowing-samurai\/media\/v1\.0-skins\.png$/);
});

test('mod kit uses the mod name as gallery title, not MCPEDL', () => {
  const kit = modKit({ name: 'AutoSort', description: 'Sorts chests.', cfCategory: 'Storage', legend: 'A tale.', pageDescription: '## Features\n- sort', changelog: [{ version: '1.0.0' }] }, config, { modId: 'autosort' });
  assert.match(kit, /\| Media → Title \| AutoSort \|/);
  assert.doesNotMatch(kit, /MCPEDL/);
  assert.match(kit, /AutoSort Cover\.png/);
});
