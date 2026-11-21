// Villages Nearby: villages (and since V1.2 pillager outposts and the four small temples: desert
// pyramids, jungle temples, swamp huts and igloos, since V1.3 ocean ruins and shipwrecks) appear
// more often in newly generated land. A vanilla structure set places one attempt per region of
// `spacing` × `spacing` chunks, at least `separation` chunks from the region's far edge. This pack
// copies the vanilla file of its Minecraft version and only shrinks those regions; salt,
// structures, weights, frequency and exclusion zones stay vanilla.
// One rule for every set: spacing × 0.65 (rounded), separation × 0.75, so about 2.2 to 2.4 times
// as many attempts per area.
//   villages:          34 / 8 → 22 / 6, (34 / 22)² ≈ 2.4 times as many attempts per area
//   outposts, temples: 32 / 8 → 21 / 6, (32 / 21)² ≈ 2.3 times as many attempts per area
//   ocean ruins:       20 / 8 → 13 / 6, (20 / 13)² ≈ 2.4 times as many attempts per area
//   shipwrecks:        24 / 4 → 16 / 3, (24 / 16)² = 2.25 times as many attempts per area
// Ocean monuments stay vanilla on purpose: each one holds eight gold blocks, rooms of sponges and
// three elder guardians whose Mining Fatigue covers 50 blocks around them. More of them would hand
// out non-renewable loot faster and put more of the ocean under Mining Fatigue.
import fs from 'fs';
import path from 'path';

const RANDOM_SPREAD = 'minecraft:random_spread';

// One row per vanilla structure set the pack changes.
//   vanilla    what the vanilla file must say before it is changed. If a later Minecraft version
//              moves or changes it, the build stops instead of shipping a wrong file.
//   nearby     the pack's values. separation must stay below spacing (the game rejects the file
//              otherwise).
//   structures the structures the vanilla set must contain, in this order.
export const SETS = [
  { set: 'villages', vanilla: { spacing: 34, separation: 8 }, nearby: { spacing: 22, separation: 6 },
    structures: ['minecraft:village_plains', 'minecraft:village_desert', 'minecraft:village_savanna', 'minecraft:village_snowy', 'minecraft:village_taiga'] },
  { set: 'pillager_outposts', vanilla: { spacing: 32, separation: 8 }, nearby: { spacing: 21, separation: 6 },
    structures: ['minecraft:pillager_outpost'] },
  { set: 'desert_pyramids', vanilla: { spacing: 32, separation: 8 }, nearby: { spacing: 21, separation: 6 },
    structures: ['minecraft:desert_pyramid'] },
  { set: 'jungle_temples', vanilla: { spacing: 32, separation: 8 }, nearby: { spacing: 21, separation: 6 },
    structures: ['minecraft:jungle_pyramid'] },
  { set: 'swamp_huts', vanilla: { spacing: 32, separation: 8 }, nearby: { spacing: 21, separation: 6 },
    structures: ['minecraft:swamp_hut'] },
  { set: 'igloos', vanilla: { spacing: 32, separation: 8 }, nearby: { spacing: 21, separation: 6 },
    structures: ['minecraft:igloo'] },
  { set: 'ocean_ruins', vanilla: { spacing: 20, separation: 8 }, nearby: { spacing: 13, separation: 6 },
    structures: ['minecraft:ocean_ruin_cold', 'minecraft:ocean_ruin_warm'] },
  { set: 'shipwrecks', vanilla: { spacing: 24, separation: 4 }, nearby: { spacing: 16, separation: 3 },
    structures: ['minecraft:shipwreck', 'minecraft:shipwreck_beached'] }
];

// Kept from V1.0/V1.1 for the villages row.
export const VANILLA = { type: RANDOM_SPREAD, ...SETS[0].vanilla };
export const NEARBY = SETS[0].nearby;

// Sensible bounds: never rarer than vanilla, never denser than one attempt per 12 × 12 chunks.
const MIN_SPACING = 12;

// The vanilla set `vanillaSet` of row `row` with only spacing and separation changed.
export function nearer(row, vanillaSet, { spacing, separation } = row.nearby) {
  const name = `${row.set}.json`;
  const p = vanillaSet?.placement;
  if (!p) throw new Error(`${name}: vanilla file has no "placement"`);
  if (p.type !== RANDOM_SPREAD) throw new Error(`${name}: expected placement type ${RANDOM_SPREAD}, found ${p.type}`);
  if (p.spacing !== row.vanilla.spacing || p.separation !== row.vanilla.separation) {
    throw new Error(`${name}: expected vanilla spacing/separation ${row.vanilla.spacing}/${row.vanilla.separation}, found ${p.spacing}/${p.separation}`);
  }
  const found = (Array.isArray(vanillaSet.structures) ? vanillaSet.structures : []).map(s => s.structure);
  if (JSON.stringify(found) !== JSON.stringify(row.structures)) {
    throw new Error(`${name}: expected structures ${row.structures.join(', ')}, found ${found.join(', ') || 'none'}`);
  }
  if (!(Number.isInteger(spacing) && Number.isInteger(separation) && separation >= 0 && separation < spacing)) {
    throw new Error(`${name}: separation ${separation} must be below spacing ${spacing}`);
  }
  if (spacing < MIN_SPACING || spacing > row.vanilla.spacing || separation > row.vanilla.separation) {
    throw new Error(`${name}: spacing/separation ${spacing}/${separation} out of bounds (spacing ${MIN_SPACING} to ${row.vanilla.spacing}, separation at most ${row.vanilla.separation})`);
  }
  const copy = structuredClone(vanillaSet);
  copy.placement.spacing = spacing;
  copy.placement.separation = separation;
  return copy;
}

export function nearbyVillages(vanillaSet, values = NEARBY) {
  return nearer(SETS[0], vanillaSet, values);
}

export default async function ({ vanilla }) {
  const files = {};
  for (const row of SETS) {
    const file = path.join(vanilla.data, 'minecraft', 'worldgen', 'structure_set', `${row.set}.json`);
    if (!fs.existsSync(file)) throw new Error(`No vanilla ${row.set}.json at ${file}`);
    const vanillaSet = JSON.parse(fs.readFileSync(file, 'utf-8'));
    files[`data/minecraft/worldgen/structure_set/${row.set}.json`] = nearer(row, vanillaSet);
  }
  return files;
}
