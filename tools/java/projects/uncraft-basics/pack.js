// Uncraft Basics: crafting recipes that take apart blocks vanilla packs but never unpacks again
// (wool, quartz, clay, snow, glowstone, amethyst, bricks, honeycomb, ice, dripstone; not magma: magma blocks are mined in bulk, so 4 cream per block would skip magma cubes).
// Since V1.2 also the polished, bricks, tiles and chiseled blocks of the stone families back into
// the stone they are cut from, and glass panes back into glass.
//
// Nothing is typed in by hand except the two allow lists below. The list of candidates comes from the
// vanilla recipes of the version: every crafting recipe that packs one repeated ingredient into a
// single block ("compacting", 2×2 or 3×3), minus the pairs vanilla already takes apart itself
// (iron block, hay, slime, honey, bone, dried kelp …). Every amount is the cheapest amount of the
// material that any chain of vanilla recipes needs for the block, so a reverse recipe never gives
// more than went in and no loop can create items. `gains` checks this once more for all pairs
// together, measured in every material the blocks can be made from (a stonecutter 1:1 and our
// reverse 1:1 make a loop that gives back exactly what went in, never more).
//
// The pack is generated once per Minecraft version it serves (1.21.1 and 26.3), from that version's
// own vanilla recipes and in that version's own spelling. What differs between versions is kept in
// three places: `choices` and `flatten` (reading vanilla) and `dialect` with its writers `recipe`
// and `unlock` (writing ours).
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const NS = 'uncraft_basics';

// The pairs V1.0 includes. block → item comes from a vanilla compacting recipe; variants are blocks
// made from that block (dyed wool, quartz pillar …) that take apart into the same item.
// Left out on purpose: blocks that generate in the world in large amounts and would turn into a
// cheap source of a valuable item (prismarine, nether wart block, sandstone), melon (a grown block
// that drops fewer slices), and pairs that are not really "packed" blocks (leather from rabbit hide,
// gold/iron from nuggets, music disc fragments, armour and tools), and bamboo block, because vanilla
// already turns a single bamboo block into planks and two recipes for one block would clash.
export const COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
export const ALLOW = [
  { group: 'wool', block: 'white_wool', item: 'string', variants: COLOURS.filter(c => c !== 'white').map(c => `${c}_wool`) },
  // quartz_bricks since V1.2
  { group: 'quartz', block: 'quartz_block', item: 'quartz', variants: ['quartz_pillar', 'chiseled_quartz_block', 'quartz_bricks'] },
  { group: 'clay', block: 'clay', item: 'clay_ball' },
  { group: 'snow', block: 'snow_block', item: 'snowball' },
  { group: 'glowstone', block: 'glowstone', item: 'glowstone_dust' },
  { group: 'amethyst', block: 'amethyst_block', item: 'amethyst_shard' },
  { group: 'bricks', block: 'bricks', item: 'brick' },
  // chiseled_nether_bricks since V1.2
  { group: 'nether bricks', block: 'nether_bricks', item: 'nether_brick', variants: ['chiseled_nether_bricks'] },
  { group: 'honeycomb', block: 'honeycomb_block', item: 'honeycomb' },
  { group: 'ice', block: 'packed_ice', item: 'ice' },
  { group: 'ice', block: 'blue_ice', item: 'packed_ice' },
  { group: 'dripstone', block: 'dripstone_block', item: 'pointed_dripstone' }
];

