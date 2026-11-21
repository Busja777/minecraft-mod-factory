// Mob Drops Plus: one small, sensible extra drop for ten mobs that give little or nothing in vanilla.
// Each mob's vanilla loot table of the version is read and copied unchanged; one new pool is added
// at the end. Nothing rare or valuable: only blocks and materials that are cheap anyway.
//
//   mob          extra drop       amount per kill                     like vanilla's
//   husk         sand             0–2, Looting +0–1 per level         rotten flesh of the husk
//   drowned      kelp             0–1, Looting +0–1 per level         —
//   pillager     arrow            0–2, Looting +0–1 per level         arrows of the skeleton
//   zoglin       leather          0–1, Looting +0–1 per level         leather of the hoglin
//   ravager      leather          0–2, Looting +0–1 per level         leather of the horse
//   camel        leather          0–2, Looting +0–1 per level         leather of the horse
//   goat         leather          0–1, Looting +0–1 per level         leather of the hoglin
//   fox          sweet berries    0–1, Looting +0–1 per level         —
//   ocelot       string           0–2, no Looting                     string of the cat
//   cave spider  cobweb           1, only when killed by a player:    the drowned's copper ingot
//                                 5 %, with Looting 7 / 9 / 11 %
// "0–2" is a whole number from 0 to 2, each equally likely. Looting adds 0 or 1 per level, as for
// vanilla drops. Common drops fall whatever kills the mob (as rotten flesh does); the one chance
// drop needs a player, as every vanilla chance drop does.
//
// Left out on purpose: stray (snowballs) and bogged (mushrooms) – their vanilla tables carry tipped
// arrows written as set_potion "id": "minecraft:slowness", which the shared pack check reads as an
// unknown item; vex, endermite and silverfish (farmable from evokers, ender pearls and spawners);
// piglins (bartering stays the way to get gold from them); every rare or valuable item.
//
// The game reads two spellings of a loot table, each copied from the version's own vanilla tables:
//   1.21.1 (format 48)  "functions" / "conditions" lists, each element names itself under
//                       "function" / "condition"; pools carry "bonus_rolls"; set_count has "add": false
//   26.3 (format 121)   one "modifier" (a list when there are several) and one "condition" (all_of
//                       for several), each names itself under "type"; no "bonus_rolls", no "add"
// The spelling is never guessed: it is read from the vanilla tables, and the new pool's parts are
// first rebuilt from vanilla's own numbers and compared with vanilla's own JSON (husk, cat, drowned).
import fs from 'fs';
import path from 'path';

// count: [min, max] of set_count; looting: + uniform 0–1 per Looting level;
// chance: killed by a player and random_chance_with_enchanted_bonus { without Looting, Looting I, per level above I }.
export const DROPS = [
  { mob: 'husk', item: 'sand', count: [0, 2], looting: true },
  { mob: 'drowned', item: 'kelp', count: [0, 1], looting: true },
  { mob: 'pillager', item: 'arrow', count: [0, 2], looting: true },
  { mob: 'zoglin', item: 'leather', count: [0, 1], looting: true },
  { mob: 'ravager', item: 'leather', count: [0, 2], looting: true },
  { mob: 'camel', item: 'leather', count: [0, 2], looting: true },
  { mob: 'goat', item: 'leather', count: [0, 1], looting: true },
  { mob: 'fox', item: 'sweet_berries', count: [0, 1], looting: true },
  { mob: 'ocelot', item: 'string', count: [0, 2], looting: false },
  { mob: 'cave_spider', item: 'cobweb', chance: { unenchanted: 0.05, base: 0.07, perLevel: 0.02 } }
];

// Never as a drop of this pack.
export const FORBIDDEN = ['diamond', 'emerald', 'netherite_ingot', 'netherite_scrap', 'ancient_debris', 'totem_of_undying', 'enchanted_golden_apple',
  'golden_apple', 'gold_ingot', 'gold_nugget', 'iron_ingot', 'nether_star', 'heart_of_the_sea', 'trident', 'elytra', 'echo_shard', 'experience_bottle', 'enchanted_book'];

const fail = msg => { throw new Error(`mob-drops-plus: ${msg} – the pack must be checked against this version by hand`); };

