// Stonecutter Woodworks: wood is cut into planks, stairs, slabs, fences, fence gates, doors,
// trapdoors and pressure plates in the stonecutter, one block at a time.
// Amounts follow vanilla: a plank gives two slabs (like the crafting table), everything else one.
// 1.0: the eight overworld woods. 1.2: bamboo, crimson and warped, whose seven cuts all exist in
// Minecraft 1.21.1 and 26.3 (pale oak exists only in 26.3, so it stays out: every file must exist
// for every version the zip serves).
// 1.3: logs, wood, stems, hyphae and blocks of bamboo (stripped or not) are cut too. Each one gives
// exactly as many planks as the crafting table (read from the version's own planks recipe: 4, or 2
// for a block of bamboo) and of every cut as many as those planks would give, never more. A log is
// not cut into a stripped log: an axe strips it for free. Bamboo planks are also cut into bamboo
// mosaic at the crafting table's rate (2 bamboo slabs, i.e. one plank, make one mosaic), and mosaic
// into mosaic stairs and slabs.
import fs from 'fs';
import path from 'path';

export const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped'];
export const CUTS = { stairs: 1, slab: 2, fence: 1, fence_gate: 1, door: 1, trapdoor: 1, pressure_plate: 1 };
// What a bamboo mosaic is cut into (like stone into stone stairs and slabs).
export const MOSAIC_CUTS = { bamboo_mosaic_stairs: 1, bamboo_mosaic_slab: 2 };
const NS = 'stonecutter_woodworks';

// The blocks that give planks, as the vanilla tag in each planks recipe lists them. If a later
// Minecraft version changes a tag, the build stops instead of shipping a wrong file.
const STEMS = new Set(['crimson', 'warped']);
export function logs(wood) {
  if (wood === 'bamboo') return ['bamboo_block', 'stripped_bamboo_block'];
  const [log, bark] = STEMS.has(wood) ? ['stem', 'hyphae'] : ['log', 'wood'];
  return [`${wood}_${log}`, `${wood}_${bark}`, `stripped_${wood}_${log}`, `stripped_${wood}_${bark}`];
}

// Data pack format 57 (Minecraft 1.21.2) changed how a recipe names its ingredient: up to format 56
// it is { "item": "minecraft:oak_planks" }, from 57 on the plain string "minecraft:oak_planks".
const PLAIN_INGREDIENT = 57;

// One stonecutting recipe, written the way the version's own stonecutting recipes are written
// (compare stone_slab_from_stone_stonecutting.json and stone_stairs_from_stone_stonecutting.json).
// 1.21.1 always writes the count; 26.3 leaves it out when it is one.
export function cut(format, input, output, count) {
  if (format < PLAIN_INGREDIENT) {
    return {
      type: 'minecraft:stonecutting',
      ingredient: { item: `minecraft:${input}` },
      result: { id: `minecraft:${output}`, count }
    };
  }
  return {
    type: 'minecraft:stonecutting',
    ingredient: `minecraft:${input}`,
    result: count > 1 ? { count, id: `minecraft:${output}` } : { id: `minecraft:${output}` }
  };
}

const file = (output, input) => `data/${NS}/recipe/${output}_from_${input}_stonecutting.json`;

// ---- reading the vanilla rates -----------------------------------------------------------------