// V1.2: blocks made from one stone without a furnace and without other ingredients (crafted 4 → 4
// or cut 1:1 in the stonecutter) go back into that stone, n of them at once (1 unless given).
// The amount is again the cheapest vanilla amount: 1 for every stone block, and for glass panes
// (6 glass → 16 panes) 8 panes → 3 glass, the only grid-sized amount that is a whole number.
// Left out on purpose: blocks made in the furnace (smooth stone, cracked bricks, smooth sandstone,
// smooth quartz, terracotta: undoing a furnace is not uncrafting), blocks that need a second
// ingredient (mossy stone bricks: vine or moss; red nether bricks: nether wart; tinted glass:
// amethyst), stairs, slabs and walls, polished blackstone (vanilla already makes a button from that
// block alone), stained glass panes (most are dyed from plain panes, which contain no stained glass,
// so the cheapest amount is 0) and copper (oxidation and wax would need a recipe per stage).
export const FAMILIES = [
  { group: 'stone', base: 'stone', variants: ['stone_bricks', 'chiseled_stone_bricks'] },
  { group: 'andesite', base: 'andesite', variants: ['polished_andesite'] },
  { group: 'diorite', base: 'diorite', variants: ['polished_diorite'] },
  { group: 'granite', base: 'granite', variants: ['polished_granite'] },
  { group: 'deepslate', base: 'cobbled_deepslate', variants: ['polished_deepslate', 'deepslate_bricks', 'deepslate_tiles', 'chiseled_deepslate'] },
  { group: 'tuff', base: 'tuff', variants: ['polished_tuff', 'tuff_bricks', 'chiseled_tuff', 'chiseled_tuff_bricks'] },
  { group: 'blackstone', base: 'blackstone', variants: ['polished_blackstone_bricks', 'chiseled_polished_blackstone'] },
  { group: 'sandstone', base: 'sandstone', variants: ['cut_sandstone', 'chiseled_sandstone'] },
  { group: 'red sandstone', base: 'red_sandstone', variants: ['cut_red_sandstone', 'chiseled_red_sandstone'] },
  { group: 'end stone', base: 'end_stone', variants: ['end_stone_bricks'] },
  { group: 'purpur', base: 'purpur_block', variants: ['purpur_pillar'] },
  { group: 'basalt', base: 'basalt', variants: ['polished_basalt'] },
  { group: 'mud', base: 'packed_mud', variants: ['mud_bricks'] },
  { group: 'glass', base: 'glass', variants: ['glass_pane'], n: 8 }
];

const strip = id => String(id).replace(/^minecraft:/, '');

// Every vanilla recipe of the version. 26.3 keeps its brewing recipes in a sub-folder, so the
// folder is read with its sub-folders (name: "brewing/…").
export function loadRecipes(vanilla) {
  const dir = path.join(vanilla.data, 'minecraft', 'recipe');
  return fs.readdirSync(dir, { recursive: true }).map(f => f.split(path.sep).join('/')).filter(f => f.endsWith('.json')).sort()
    .map(f => ({ name: f.replace(/\.json$/, ''), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) }));
}