export const SPELLINGS = {
  lists: {
    condition: 'conditions',
    modifier: 'functions',
    pool: (cond, entries) => ({ bonus_rolls: 0, ...(cond ? { conditions: cond } : {}), entries, rolls: 1 }),
    setCount: (min, max) => ({ add: false, count: { type: 'minecraft:uniform', max, min }, function: 'minecraft:set_count' }),
    looting: () => ({ count: { type: 'minecraft:uniform', max: 1, min: 0 }, enchantment: 'minecraft:looting', function: 'minecraft:enchanted_count_increase' }),
    modifiers: list => list,
    playerChance: ({ unenchanted, base, perLevel }) => [
      { condition: 'minecraft:killed_by_player' },
      { condition: 'minecraft:random_chance_with_enchanted_bonus', enchanted_chance: { type: 'minecraft:linear', base, per_level_above_first: perLevel }, enchantment: 'minecraft:looting', unenchanted_chance: unenchanted }
    ],
    entry: (name, mods) => ({ type: 'minecraft:item', ...(mods ? { functions: mods } : {}), name })
  },
  single: {
    condition: 'condition',
    modifier: 'modifier',
    pool: (cond, entries) => ({ ...(cond ? { condition: cond } : {}), entries, rolls: 1 }),
    setCount: (min, max) => ({ type: 'minecraft:set_count', count: { type: 'minecraft:uniform', max, min } }),
    looting: () => ({ type: 'minecraft:enchanted_count_increase', count: { type: 'minecraft:uniform', max: 1, min: 0 }, enchantment: 'minecraft:looting' }),
    modifiers: list => (list.length === 1 ? list[0] : list),
    playerChance: ({ unenchanted, base, perLevel }) => ({
      type: 'minecraft:all_of',
      terms: [
        { type: 'minecraft:killed_by_player' },
        { type: 'minecraft:random_chance_with_enchanted_bonus', enchanted_chance: { type: 'minecraft:linear', base, per_level_above_first: perLevel }, enchantment: 'minecraft:looting', unenchanted_chance: unenchanted }
      ]
    }),
    entry: (name, mods) => ({ type: 'minecraft:item', ...(mods ? { modifier: mods } : {}), name })
  }
};

// Keys that only the other spelling has; the game would skip them without a word.
const FOREIGN = new Map([
  [SPELLINGS.lists, ['modifier:object', 'condition:object']],
  [SPELLINGS.single, ['conditions:object', 'functions:object', 'condition:string', 'function:string', 'bonus_rolls:number', 'add:boolean']]
]);

