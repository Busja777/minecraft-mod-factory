// Stonecutter Woodworks: planks are cut into stairs, slabs, fences, fence gates, doors, trapdoors
// and pressure plates in the stonecutter, one plank at a time.
// Amounts follow vanilla: a plank gives two slabs (like the crafting table), everything else one.
// 1.0: the eight overworld woods. 1.2: bamboo, crimson and warped, whose seven cuts all exist in
// Minecraft 1.21.1 and 26.3 (pale oak exists only in 26.3, so it stays out: every file must exist
// for every version the zip serves).
export const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped'];
export const CUTS = { stairs: 1, slab: 2, fence: 1, fence_gate: 1, door: 1, trapdoor: 1, pressure_plate: 1 };
const NS = 'stonecutter_woodworks';

// Data pack format 57 (Minecraft 1.21.2) changed how a recipe names its ingredient: up to format 56
// it is { "item": "minecraft:oak_planks" }, from 57 on the plain string "minecraft:oak_planks".
const PLAIN_INGREDIENT = 57;

// One stonecutting recipe, written the way the version's own stonecutting recipes are written
// (compare stone_slab_from_stone_stonecutting.json and stone_stairs_from_stone_stonecutting.json).
// 1.21.1 always writes the count; 26.3 leaves it out when it is one.
function recipe(format, wood, cut, count) {
  if (format < PLAIN_INGREDIENT) {
    return {
      type: 'minecraft:stonecutting',
      ingredient: { item: `minecraft:${wood}_planks` },
      result: { id: `minecraft:${wood}_${cut}`, count }
    };
  }
  return {
    type: 'minecraft:stonecutting',
    ingredient: `minecraft:${wood}_planks`,
    result: count > 1 ? { count, id: `minecraft:${wood}_${cut}` } : { id: `minecraft:${wood}_${cut}` }
  };
}

// Called once per Minecraft version; the same 77 recipes under the same paths for every version.
export default async function ({ format }) {
  const files = {};
  for (const wood of WOODS) {
    for (const [cut, count] of Object.entries(CUTS)) {
      files[`data/${NS}/recipe/${wood}_${cut}_from_${wood}_planks_stonecutting.json`] = recipe(format, wood, cut, count);
    }
  }
  return files;
}