function vanillaJson(vanilla, ...parts) {
  const p = path.join(vanilla.data, 'minecraft', ...parts);
  if (!fs.existsSync(p)) throw new Error(`No vanilla ${parts.join('/')} at ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// An ingredient in either spelling: "minecraft:x", "#minecraft:t", { item }, { tag }.
const ingredientName = i => typeof i === 'string' ? i : i?.item ?? (i?.tag ? `#${i.tag}` : undefined);

// Planks per log: the vanilla shapeless planks recipe must take exactly the wood's tag, and that
// tag must list exactly logs(wood). → the result count (4, or 2 for bamboo).
export function planksPerLog(vanilla, wood) {
  const r = vanillaJson(vanilla, 'recipe', `${wood}_planks.json`);
  const tag = wood === 'bamboo' ? 'bamboo_blocks' : STEMS.has(wood) ? `${wood}_stems` : `${wood}_logs`;
  const ins = (r.ingredients || []).map(ingredientName);
  if (r.type !== 'minecraft:crafting_shapeless' || ins.length !== 1 || ins[0] !== `#minecraft:${tag}`) {
    throw new Error(`${wood}_planks.json: expected one ingredient #minecraft:${tag}, found ${ins.join(', ') || 'none'}`);
  }
  const values = vanillaJson(vanilla, 'tags', 'item', `${tag}.json`).values;
  const want = logs(wood).map(l => `minecraft:${l}`);
  if (JSON.stringify([...values].sort()) !== JSON.stringify([...want].sort())) {
    throw new Error(`tag ${tag}: expected ${want.join(', ')}, found ${values.join(', ')}`);
  }
  const count = r.result?.count ?? 1;
  if (!Number.isInteger(count) || count < 1) throw new Error(`${wood}_planks.json: odd result count ${count}`);
  return count;
}

// How many of `item` a shaped recipe uses (counted in its pattern) and how many it makes.
function shaped(vanilla, name, item) {
  const r = vanillaJson(vanilla, 'recipe', `${name}.json`);
  if (r.type !== 'minecraft:crafting_shaped') throw new Error(`${name}.json: expected a shaped recipe, found ${r.type}`);
  const keys = Object.entries(r.key || {});
  if (keys.length !== 1 || ingredientName(keys[0][1]) !== `minecraft:${item}`) throw new Error(`${name}.json: expected only ${item} as ingredient`);
  const used = r.pattern.join('').split('').filter(c => c === keys[0][0]).length;
  return { used, made: r.result?.count ?? 1 };
}

// Mosaics per bamboo plank: bamboo_mosaic takes bamboo slabs, bamboo_slab takes bamboo planks.
// Vanilla: 3 planks → 6 slabs, 2 slabs → 1 mosaic, so one plank → one mosaic.
export function mosaicPerPlank(vanilla) {
  const slab = shaped(vanilla, 'bamboo_slab', 'bamboo_planks');
  const mosaic = shaped(vanilla, 'bamboo_mosaic', 'bamboo_slab');
  const perPlank = (slab.made / slab.used) * (mosaic.made / mosaic.used);
  if (perPlank !== 1) throw new Error(`bamboo mosaic: expected one mosaic per plank, vanilla gives ${perPlank}`);
  return perPlank;
}

// ---- the pack ------------------------------------------------------------------------------------

// Called once per Minecraft version; the same recipes under the same paths for every version.
export default async function ({ vanilla, format }) {
  const files = {};
  const mosaic = mosaicPerPlank(vanilla);
  for (const wood of WOODS) {
    const planks = `${wood}_planks`;
    // What one plank becomes. The 77 recipes of 1.0 to 1.2 keep their names.
    const fromPlank = Object.fromEntries(Object.entries(CUTS).map(([c, n]) => [`${wood}_${c}`, n]));
    for (const [output, n] of Object.entries(fromPlank)) files[file(output, planks)] = cut(format, planks, output, n);
    if (wood === 'bamboo') {
      const mosaicFamily = { bamboo_mosaic: mosaic, ...Object.fromEntries(Object.entries(MOSAIC_CUTS).map(([o, n]) => [o, n * mosaic])) };
      for (const [output, n] of Object.entries(mosaicFamily)) files[file(output, planks)] = cut(format, planks, output, n);
      for (const [output, n] of Object.entries(MOSAIC_CUTS)) files[file(output, 'bamboo_mosaic')] = cut(format, 'bamboo_mosaic', output, n);
      Object.assign(fromPlank, mosaicFamily);
    }
    // A log gives what its planks would give: the planks themselves and every cut times that many.
    const per = planksPerLog(vanilla, wood);
    for (const log of logs(wood)) {
      files[file(planks, log)] = cut(format, log, planks, per);
      for (const [output, n] of Object.entries(fromPlank)) files[file(output, log)] = cut(format, log, output, n * per);
    }
  }
  return files;
}
