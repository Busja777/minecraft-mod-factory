// Plank Cutter: planks of every wood are cut into stairs, slabs, fences, fence gates, doors,
// trapdoors and pressure plates in the stonecutter, one plank at a time. Amounts as in Plank
// Cutter's sister pack for Java: a plank gives two slabs, everything else one.
// Bedrock names a few oak blocks without "oak" (wooden_door, trapdoor, fence_gate,
// wooden_pressure_plate); every id is looked up in Mojang's item list of the release, so a wood
// or block that does not exist stops the build instead of writing a dead recipe.
// Recipe shape: a vanilla stonecutter recipe of the same release
// (recipes/cobbled_deepslate_slab_from_cobbled_deepslate_stonecutting.json).
export const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped'];
export const CUTS = { stairs: 1, slab: 2, fence: 1, fence_gate: 1, door: 1, trapdoor: 1, pressure_plate: 1 };
const OAK = { door: 'wooden_door', trapdoor: 'trapdoor', fence_gate: 'fence_gate', pressure_plate: 'wooden_pressure_plate' };
const NS = 'plank_cutter';

export function blockId(items, wood, cut) {
  const candidates = [`${wood}_${cut}`, ...(wood === 'oak' && OAK[cut] ? [OAK[cut]] : [])];
  const found = candidates.find(c => items.has(c));
  if (!found) throw new Error(`no ${wood} ${cut} in this release (tried ${candidates.join(', ')})`);
  return found;
}

export default async function ({ ids, vanilla }) {
  const items = ids('items');
  const model = vanilla('bp', 'recipes/cobbled_deepslate_slab_from_cobbled_deepslate_stonecutting.json');
  if (!model?.['minecraft:recipe_shapeless']?.tags?.includes('stonecutter')) throw new Error('the vanilla model recipe for the stonecutter is gone');
  const files = {};
  for (const wood of WOODS) {
    const planks = `${wood}_planks`;
    if (!items.has(planks)) throw new Error(`no ${planks} in this release`);
    for (const [cut, count] of Object.entries(CUTS)) {
      const out = blockId(items, wood, cut);
      const name = `${out}_from_${planks}_stonecutting`;
      // Flat like the vanilla recipes; the prefix keeps every file name apart from vanilla's own.
      files[`bp/recipes/${NS}_${name}.json`] = {
        format_version: model.format_version,
        'minecraft:recipe_shapeless': {
          description: { identifier: `${NS}:${name}` },
          ingredients: [{ item: `minecraft:${planks}` }],
          priority: 0,
          result: { count, item: `minecraft:${out}` },
          unlock: [{ item: `minecraft:${planks}` }],
          tags: ['stonecutter']
        }
      };
    }
  }
  return files;
}
