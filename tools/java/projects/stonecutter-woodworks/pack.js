// Stonecutter Woodworks: planks of the overworld woods are cut into stairs, slabs, fences, fence
// gates, doors, trapdoors and pressure plates in the stonecutter, one plank at a time.
// Amounts follow vanilla: a plank gives two slabs (like the crafting table), everything else one.
export const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];
export const CUTS = { stairs: 1, slab: 2, fence: 1, fence_gate: 1, door: 1, trapdoor: 1, pressure_plate: 1 };
const NS = 'stonecutter_woodworks';

export default async function () {
  const files = {};
  for (const wood of WOODS) {
    for (const [cut, count] of Object.entries(CUTS)) {
      files[`data/${NS}/recipe/${wood}_${cut}_from_${wood}_planks_stonecutting.json`] = {
        type: 'minecraft:stonecutting',
        ingredient: { item: `minecraft:${wood}_planks` },
        result: { id: `minecraft:${wood}_${cut}`, count }
      };
    }
  }
  return files;
}
