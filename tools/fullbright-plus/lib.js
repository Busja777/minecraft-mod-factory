// Pure builders for the Fullbright Plus resource pack. No I/O here, so tests can feed fixtures.
//
// Compatibility rules:
// - everything we add lives in the `leotdoo:` namespace; vanilla identifiers are never redefined
// - no remove_all_prior_fog, so fogs from packs below stay intact
// - no textures, UI or sounds, so any texture pack can sit underneath

export const NS = 'leotdoo';
export const FOG_ID = `${NS}:fullbright`;
export const AMBIENT_MAX = 5.0; // allowed range for lighting ambient.illuminance is 0.0 - 5.0

export const LEVELS = [
  { folder: 'clear', name: 'No Fog', ambient: null },
  { folder: 'bright', name: 'No Fog + Bright (Vibrant Visuals)', ambient: 1.5 },
  { folder: 'max', name: 'No Fog + Max Bright (Vibrant Visuals)', ambient: AMBIENT_MAX }
];

const clone = o => JSON.parse(JSON.stringify(o));
const bare = id => String(id).replace(/^[^:]+:/, '');
export const ourLightingId = vanillaId => `${NS}:${bare(vanillaId)}`;

// biomes_client.json: default plus every vanilla biome points at our fog. Biome entries sit above
// the data default in the fog stack, which is why default alone did not reach the nether or swamps.
export function biomesClient(biomeNames) {
  const biomes = { default: { fog_identifier: FOG_ID } };
  for (const b of [...biomeNames].sort()) biomes[b] = { fog_identifier: FOG_ID };
  return { biomes };
}

// Copy of a vanilla lighting file with our identifier and a raised ambient floor.
// Sun, moon, sky and keyframes stay as vanilla so day/night and biome mood survive.
export function lightingVariant(vanilla, ambient) {
  if (ambient > AMBIENT_MAX || ambient < 0) throw new Error(`ambient ${ambient} outside 0-${AMBIENT_MAX}`);
  const out = clone(vanilla);
  const s = out['minecraft:lighting_settings'];
  if (!s?.description?.identifier) throw new Error('not a lighting file');
  s.description.identifier = ourLightingId(s.description.identifier);
  s.ambient = { color: s.ambient?.color ?? '#FFFFFF', illuminance: ambient };
  return out;
}

// Client biome override. mode 'full' copies every vanilla component and swaps fog + lighting
// (safe if the game replaces the whole biome file); mode 'minimal' only carries those two
// components (best compatibility if the game merges per component).
export function clientBiomeVariant(vanilla, { mode = 'full', fog = true, light = true, defaultLighting = 'minecraft:default_lighting' } = {}) {
  const src = vanilla['minecraft:client_biome'];
  if (!src?.description?.identifier) throw new Error('not a client_biome file');
  const vanillaLight = src.components?.['minecraft:lighting_identifier']?.lighting_identifier || defaultLighting;
  const components = mode === 'full' ? clone(src.components || {}) : {};
  if (fog) components['minecraft:fog_appearance'] = { fog_identifier: FOG_ID };
  if (light) components['minecraft:lighting_identifier'] = { lighting_identifier: ourLightingId(vanillaLight) };
  return {
    format_version: vanilla.format_version,
    'minecraft:client_biome': { description: clone(src.description), components }
  };
}

export function manifest(base, { version, description }) {
  const h = base.header;
  const module = base.modules[0];
  return {
    format_version: 2,
    header: { name: h.name, description, uuid: h.uuid, version, min_engine_version: [1, 21, 120] },
    modules: [{ type: 'resources', uuid: module.uuid, version, description: module.description }],
    subpacks: LEVELS.map(l => ({ folder_name: l.folder, name: l.name, memory_tier: 1 })),
    capabilities: ['pbr'],
    metadata: base.metadata
  };
}

export const DESCRIPTION = 'Removes distance fog in every biome and keeps water clear. With Vibrant Visuals on, choose a Bright subpack (pack settings) to light up caves and nights. Stack it above any texture pack.';

const json = o => JSON.stringify(o, null, 2) + '\n';

// Returns { 'relative/path': string|Buffer } for the whole pack.
// vanilla: { biomes: { name: clientBiomeJson }, lighting: { file: lightingJson } }
export function packFiles({ base, icon, fog, vanilla, version, biomeMode = 'full' }) {
  const files = {
    'manifest.json': json(manifest(base, { version, description: DESCRIPTION })),
    'pack_icon.png': icon,
    'fogs/fullbright.json': json(fog),
    'biomes_client.json': json(biomesClient(Object.keys(vanilla.biomes)))
  };
  for (const level of LEVELS) {
    const dir = `subpacks/${level.folder}`;
    const light = level.ambient != null;
    if (light) {
      for (const [file, l] of Object.entries(vanilla.lighting)) {
        // prefixed path: a vanilla-named file (e.g. lighting/global.json) would replace another VV pack's file
        files[`${dir}/lighting/fbp_${file}`] = json(lightingVariant(l, level.ambient));
      }
    }
    // Every level ships client biomes so the fog override reaches vanilla biomes no matter whether
    // biomes_client.json entries outrank vanilla client_biome files (undocumented).
    for (const [name, biome] of Object.entries(vanilla.biomes)) {
      files[`${dir}/biomes/${name}.client_biome.json`] = json(clientBiomeVariant(biome, { mode: biomeMode, light }));
    }
  }
  return files;
}

// Every lighting id a biome references must exist in the same subpack.
export function missingLighting(files, dir) {
  const have = new Set(Object.entries(files)
    .filter(([p]) => p.startsWith(`${dir}/lighting/`))
    .map(([, c]) => JSON.parse(c)['minecraft:lighting_settings'].description.identifier));
  return Object.entries(files)
    .filter(([p]) => p.startsWith(`${dir}/biomes/`))
    .map(([, c]) => JSON.parse(c)['minecraft:client_biome'].components['minecraft:lighting_identifier'].lighting_identifier)
    .filter(id => !have.has(id));
}
