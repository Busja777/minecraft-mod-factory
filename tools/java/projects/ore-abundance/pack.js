// Ore Abundance: more ore veins in newly generated Overworld land. Each Overworld ore has one or
// more vanilla placed features (data/minecraft/worldgen/placed_feature/ore_*.json) whose first
// placement modifier says how many vein attempts a chunk gets. This pack copies the vanilla file
// of its Minecraft version and only raises that number by half (rounded down); vein size, height
// range, biome rules and the configured features stay vanilla.
//   minecraft:count          count N   → floor(N × 1.5)
//   minecraft:rarity_filter  chance N  → floor(N / 1.5)   (one attempt in N chunks; only large diamond veins)
// Left alone: ore_gold_lower (its count is a random 0–1, not a number), every Nether ore, and the
// stone, dirt, gravel, clay and infested-stone "ores".
import fs from 'fs';
import path from 'path';

export const FACTOR = 1.5;

// placed feature → what the vanilla file must say. If a later Minecraft version changes a file,
// the build stops instead of shipping a wrong one.
export const ORES = {
  ore_coal_upper: { ore: 'coal', type: 'minecraft:count', value: 30 },
  ore_coal_lower: { ore: 'coal', type: 'minecraft:count', value: 20 },
  ore_copper: { ore: 'copper', type: 'minecraft:count', value: 16 },
  ore_copper_large: { ore: 'copper', type: 'minecraft:count', value: 16 },        // dripstone caves
  ore_iron_upper: { ore: 'iron', type: 'minecraft:count', value: 90 },            // mountains
  ore_iron_middle: { ore: 'iron', type: 'minecraft:count', value: 10 },
  ore_iron_small: { ore: 'iron', type: 'minecraft:count', value: 10 },
  ore_gold: { ore: 'gold', type: 'minecraft:count', value: 4 },
  ore_gold_extra: { ore: 'gold', type: 'minecraft:count', value: 50 },            // badlands
  ore_redstone: { ore: 'redstone', type: 'minecraft:count', value: 4 },
  ore_redstone_lower: { ore: 'redstone', type: 'minecraft:count', value: 8 },
  ore_lapis: { ore: 'lapis', type: 'minecraft:count', value: 2 },
  ore_lapis_buried: { ore: 'lapis', type: 'minecraft:count', value: 4 },
  ore_diamond: { ore: 'diamond', type: 'minecraft:count', value: 7 },
  ore_diamond_buried: { ore: 'diamond', type: 'minecraft:count', value: 4 },
  ore_diamond_medium: { ore: 'diamond', type: 'minecraft:count', value: 2 },
  ore_diamond_large: { ore: 'diamond', type: 'minecraft:rarity_filter', value: 9 },
  ore_emerald: { ore: 'emerald', type: 'minecraft:count', value: 100 }               // mountains
};

const KEY = { 'minecraft:count': 'count', 'minecraft:rarity_filter': 'chance' };

// The new number for a modifier: more attempts per chunk, or fewer chunks between attempts.
export function boosted(type, value, factor = FACTOR) {
  if (type === 'minecraft:count') return Math.floor(value * factor);
  if (type === 'minecraft:rarity_filter') return Math.max(1, Math.floor(value / factor));
  throw new Error(`unknown modifier ${type}`);
}

// vanilla placed feature → the same file with only the number of the first modifier changed.
export function abundant(name, vanillaFeature, factor = FACTOR) {
  const want = ORES[name];
  if (!want) throw new Error(`${name}: not an ore of this pack`);
  const first = vanillaFeature?.placement?.[0];
  if (!first) throw new Error(`${name}.json: vanilla file has no "placement"`);
  if (first.type !== want.type) throw new Error(`${name}.json: expected first modifier ${want.type}, found ${first.type}`);
  const key = KEY[want.type];
  if (Object.keys(first).length !== 2 || first[key] !== want.value) {
    throw new Error(`${name}.json: expected vanilla ${key} ${want.value}, found ${JSON.stringify(first)}`);
  }
  if (!String(vanillaFeature.feature || '').startsWith('minecraft:ore_')) throw new Error(`${name}.json: unexpected feature ${vanillaFeature.feature}`);
  const copy = structuredClone(vanillaFeature);
  copy.placement[0][key] = boosted(want.type, want.value, factor);
  return copy;
}

export default async function ({ vanilla }) {
  const files = {};
  for (const name of Object.keys(ORES)) {
    const file = path.join(vanilla.data, 'minecraft', 'worldgen', 'placed_feature', `${name}.json`);
    if (!fs.existsSync(file)) throw new Error(`No vanilla ${name}.json at ${file}`);
    files[`data/minecraft/worldgen/placed_feature/${name}.json`] = abundant(name, JSON.parse(fs.readFileSync(file, 'utf-8')));
  }
  return files;
}
