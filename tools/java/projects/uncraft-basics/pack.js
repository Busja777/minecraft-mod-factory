// Uncraft Basics: crafting recipes that take apart blocks vanilla packs but never unpacks again
// (wool, quartz, clay, snow, glowstone, amethyst, bricks, honeycomb, ice, dripstone; not magma: magma blocks are mined in bulk, so 4 cream per block would skip magma cubes).
//
// Nothing is typed in by hand except the allow list below. The list of candidates comes from the
// vanilla recipes of the version: every crafting recipe that packs one repeated ingredient into a
// single block ("compacting", 2×2 or 3×3), minus the pairs vanilla already takes apart itself
// (iron block, hay, slime, honey, bone, dried kelp …). Every amount is the cheapest amount of the
// material that any chain of vanilla recipes needs for the block, so a reverse recipe never gives
// more than went in and no loop can create items.
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
  { group: 'quartz', block: 'quartz_block', item: 'quartz', variants: ['quartz_pillar', 'chiseled_quartz_block'] },
  { group: 'clay', block: 'clay', item: 'clay_ball' },
  { group: 'snow', block: 'snow_block', item: 'snowball' },
  { group: 'glowstone', block: 'glowstone', item: 'glowstone_dust' },
  { group: 'amethyst', block: 'amethyst_block', item: 'amethyst_shard' },
  { group: 'bricks', block: 'bricks', item: 'brick' },
  { group: 'nether bricks', block: 'nether_bricks', item: 'nether_brick' },
  { group: 'honeycomb', block: 'honeycomb_block', item: 'honeycomb' },
  { group: 'ice', block: 'packed_ice', item: 'ice' },
  { group: 'ice', block: 'blue_ice', item: 'packed_ice' },
  { group: 'dripstone', block: 'dripstone_block', item: 'pointed_dripstone' }
];

const strip = id => String(id).replace(/^minecraft:/, '');

export function loadRecipes(vanilla) {
  const dir = path.join(vanilla.data, 'minecraft', 'recipe');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
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
function choices(vanilla, ing) {
  if (Array.isArray(ing)) return ing.flatMap(i => choices(vanilla, i));
  if (ing.item) return [strip(ing.item)];
  if (ing.tag) return tagItems(vanilla, ing.tag);
  return [];
}

// recipe → { inputs: [[choices] per slot], out, count } for the types that turn items into items.
export function flatten(vanilla, r) {
  const t = strip(r.type);
  let inputs;
  if (t === 'crafting_shaped') inputs = r.pattern.join('').split('').filter(c => c !== ' ').map(c => choices(vanilla, r.key[c]));
  else if (t === 'crafting_shapeless') inputs = r.ingredients.map(i => choices(vanilla, i));
  else if (['stonecutting', 'smelting', 'blasting', 'smoking', 'campfire_cooking'].includes(t)) inputs = [choices(vanilla, r.ingredient)];
  else if (t === 'smithing_transform') inputs = [r.template, r.base, r.addition].map(i => choices(vanilla, i));
  else return null;
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

// A vanilla crafting recipe that also takes just this one block would clash with ours.
export const clashes = (flat, block) =>
  flat.filter(r => r && r.type.startsWith('crafting_') && r.inputs.length === 1 && r.inputs[0].includes(block)).map(r => r.name);

// → [{ group, from, to, count }] in a stable order; throws when vanilla does not back a pair.
export function plan(vanilla, recipes = loadRecipes(vanilla)) {
  const flat = recipes.map(r => flatten(vanilla, r));
  const forward = compacting(flat);
  const out = [];
  for (const { group, block, item, variants = [] } of ALLOW) {
    const fwd = forward.find(f => f.block === block && f.item === item);
    if (!fwd) throw new Error(`${block} → ${item}: vanilla has no compacting recipe for this pair`);
    if (hasReverse(flat, block, item)) throw new Error(`${block} → ${item}: vanilla already has the reverse recipe`);
    const cost = baseCost(flat, item);
    for (const from of [block, ...variants]) {
      const amount = Math.floor(cost(from) + 1e-9);
      if (from === block && amount !== fwd.n) throw new Error(`${block}: a vanilla route needs only ${cost(from)} ${item}, not ${fwd.n}`);
      if (!(amount >= 1) || !Number.isFinite(cost(from))) throw new Error(`${from} → ${item}: no vanilla route from ${item} (cost ${cost(from)})`);
      if (from !== block && hasReverse(flat, from, item)) throw new Error(`${from} → ${item}: vanilla already has the reverse recipe`);
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

export default async function ({ vanilla }) {
  const files = {};
  for (const { from, to, count } of plan(vanilla)) {
    const name = `${from}_to_${to}`;
    files[`data/${NS}/recipe/${name}.json`] = {
      type: 'minecraft:crafting_shapeless',
      category: 'misc',
      ingredients: [{ item: `minecraft:${from}` }],
      result: { count, id: `minecraft:${to}` }
    };
    // Unlocks the recipe in the recipe book once the player holds the block, like vanilla does.
    files[`data/${NS}/advancement/recipes/misc/${name}.json`] = {
      parent: 'minecraft:recipes/root',
      criteria: {
        [`has_${from}`]: { conditions: { items: [{ items: `minecraft:${from}` }] }, trigger: 'minecraft:inventory_changed' },
        has_the_recipe: { conditions: { recipe: `${NS}:${name}` }, trigger: 'minecraft:recipe_unlocked' }
      },
      requirements: [['has_the_recipe', `has_${from}`]],
      rewards: { recipes: [`${NS}:${name}`] }
    };
  }
  return files;
}
