// Villages Nearby: villages appear more often in newly generated land. The vanilla structure set
// "villages" places one village attempt per region of `spacing` × `spacing` chunks, at least
// `separation` chunks from the region's far edge. This pack copies the vanilla file of its
// Minecraft version and only shrinks those regions; salt, structures and weights stay vanilla.
// (34 / 22)² ≈ 2.4 times as many village attempts per area.
import fs from 'fs';
import path from 'path';

// What the vanilla file must say before it is changed. If a later Minecraft version moves or
// changes it, the build stops instead of shipping a wrong file.
export const VANILLA = { type: 'minecraft:random_spread', spacing: 34, separation: 8 };
// The pack's values. separation must stay below spacing (the game rejects the file otherwise).
export const NEARBY = { spacing: 22, separation: 6 };

export function nearbyVillages(vanillaSet, { spacing, separation } = NEARBY) {
  const p = vanillaSet?.placement;
  if (!p) throw new Error('villages.json: vanilla file has no "placement"');
  if (p.type !== VANILLA.type) throw new Error(`villages.json: expected placement type ${VANILLA.type}, found ${p.type}`);
  if (p.spacing !== VANILLA.spacing || p.separation !== VANILLA.separation) {
    throw new Error(`villages.json: expected vanilla spacing/separation ${VANILLA.spacing}/${VANILLA.separation}, found ${p.spacing}/${p.separation}`);
  }
  if (!Array.isArray(vanillaSet.structures) || !vanillaSet.structures.length) throw new Error('villages.json: vanilla file has no structures');
  if (!(Number.isInteger(spacing) && Number.isInteger(separation) && separation >= 0 && separation < spacing)) {
    throw new Error(`villages.json: separation ${separation} must be below spacing ${spacing}`);
  }
  const copy = structuredClone(vanillaSet);
  copy.placement.spacing = spacing;
  copy.placement.separation = separation;
  return copy;
}

export default async function ({ vanilla }) {
  const file = path.join(vanilla.data, 'minecraft', 'worldgen', 'structure_set', 'villages.json');
  if (!fs.existsSync(file)) throw new Error(`No vanilla villages.json at ${file}`);
  const vanillaSet = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return { 'data/minecraft/worldgen/structure_set/villages.json': nearbyVillages(vanillaSet) };
}