const TABLES = ['data', 'minecraft', 'loot_table', 'entities'];
function read(vanilla, mob) {
  const file = path.join(vanilla.data, ...TABLES.slice(1), `${mob}.json`);
  if (!fs.existsSync(file)) fail(`entities/${mob}.json is missing`);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

const sorted = v => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

function keysIn(value, found = []) {
  if (Array.isArray(value)) value.forEach(v => keysIn(v, found));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { found.push(`${k}:${typeof v}`); keysIn(v, found); }
  return found;
}

// Every item a table can drop (entry "name" of item entries, at any depth).
function itemsOf(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach(v => itemsOf(v, found));
  else if (value && typeof value === 'object') {
    if (value.type === 'minecraft:item' && typeof value.name === 'string') found.add(value.name.replace(/^minecraft:/, ''));
    Object.values(value).forEach(v => itemsOf(v, found));
  }
  return found;
}

// How this version writes its loot tables: the spelling whose keys the vanilla tables use.
export function spellingOf(tables) {
  const keys = new Set(tables.flatMap(t => keysIn(t)));
  const found = Object.keys(SPELLINGS).filter(name => !FOREIGN.get(SPELLINGS[name]).some(k => keys.has(k)));
  if (found.length !== 1) fail(`entity tables: ${found.length ? 'both spellings fit' : 'neither spelling fits'}`);
  return SPELLINGS[found[0]];
}

// The parts of the new pool, rebuilt from vanilla's numbers, must equal vanilla's own JSON.
export function checkAgainstVanilla(spelling, { husk, cat, drowned }) {
  const flesh = husk.pools?.[0]?.entries?.[0];
  if (flesh?.name !== 'minecraft:rotten_flesh' || !same(flesh[spelling.modifier], spelling.modifiers([spelling.setCount(0, 2), spelling.looting()]))) fail('husk: rotten flesh is not written as expected (set_count 0–2 + looting)');
  const string = cat.pools?.[0]?.entries?.[0];
  if (string?.name !== 'minecraft:string' || !same(string[spelling.modifier], spelling.modifiers([spelling.setCount(0, 2)]))) fail('cat: string is not written as expected (set_count 0–2)');
  const copper = drowned.pools?.find(p => p.entries?.[0]?.name === 'minecraft:copper_ingot');
  if (!copper || !same(copper[spelling.condition], spelling.playerChance({ unenchanted: 0.11, base: 0.13, perLevel: 0.02 }))) fail('drowned: the copper ingot chance is not written as expected');
  // Pools in the spelling's shape: the same keys as vanilla's pools without a condition.
  const plain = husk.pools[0];
  if (!same(Object.keys(plain).sort(), Object.keys(spelling.pool(null, [])).sort())) fail(`husk: pool keys ${Object.keys(plain).join(', ')}`);
}

export function extraPool(drop, spelling) {
  const mods = drop.count ? [spelling.setCount(...drop.count), ...(drop.looting ? [spelling.looting()] : [])] : [];
  const entry = spelling.entry(`minecraft:${drop.item}`, mods.length ? spelling.modifiers(mods) : null);
  return spelling.pool(drop.chance ? spelling.playerChance(drop.chance) : null, [entry]);
}

export function checkDrops(list = DROPS) {
  const mobs = new Set();
  for (const d of list) {
    if (mobs.has(d.mob)) fail(`${d.mob} is listed twice`);
    mobs.add(d.mob);
    if (FORBIDDEN.includes(d.item)) fail(`${d.mob}: ${d.item} is too valuable`);
    if (!!d.count === !!d.chance) fail(`${d.mob}: either an amount or a chance`);
    if (d.count && !(d.count[0] >= 0 && d.count[1] >= d.count[0] && d.count[1] <= 2)) fail(`${d.mob}: at most 2 at a time`);
    if (d.chance && !(d.chance.unenchanted <= 0.1 && d.chance.base + 2 * d.chance.perLevel <= 0.15)) fail(`${d.mob}: chance too high`);
  }
}

export default async function ({ vanilla, registry }) {
  checkDrops();
  const items = registry('item');
  const entities = registry('entity_type');
  const reference = { husk: read(vanilla, 'husk'), cat: read(vanilla, 'cat'), drowned: read(vanilla, 'drowned') };
  const tables = Object.fromEntries(DROPS.map(d => [d.mob, read(vanilla, d.mob)]));
  const spelling = spellingOf([...Object.values(reference), ...Object.values(tables)]);
  checkAgainstVanilla(spelling, reference);

  const files = {};
  for (const drop of DROPS) {
    if (!entities.has(drop.mob)) fail(`no mob ${drop.mob}`);
    if (!items.has(drop.item)) fail(`no item ${drop.item}`);
    const table = structuredClone(tables[drop.mob]);
    const rel = `entities/${drop.mob}.json`;
    if (table.type !== 'minecraft:entity') fail(`${rel}: type ${table.type}`);
    const extra = Object.keys(table).filter(k => !['type', 'pools', 'random_sequence'].includes(k));
    if (extra.length) fail(`${rel}: unexpected "${extra.join('", "')}"`);
    if (table.random_sequence !== `minecraft:entities/${drop.mob}`) fail(`${rel}: random_sequence ${table.random_sequence}`);
    if (itemsOf(table).has(drop.item)) fail(`${rel}: vanilla already drops ${drop.item}`);
    const out = { type: table.type, pools: [...(table.pools || []), extraPool(drop, spelling)], random_sequence: table.random_sequence };
    const wrong = keysIn(out).filter(k => FOREIGN.get(spelling).includes(k));
    if (wrong.length) fail(`${rel} mixes two loot table spellings (${[...new Set(wrong)].join(', ')})`);
    files[`${TABLES.join('/')}/${drop.mob}.json`] = out;
  }
  return files;
}