// Item tag → item ids (tags inside tags are followed).
function tagItems(vanilla, tag, seen = new Set()) {
  const name = strip(tag.replace(/^#/, ''));
  if (seen.has(name)) return [];
  seen.add(name);
  const file = path.join(vanilla.data, 'minecraft', 'tags', 'item', `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`unknown item tag ${tag}`);
  return JSON.parse(fs.readFileSync(file, 'utf-8')).values
    .flatMap(v => (typeof v === 'string' ? v : v.id))
    .flatMap(v => (v.startsWith('#') ? tagItems(vanilla, v, seen) : [strip(v)]));
}

// One ingredient (item, tag or a list of choices) → the item ids that fit.
// 1.21.1 writes { "item": "minecraft:x" } and { "tag": "minecraft:x" }; from data pack format 57
// (Minecraft 1.21.2) on, and so in 26.3, it is the plain string "minecraft:x" or "#minecraft:x".
// Lists are lists of either spelling.
function choices(vanilla, ing) {
  if (Array.isArray(ing)) return ing.flatMap(i => choices(vanilla, i));
  if (typeof ing === 'string') return ing.startsWith('#') ? tagItems(vanilla, ing) : [strip(ing)];
  if (ing.item) return [strip(ing.item)];
  if (ing.tag) return tagItems(vanilla, ing.tag);
  return [];
}

// recipe → { inputs: [[choices] per slot], out, count } for the types that turn items into items.
// 26.3 leaves out a result count of 1 and has three crafting types 1.21.1 did not have as data
// (crafting_transmute: dyeing shulker boxes and bundles, crafting_dye: leather armour,
// crafting_imbue: tipped arrows); they are read so that no route to an item is overlooked. Their
// inputs are counted once each, which can only make an amount smaller, never larger.
// Not read: the special crafting types and 26.3's brewing recipes (potions are in no chain here).
export function flatten(vanilla, r) {
  const t = strip(r.type);
  let inputs;
  if (t === 'crafting_shaped') inputs = r.pattern.join('').split('').filter(c => c !== ' ').map(c => choices(vanilla, r.key[c]));
  else if (t === 'crafting_shapeless') inputs = r.ingredients.map(i => choices(vanilla, i));
  else if (['stonecutting', 'smelting', 'blasting', 'smoking', 'campfire_cooking'].includes(t)) inputs = [choices(vanilla, r.ingredient)];
  else if (t === 'smithing_transform') inputs = [r.template, r.base, r.addition].map(i => choices(vanilla, i));
  else if (t === 'crafting_transmute') inputs = [r.input, r.material].map(i => choices(vanilla, i));
  else if (t === 'crafting_dye') inputs = [r.target, r.dye].map(i => choices(vanilla, i));
  else if (t === 'crafting_imbue') inputs = [r.source, r.material].map(i => choices(vanilla, i));
  else return null;
  if (!r.result?.id) return null;   // 26.3 map cloning: the result is the map that was put in
  return { name: r.name, type: t, inputs, out: strip(r.result.id), count: r.result.count ?? 1 };
}

// Crafting recipes that pack n of one item into one block. → [{ recipe, block, item, n }]
export function compacting(flat) {
  return flat.filter(r => r && r.type.startsWith('crafting_') && r.count === 1 && r.inputs.length >= 4)
    .filter(r => r.inputs.every(c => c.length === 1 && c[0] === r.inputs[0][0]))
    .map(r => ({ recipe: r.name, block: r.out, item: r.inputs[0][0], n: r.inputs.length }));
}

// Does vanilla already have a crafting recipe that turns `block` (alone or with other items) into `item`?
export const hasReverse = (flat, block, item) =>
  flat.some(r => r && r.type.startsWith('crafting_') && r.out === item && r.inputs.some(c => c.includes(block)));

// The smallest amount of `base` that any chain of vanilla recipes needs for one of each item.
// Ingredients that are not made from `base` count as 0, so the result is a safe lower bound.
export function baseCost(flat, base) {
  const recipes = flat.filter(Boolean);
  const made = new Set(recipes.map(r => r.out));
  const cost = new Map();
  const of = id => (id === base ? 1 : cost.has(id) ? cost.get(id) : made.has(id) ? Infinity : 0);
  for (let round = 0, changed = true; changed && round < 100; round++) {
    changed = false;
    for (const r of recipes) {
      if (r.out === base) continue;
      const total = r.inputs.reduce((sum, c) => sum + Math.min(...c.map(of)), 0);
      const each = total / r.count;
      if (each < of(r.out)) { cost.set(r.out, each); changed = true; }
    }
  }
  return of;
}

// A vanilla crafting recipe that also takes just n of this block (and nothing else) would clash with ours.
export const clashes = (flat, block, n = 1) =>
  flat.filter(r => r && r.type.startsWith('crafting_') && r.inputs.length === n && r.inputs.every(c => c.includes(block))).map(r => r.name);

// Every item that appears in a vanilla recipe chain leading to `id` (not `id` itself).
export function ancestors(flat, id) {
  const found = new Set();
  const todo = [id];
  while (todo.length) {
    const cur = todo.pop();
    for (const r of flat) {
      if (!r || r.out !== cur) continue;
      for (const c of r.inputs) for (const i of c) if (i !== id && !found.has(i)) { found.add(i); todo.push(i); }
    }
  }
  return found;
}

// No loop of vanilla recipes and ours creates a material. Each material m that one of our blocks can
// be made of gives a measure "cheapest amount of m" (baseCost). Vanilla recipes never raise it, by
// definition of "cheapest"; every recipe of ours must not raise it either:
// count × (m in `to`) ≤ n × (m in `from`). Then nothing measured in m can be gained, whatever the
// chain. One exception: when vanilla cannot make `to` from m at all (m in `to` is Infinity, as for
// stone from stone bricks in 26.3, where stone and cobblestone only make each other), m must itself
// be made from `to`; the measure "cheapest `to`" is checked too and already covers m.
// → the broken measures as text (empty = fair).
export function gains(flat, pairs, costOf) {
  const measures = new Set(pairs.flatMap(p => [p.to, ...ancestors(flat, p.from)]));
  const broken = [];
  for (const m of measures) {
    const cost = costOf(m);
    for (const { from, to, count, n = 1 } of pairs) {
      const out = count * cost(to);
      const into = n * cost(from);
      if (out <= into + 1e-9) continue;
      const mFromTo = costOf(to)(m);
      if (out === Infinity && Number.isFinite(mFromTo) && mFromTo > 0) continue;
      broken.push(`${n} ${from} → ${count} ${to} creates ${m} (${into} in, ${out} out)`);
    }
  }
  return broken;
}

// → [{ group, from, to, count, n }] in a stable order; throws when vanilla does not back a pair.
export function plan(vanilla, recipes = loadRecipes(vanilla)) {
  const flat = recipes.map(r => flatten(vanilla, r));
  const forward = compacting(flat);
  const costs = new Map();
  const costOf = base => { if (!costs.has(base)) costs.set(base, baseCost(flat, base)); return costs.get(base); };
  const out = [];
  for (const { group, block, item, variants = [] } of ALLOW) {
    const fwd = forward.find(f => f.block === block && f.item === item);
    if (!fwd) throw new Error(`${block} → ${item}: vanilla has no compacting recipe for this pair`);
    if (hasReverse(flat, block, item)) throw new Error(`${block} → ${item}: vanilla already has the reverse recipe`);
    const cost = costOf(item);
    for (const from of [block, ...variants]) {
      const amount = Math.floor(cost(from) + 1e-9);
      if (from === block && amount !== fwd.n) throw new Error(`${block}: a vanilla route needs only ${cost(from)} ${item}, not ${fwd.n}`);
      if (!(amount >= 1) || !Number.isFinite(cost(from))) throw new Error(`${from} → ${item}: no vanilla route from ${item} (cost ${cost(from)})`);
      if (from !== block && hasReverse(flat, from, item)) throw new Error(`${from} → ${item}: vanilla already has the reverse recipe`);
      const clash = clashes(flat, from);
      if (clash.length) throw new Error(`${from}: vanilla recipe ${clash.join(', ')} already takes this block alone`);
      out.push({ group, from, to: item, count: amount, n: 1 });
    }
  }
  for (const { group, base, variants, n = 1 } of FAMILIES) {
    const cost = costOf(base);
    for (const from of variants) {
      const amount = Math.floor(n * cost(from) + 1e-9);
      if (!(amount >= 1) || !Number.isFinite(cost(from))) throw new Error(`${n} ${from} → ${base}: vanilla makes it from less than one ${base} (cost ${cost(from)} each)`);
      if (hasReverse(flat, from, base)) throw new Error(`${from} → ${base}: vanilla already has the reverse recipe`);
      const clash = clashes(flat, from, n);
      if (clash.length) throw new Error(`${from}: vanilla recipe ${clash.join(', ')} already takes ${n} of this block alone`);
      out.push({ group, from, to: base, count: amount, n });
    }
  }
  const seen = new Set();
  for (const p of out) {
    if (seen.has(p.from)) throw new Error(`${p.from} is taken apart twice`);
    seen.add(p.from);
  }
  const broken = gains(flat, out, costOf);
  if (broken.length) throw new Error(`not fair:\n${broken.join('\n')}`);
  return out;
}

// Vanilla has one recipe of exactly our kind, in every version: one netherite block alone gives 9
// ingots, unlocked in the recipe book by holding the block. It is the model for how a version
// spells our files.
const TWIN = { from: 'netherite_block', to: 'netherite_ingot', count: 9, id: 'minecraft:netherite_ingot_from_netherite_block' };

// n of one block (1 = the block alone) in the crafting grid → count pieces, in the spelling `d` (see dialect).
function recipe(d, from, to, count, n = 1) {
  return {
    type: 'minecraft:crafting_shapeless',
    ...(d.category ? { category: 'misc' } : {}),
    ingredients: Array.from({ length: n }, () => (d.plainIngredient ? `minecraft:${from}` : { item: `minecraft:${from}` })),
    result: { count, id: `minecraft:${to}` }
  };
}

// Unlocks the recipe `id` in the recipe book once the player holds the block, like vanilla does.
function unlock(d, from, id) {
  return {
    parent: 'minecraft:recipes/root',
    criteria: {
      [`has_${from}`]: { conditions: { items: [{ items: `minecraft:${from}` }] }, trigger: 'minecraft:inventory_changed' },
      has_the_recipe: { conditions: { [d.unlockKey]: id }, trigger: 'minecraft:recipe_unlocked' }
    },
    requirements: [['has_the_recipe', `has_${from}`]],
    rewards: { recipes: [id] }
  };
}

// How this version spells a recipe and its advancement, read off vanilla's twin:
//                        1.21.1 (data pack format 48)            26.3 (format 121)
//   ingredient           { "item": "minecraft:x" }               "minecraft:x"
//   "category": "misc"   written                                 left out (it is the default)
//   recipe_unlocked      "conditions": { "recipe": id }          "conditions": { "recipes": id }
// The ingredient changed with format 57; at which format the other two changed is not known here
// (only these two versions were compared), so the spelling is taken from the version's own files
// instead of from the format number. With the spelling found, the writers must give back vanilla's
// twin exactly; a version that spells anything else differently stops the build here instead of
// shipping files in an old spelling.
export function dialect(vanilla) {
  const read = file => JSON.parse(fs.readFileSync(path.join(vanilla.data, 'minecraft', file), 'utf-8'));
  const name = strip(TWIN.id);
  const { group, ...twinRecipe } = read(`recipe/${name}.json`);
  const twinUnlock = read(`advancement/recipes/misc/${name}.json`);
  const d = {
    plainIngredient: typeof twinRecipe.ingredients?.[0] === 'string',
    category: 'category' in twinRecipe,
    unlockKey: Object.keys(twinUnlock.criteria?.has_the_recipe?.conditions || {})[0]
  };
  try {
    assert.deepStrictEqual(recipe(d, TWIN.from, TWIN.to, TWIN.count), twinRecipe);
    assert.deepStrictEqual(unlock(d, TWIN.from, TWIN.id), twinUnlock);
  } catch (e) {
    throw new Error(`this Minecraft version writes ${TWIN.id} or its advancement in a way the pack does not know yet:\n${e.message}`);
  }
  return d;
}

// Called once per Minecraft version: the same 55 recipes under the same paths for every version.
export default async function ({ vanilla }) {
  const d = dialect(vanilla);
  const files = {};
  for (const { from, to, count, n } of plan(vanilla)) {
    const name = `${from}_to_${to}`;
    files[`data/${NS}/recipe/${name}.json`] = recipe(d, from, to, count, n);
    files[`data/${NS}/advancement/recipes/misc/${name}.json`] = unlock(d, from, `${NS}:${name}`);
  }
  return files;
}
