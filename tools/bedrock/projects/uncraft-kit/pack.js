// Uncraft Kit: crafting recipes that take apart blocks vanilla Bedrock packs but never unpacks
// again (wool, quartz, clay, snow, glowstone, amethyst, bricks, nether bricks, honeycomb, ice,
// dripstone, resin bricks). The idea and the fairness rule come from the Java sister pack
// tools/java/projects/uncraft-basics/.
//
// Nothing is typed in by hand except the allow list below. Every pair is backed by a vanilla
// recipe of the release: a crafting-table recipe that packs one repeated item into one block
// ("compacting", 2×2 or 3×3). Pairs vanilla already takes apart (hay, dried kelp, bone, slime,
// iron, gold, copper, coal, resin block …) stop the build. Every amount is the cheapest amount of
// the item that any chain of vanilla recipes (crafting table, stonecutter, furnaces, smithing)
// needs for the block, so a reverse recipe never gives more than went in and no loop creates items.
// Recipe shape: a vanilla shapeless crafting recipe of the same release
// (recipes/bone_meal_from_block.json: block in, pieces out).
const NS = 'uncraft_kit';
export const MODEL = 'recipes/bone_meal_from_block.json';

export const COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
// Bedrock ids (not Java's): brick_block is "Bricks", nether_brick the block of netherbrick items,
// snow the snow block. Left out on purpose, as in the Java pack: blocks that generate in large
// amounts and would turn into a cheap source of a valuable item (prismarine, nether wart block,
// sandstone), melon (a grown block that drops fewer slices), magma (magma blocks are mined in
// bulk), bamboo block (vanilla already turns it into planks alone, two recipes would clash),
// leather, nuggets, music disc fragments, armour and tools; and the sulfur blocks new in 26.x,
// until their place in the game is known.
export const ALLOW = [
  { group: 'wool', block: 'white_wool', item: 'string', variants: COLOURS.filter(c => c !== 'white').map(c => `${c}_wool`) },
  { group: 'quartz', block: 'quartz_block', item: 'quartz', variants: ['quartz_pillar', 'chiseled_quartz_block'] },
  { group: 'clay', block: 'clay', item: 'clay_ball' },
  { group: 'snow', block: 'snow', item: 'snowball' },
  { group: 'glowstone', block: 'glowstone', item: 'glowstone_dust' },
  { group: 'amethyst', block: 'amethyst_block', item: 'amethyst_shard' },
  { group: 'bricks', block: 'brick_block', item: 'brick' },
  { group: 'nether bricks', block: 'nether_brick', item: 'netherbrick' },
  { group: 'honeycomb', block: 'honeycomb_block', item: 'honeycomb' },
  { group: 'ice', block: 'packed_ice', item: 'ice' },
  { group: 'ice', block: 'blue_ice', item: 'packed_ice' },
  { group: 'dripstone', block: 'dripstone_block', item: 'pointed_dripstone' },
  { group: 'resin bricks', block: 'resin_bricks', item: 'resin_brick', variants: ['chiseled_resin_bricks'] }
];

// Bedrock recipes still name some items by an old id plus a data value. The ones that matter for
// the cost of a block are named here; everything else keeps "id:data" as its own name, and the
// build stops if such a leftover could be one of the pack's blocks (see plan()).
const DYES = ['ink_sac', 'red_dye', 'green_dye', 'cocoa_beans', 'lapis_lazuli', 'purple_dye', 'cyan_dye', 'light_gray_dye', 'gray_dye', 'pink_dye', 'lime_dye', 'yellow_dye', 'light_blue_dye', 'magenta_dye', 'orange_dye', 'bone_meal', 'black_dye', 'brown_dye', 'blue_dye', 'white_dye'];
const ALIAS = { 'quartz_block:1': 'chiseled_quartz_block', 'quartz_block:2': 'quartz_pillar', 'coal:1': 'charcoal', ...Object.fromEntries(DYES.map((d, i) => [`dye:${i}`, d])) };

