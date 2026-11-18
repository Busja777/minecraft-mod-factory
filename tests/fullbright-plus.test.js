import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packFiles, biomesClient, lightingVariant, clientBiomeVariant, missingLighting, LEVELS, FOG_ID, AMBIENT_MAX } from '../tools/fullbright-plus/lib.js';

const base = {
  header: { name: 'Fullbright Plus', uuid: 'd119b9f3-194c-496b-9c55-3f9ce9224459' },
  modules: [{ type: 'resources', uuid: 'ff5c485d-f355-467f-8ffe-9d53796cb960', description: 'Fullbright Plus visuals' }],
  metadata: { authors: ['LeoTermado'], license: 'MIT' }
};
const light = id => ({ format_version: '1.21.80', 'minecraft:lighting_settings': { description: { identifier: id }, ambient: { color: '#FFFFFF', illuminance: 0.02 }, sky: { intensity: 1 } } });
const biome = (id, lighting) => ({
  format_version: '1.21.120',
  'minecraft:client_biome': {
    description: { identifier: `minecraft:${id}` },
    components: {
      'minecraft:fog_appearance': { fog_identifier: `minecraft:fog_${id}` },
      'minecraft:water_appearance': { surface_color: '#905957' },
      ...(lighting ? { 'minecraft:lighting_identifier': { lighting_identifier: lighting } } : {}),
      'minecraft:biome_music': { music_definition: id }
    }
  }
});
const vanilla = {
  biomes: { plains: biome('plains', 'minecraft:default_lighting'), hell: biome('hell', 'minecraft:nether_lighting'), the_end: biome('the_end') },
  lighting: { 'global.json': light('minecraft:default_lighting'), 'nether_lighting.json': light('minecraft:nether_lighting') }
};
const fog = { format_version: '1.16.100', 'minecraft:fog_settings': { description: { identifier: FOG_ID }, distance: {} } };
const files = packFiles({ base, icon: Buffer.from('png'), fog, vanilla, version: [1, 1, 0] });

test('every file is valid JSON and the manifest keeps the update identity', () => {
  for (const [p, c] of Object.entries(files)) if (p.endsWith('.json')) JSON.parse(c);
  const m = JSON.parse(files['manifest.json']);
  assert.equal(m.header.uuid, base.header.uuid);
  assert.equal(m.modules[0].uuid, base.modules[0].uuid);
  assert.notEqual(m.header.uuid, m.modules[0].uuid);
  assert.deepEqual(m.header.version, [1, 1, 0]);
  assert.deepEqual(m.capabilities, ['pbr']);
  assert.deepEqual(m.subpacks.map(s => s.folder_name), LEVELS.map(l => l.folder));
  for (const l of LEVELS) assert.ok(Object.keys(files).some(p => p.startsWith(`subpacks/${l.folder}/`)), `subpack ${l.folder} is empty`);
});

test('fog covers every biome without wiping other packs', () => {
  const bc = JSON.parse(files['biomes_client.json']);
  assert.ok(!files['biomes_client.json'].includes('remove_all_prior_fog'));
  for (const b of ['default', 'plains', 'hell', 'the_end']) assert.equal(bc.biomes[b].fog_identifier, FOG_ID);
  const clear = JSON.parse(files['subpacks/clear/biomes/hell.client_biome.json'])['minecraft:client_biome'].components;
  assert.equal(clear['minecraft:fog_appearance'].fog_identifier, FOG_ID, 'No Fog level also overrides vanilla biome fog');
  assert.equal(clear['minecraft:lighting_identifier'].lighting_identifier, 'minecraft:nether_lighting', 'No Fog level keeps vanilla lighting');
  assert.ok(!Object.keys(files).some(p => p.startsWith('subpacks/clear/lighting/')));
  assert.deepEqual(biomesClient(['b', 'a']).biomes.a, { fog_identifier: FOG_ID });
});

test('bright subpacks reference only lighting they ship, all in our namespace and in range', () => {
  for (const l of LEVELS.filter(l => l.ambient != null)) {
    const dir = `subpacks/${l.folder}`;
    assert.deepEqual(missingLighting(files, dir), []);
    for (const [p, c] of Object.entries(files).filter(([p]) => p.startsWith(`${dir}/lighting/`))) {
      assert.match(p, /\/lighting\/fbp_/, 'lighting files must not reuse vanilla paths');
      const s = JSON.parse(c)['minecraft:lighting_settings'];
      assert.match(s.description.identifier, /^leotdoo:/);
      assert.ok(s.ambient.illuminance <= AMBIENT_MAX && s.ambient.illuminance === l.ambient);
      assert.equal(s.sky.intensity, 1, 'other vanilla values stay untouched');
    }
  }
  assert.throws(() => lightingVariant(light('minecraft:x'), 6));
});

test('client biome full mode keeps vanilla components, minimal mode carries only fog and light', () => {
  const full = clientBiomeVariant(vanilla.biomes.hell)['minecraft:client_biome'].components;
  assert.equal(full['minecraft:fog_appearance'].fog_identifier, FOG_ID);
  assert.equal(full['minecraft:lighting_identifier'].lighting_identifier, 'leotdoo:nether_lighting');
  assert.equal(full['minecraft:biome_music'].music_definition, 'hell');
  assert.equal(full['minecraft:water_appearance'].surface_color, '#905957');
  const min = clientBiomeVariant(vanilla.biomes.the_end, { mode: 'minimal' })['minecraft:client_biome'].components;
  assert.deepEqual(Object.keys(min).sort(), ['minecraft:fog_appearance', 'minecraft:lighting_identifier']);
  assert.equal(min['minecraft:lighting_identifier'].lighting_identifier, 'leotdoo:default_lighting', 'biomes without lighting fall back to the default');
  assert.equal(vanilla.biomes.hell['minecraft:client_biome'].components['minecraft:fog_appearance'].fog_identifier, 'minecraft:fog_hell', 'input is not mutated');
});
