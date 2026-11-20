// Anglers Loot: fishing gives less junk and more treasure. The vanilla fishing loot tables of the
// cache are read and only weights and entries are changed, so every condition stays vanilla
// (open water for treasure, the jungle-only bamboo, Luck of the Sea through the "quality" values).
// The build stops if a vanilla table is not shaped as this file expects.
//
// Only the tables that change are overridden: gameplay/fishing (junk/treasure/fish weights) and
// gameplay/fishing/treasure (two extra catches). fish.json and junk.json stay vanilla; they are
// still read and checked, because the main table points to them.
//
// Chances per cast in open water without Luck of the Sea (weight / sum of weights):
//   vanilla  junk 10/100 = 10 %,  treasure 5/100 = 5 %,  fish 85/100 = 85 %
//   pack     junk  5/98  ≈ 5.1 %, treasure 8/98  ≈ 8.2 %, fish 85/98  ≈ 86.7 %
// Luck of the Sea adds quality × level to each weight (never below 0): at level III junk is 5 - 6
// → 0, so a fully enchanted rod catches no junk at all (vanilla: 4 of 97).
// Inside the treasure table every vanilla item keeps weight 1 of now 10 instead of 6, so each old
// treasure (enchanted book, bow, rod, saddle, name tag, nautilus shell) stays at about 0.8 % per
// cast as in vanilla; the extra treasure share goes to the new catches.
import fs from 'fs';
import path from 'path';

// Weights of the three sub tables in gameplay/fishing. Vanilla: junk 10, treasure 5, fish 85.
export const WEIGHTS = { junk: 5, treasure: 8, fish: 85 };

// New entries of the treasure table, in vanilla loot entry format.
export const EXTRA_TREASURE = [
  { type: 'minecraft:item', name: 'minecraft:heart_of_the_sea', weight: 1 },
  {
    type: 'minecraft:item',
    functions: [{ add: false, count: { type: 'minecraft:uniform', max: 3.0, min: 1.0 }, function: 'minecraft:set_count' }],
    name: 'minecraft:experience_bottle',
    weight: 3
  }
];

// What the vanilla 1.21.1 tables must look like before anything is changed.
const EXPECTED_MAIN = {
  junk: { weight: 10, quality: -2 },
  treasure: { weight: 5, quality: 2 },
  fish: { weight: 85, quality: -1 }
};
const EXPECTED_TREASURE = ['name_tag', 'saddle', 'bow', 'fishing_rod', 'book', 'nautilus_shell'];
const EXPECTED_FISH = ['cod', 'salmon', 'tropical_fish', 'pufferfish'];
const EXPECTED_JUNK = ['lily_pad', 'leather_boots', 'leather', 'bone', 'potion', 'string', 'fishing_rod', 'bowl', 'stick', 'ink_sac', 'tripwire_hook', 'rotten_flesh', 'bamboo'];

const TABLES = 'data/minecraft/loot_table/gameplay';
const fail = msg => { throw new Error(`anglers-loot: vanilla ${msg} – the pack must be checked against this version by hand`); };

function read(vanilla, rel) {
  const file = path.join(vanilla.data, 'minecraft', 'loot_table', 'gameplay', rel);
  if (!fs.existsSync(file)) fail(`${rel} is missing`);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// The single pool of a fishing table, after checking its shape.
function onePool(table, rel) {
  if (table.type !== 'minecraft:fishing') fail(`${rel}: type is ${table.type}, expected minecraft:fishing`);
  if (!Array.isArray(table.pools) || table.pools.length !== 1) fail(`${rel}: expected exactly one pool`);
  const pool = table.pools[0];
  if (pool.rolls !== 1 || (pool.bonus_rolls ?? 0) !== 0) fail(`${rel}: expected rolls 1 and bonus_rolls 0`);
  if (!Array.isArray(pool.entries)) fail(`${rel}: pool has no entries`);
  return pool;
}

// Item entries of a sub table must be exactly the expected items, in order.
function itemNames(table, rel, expected) {
  const names = onePool(table, rel).entries.map(e => {
    if (e.type !== 'minecraft:item') fail(`${rel}: entry of type ${e.type}, expected minecraft:item`);
    return String(e.name).replace(/^minecraft:/, '');
  });
  if (names.join() !== expected.join()) fail(`${rel}: items are ${names.join(', ')}, expected ${expected.join(', ')}`);
  return names;
}

export function buildMain(table) {
  const out = structuredClone(table);
  const entries = onePool(out, 'fishing.json').entries;
  const seen = new Set();
  for (const entry of entries) {
    const key = Object.keys(EXPECTED_MAIN).find(k => entry.value === `minecraft:gameplay/fishing/${k}`);
    if (entry.type !== 'minecraft:loot_table' || !key) fail(`fishing.json: unexpected entry ${entry.type} ${entry.value}`);
    const want = EXPECTED_MAIN[key];
    if (entry.weight !== want.weight || entry.quality !== want.quality) fail(`fishing.json: ${key} has weight ${entry.weight} and quality ${entry.quality}, expected ${want.weight} and ${want.quality}`);
    seen.add(key);
    entry.weight = WEIGHTS[key];
  }
  if (seen.size !== 3 || entries.length !== 3) fail('fishing.json: expected the three entries junk, treasure and fish');
  const treasure = entries.find(e => e.value.endsWith('/treasure'));
  const openWater = (treasure.conditions || []).some(c => c.condition === 'minecraft:entity_properties' && c.predicate?.type_specific?.type === 'minecraft:fishing_hook' && c.predicate.type_specific.in_open_water === true);
  if (!openWater) fail('fishing.json: treasure is not limited to open water any more');
  return out;
}

export function buildTreasure(table) {
  itemNames(table, 'fishing/treasure.json', EXPECTED_TREASURE);
  const out = structuredClone(table);
  const pool = out.pools[0];
  for (const e of pool.entries) if ((e.weight ?? 1) !== 1) fail(`fishing/treasure.json: ${e.name} has weight ${e.weight}, expected 1`);
  pool.entries.push(...structuredClone(EXTRA_TREASURE));
  return out;
}

export default async function ({ vanilla, registry }) {
  const items = registry('item');
  for (const [rel, expected] of [['fishing/fish.json', EXPECTED_FISH], ['fishing/junk.json', EXPECTED_JUNK]]) itemNames(read(vanilla, rel), rel, expected);
  const files = {
    [`${TABLES}/fishing.json`]: buildMain(read(vanilla, 'fishing.json')),
    [`${TABLES}/fishing/treasure.json`]: buildTreasure(read(vanilla, 'fishing/treasure.json'))
  };
  // Loot entries name their item under "name", which the shared check does not look at.
  for (const e of files[`${TABLES}/fishing/treasure.json`].pools[0].entries) {
    if (!items.has(e.name.replace(/^minecraft:/, ''))) throw new Error(`anglers-loot: unknown item ${e.name}`);
  }
  return files;
}