const strip = id => String(id).replace(/^minecraft:/, '');
// 'minecraft:quartz_block:2' or { item, data } → 'quartz_pillar'
export function norm(id, data) {
  let [name, d] = strip(id).split(':');
  if (data !== undefined) d = String(data);
  if (d === undefined || d === '0') return name;
  return ALIAS[`${name}:${d}`] || `${name}:${d}`;
}

// One ingredient → the item names that fit. A tag cannot be resolved from the samples: it becomes
// '#tag', which costs nothing below (a safe lower bound: our blocks are in no tag).
function choices(ing) {
  if (Array.isArray(ing)) return ing.flatMap(choices);
  if (typeof ing === 'string') return [norm(ing)];
  if (ing?.item) return [norm(ing.item, ing.data)];
  if (ing?.tag) return [`#${strip(ing.tag)}`];
  throw new Error(`unknown ingredient ${JSON.stringify(ing)}`);
}

const TYPES = ['minecraft:recipe_shaped', 'minecraft:recipe_shapeless', 'minecraft:recipe_furnace', 'minecraft:recipe_smithing_transform'];
// A vanilla recipe file → { name, tags, inputs: [[choices] per slot], out, count, extra } for the
// recipes that turn items into items; null for brewing, trims and deprecated recipes.
export function flatten({ rel, json }) {
  const key = TYPES.find(k => json[k]);
  if (!key) return null;
  const r = json[key];
  const tags = r.tags || [];
  if (tags.includes('deprecated')) return null;
  let inputs;
  let result = r.result;
  if (key === 'minecraft:recipe_shaped') inputs = r.pattern.join('').split('').filter(c => c !== ' ').map(c => choices(r.key[c]));
  else if (key === 'minecraft:recipe_shapeless') inputs = r.ingredients.flatMap(i => Array(i.count ?? 1).fill(choices(i)));
  else if (key === 'minecraft:recipe_furnace') { inputs = [choices(r.input)]; result = r.output; }
  else inputs = [r.template, r.base, r.addition].map(choices);
  const results = (Array.isArray(result) ? result : [result]).map(x => (typeof x === 'string' ? { item: x } : x));
  return { name: rel.replace(/^recipes\/|\.json$/g, ''), tags, inputs, out: norm(results[0].item, results[0].data), count: results[0].count ?? 1, extra: results.length - 1 };
}

// Dyeing wool is built into Bedrock (no recipe file in the samples): any wool plus a dye gives a
// wool of that colour. Written out here so that coloured wool has a vanilla route from string.
const dyeWool = () => COLOURS.map(c => ({ name: `(built in) dye ${c} wool`, tags: ['crafting_table'], inputs: [COLOURS.map(x => `${x}_wool`), ['#dye']], out: `${c}_wool`, count: 1, extra: 0 }));

export function loadRecipes(vanillaFiles) {
  return [...vanillaFiles('bp', 'recipes').map(flatten).filter(Boolean), ...dyeWool()];
}

const crafting = r => r.tags.includes('crafting_table');

// Crafting-table recipes that pack n of one item into one block. → [{ recipe, block, item, n }]
export function compacting(flat) {
  return flat.filter(r => crafting(r) && r.count === 1 && r.extra === 0 && r.inputs.length >= 4)
    .filter(r => r.inputs.every(c => c.length === 1 && c[0] === r.inputs[0][0]))
    .map(r => ({ recipe: r.name, block: r.out, item: r.inputs[0][0], n: r.inputs.length }));
}

// Does vanilla already have a recipe (any station) that turns `block` into `item`?
export const reverseOf = (flat, block, item) => flat.filter(r => r.out === item && r.inputs.some(c => c.includes(block))).map(r => r.name);

// The smallest amount of `base` that any chain of vanilla recipes needs for one of each item.
// Ingredients that are not made from `base` count as 0, so the result is a safe lower bound.
export function baseCost(flat, base) {
  const made = new Set(flat.map(r => r.out));
  const cost = new Map();
  const of = id => (id === base ? 1 : cost.has(id) ? cost.get(id) : made.has(id) ? Infinity : 0);
  for (let round = 0, changed = true; changed && round < 100; round++) {
    changed = false;
    for (const r of flat) {
      if (r.out === base) continue;
      const each = r.inputs.reduce((sum, c) => sum + Math.min(...c.map(of)), 0) / r.count;
      if (each < of(r.out)) { cost.set(r.out, each); changed = true; }
    }
  }
  return of;
}

// A vanilla crafting recipe that takes just this one block would clash with ours.
export const clashes = (flat, block) => flat.filter(r => crafting(r) && r.inputs.length === 1 && r.inputs[0].includes(block)).map(r => r.name);

// → [{ group, from, to, count }] in a stable order; throws when vanilla does not back a pair.
export function plan(flat, items) {
  const forward = compacting(flat);
  const out = [];
  for (const { group, block, item, variants = [] } of ALLOW) {
    for (const id of [block, item, ...variants]) if (!items.has(id)) throw new Error(`${id} is not an item of this release`);
    const fwd = forward.find(f => f.block === block && f.item === item);
    if (!fwd) throw new Error(`${block} → ${item}: vanilla has no compacting recipe for this pair`);
    const cost = baseCost(flat, item);
    for (const from of [block, ...variants]) {
      const reverse = reverseOf(flat, from, item);
      if (reverse.length) throw new Error(`${from} → ${item}: vanilla already has the reverse recipe (${reverse.join(', ')})`);
      // A leftover old name ("quartz_block:5") could hide a cheaper route to this block.
      const hidden = flat.filter(r => r.out.startsWith(`${from}:`)).map(r => r.name);
      if (hidden.length) throw new Error(`${from}: vanilla recipes ${hidden.join(', ')} make it under an old data value`);
      const shared = flat.filter(r => r.out === from && r.extra > 0).map(r => r.name);
      if (shared.length) throw new Error(`${from}: vanilla recipes ${shared.join(', ')} make it together with something else`);
      const amount = Math.floor(cost(from) + 1e-9);
      if (from === block && amount !== fwd.n) throw new Error(`${block}: a vanilla route needs only ${cost(from)} ${item}, not ${fwd.n}`);
      if (!(amount >= 1) || !Number.isFinite(cost(from))) throw new Error(`${from} → ${item}: no vanilla route from ${item} (cost ${cost(from)})`);
      const clash = clashes(flat, from);
      if (clash.length) throw new Error(`${from}: vanilla recipe ${clash.join(', ')} already takes this block alone`);
      out.push({ group, from, to: item, count: amount });
    }
  }
  const seen = new Set();
  for (const p of out) {
    if (seen.has(p.from)) throw new Error(`${p.from} is taken apart twice`);
    seen.add(p.from);
  }
  return out;
}

export default async function ({ ids, vanilla, vanillaFiles }) {
  const model = vanilla('bp', MODEL)?.['minecraft:recipe_shapeless'];
  if (!model?.tags?.includes('crafting_table') || !model.unlock || model.ingredients?.length !== 1) throw new Error(`the vanilla model recipe ${MODEL} is gone or changed`);
  const format = vanilla('bp', MODEL).format_version;
  const files = {};
  for (const { from, to, count } of plan(loadRecipes(vanillaFiles), ids('items'))) {
    const name = `${from}_to_${to}`;
    // Flat like the vanilla recipes; the prefix keeps every file name apart from vanilla's own.
    files[`bp/recipes/${NS}_${name}.json`] = {
      format_version: format,
      'minecraft:recipe_shapeless': {
        description: { identifier: `${NS}:${name}` },
        tags: ['crafting_table'],
        ingredients: [{ item: `minecraft:${from}` }],
        unlock: [{ item: `minecraft:${from}` }],
        result: { item: `minecraft:${to}`, count }
      }
    };
  }
  return files;
}
