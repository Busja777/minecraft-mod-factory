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
//
// The generator is called once per Minecraft version and starts from that version's own tables.
// Checked by hand against 1.21.1 and 26.3: items, weights and qualities of all four tables are the
// same in both, so the numbers above hold for both. Only the spelling of a table differs (SPELLINGS).
import fs from 'fs';
import path from 'path';

// Weights of the three sub tables in gameplay/fishing. Vanilla: junk 10, treasure 5, fish 85.
export const WEIGHTS = { junk: 5, treasure: 8, fish: 85 };

// New catches of the treasure table: item, weight inside the table, how many at a time (from, to).
export const EXTRA_TREASURE = [
  { item: 'heart_of_the_sea', weight: 1 },
  { item: 'experience_bottle', weight: 3, count: [1, 3] }
];

// The two ways a loot table is written, each copied from that version's own vanilla tables.
//   condition / modifier  the key under which a table, pool or entry carries its conditions / item functions
//   openWater             what the treasure entry of gameplay/fishing must carry, exactly
//   setCount              "from … to of the item", as vanilla writes it (chests/pillager_outpost)
// The game ignores keys it does not know: a table in the wrong spelling loads without an error and
// loses its conditions (treasure everywhere), so the spelling is never guessed.
export const SPELLINGS = {
  // Minecraft 1.21.1 (data pack format 48): lists, each element names itself under "condition" / "function".
  lists: {
    condition: 'conditions',
    modifier: 'functions',
    openWater: [{ condition: 'minecraft:entity_properties', entity: 'this', predicate: { type_specific: { type: 'minecraft:fishing_hook', in_open_water: true } } }],
    setCount: (min, max) => [{ add: false, count: { type: 'minecraft:uniform', max, min }, function: 'minecraft:set_count' }]
  },
  // Minecraft 26.3 (data pack format 121): one "condition" and one "modifier", each names itself under
  // "type"; the hook check is its own predicate key. set_count without "add" sets the count (default false).
  single: {
    condition: 'condition',
    modifier: 'modifier',
    openWater: { type: 'minecraft:entity_properties', entity: 'this', predicate: { 'minecraft:type_specific/fishing_hook': { in_open_water: true } } },
    setCount: (min, max) => ({ type: 'minecraft:set_count', count: { type: 'minecraft:uniform', max, min } })
  }
};

// What the vanilla tables must look like before anything is changed (the same for 1.21.1 and 26.3).
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

// Nothing but the known keys: a new key could be a rule this file does not know about.
function onlyKeys(object, allowed, where) {
  const extra = Object.keys(object).filter(k => !allowed.includes(k));
  if (extra.length) fail(`${where}: unexpected "${extra.join('", "')}"`);
}

// The same JSON value, whatever the order of the keys.
const sorted = v => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

// The single pool of a fishing table, after checking its shape.
function onePool(table, rel) {
  if (table.type !== 'minecraft:fishing') fail(`${rel}: type is ${table.type}, expected minecraft:fishing`);
  onlyKeys(table, ['type', 'pools', 'random_sequence'], rel);
  if (!Array.isArray(table.pools) || table.pools.length !== 1) fail(`${rel}: expected exactly one pool`);
  const pool = table.pools[0];
  onlyKeys(pool, ['entries', 'rolls', 'bonus_rolls'], `${rel}: pool`);
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

// How this version writes its loot tables, read from the entries of the given vanilla tables.
export function spellingOf(tables) {
  const keys = new Set(Object.values(tables).flatMap(t => (t.pools || []).flatMap(p => (p.entries || []).flatMap(e => Object.keys(e)))));
  const found = Object.keys(SPELLINGS).filter(name => keys.has(SPELLINGS[name].condition) || keys.has(SPELLINGS[name].modifier));
  if (found.length !== 1) fail(`fishing tables: ${found.length ? 'two spellings of conditions and functions at once' : 'no condition and no function in a known spelling'}`);
  return SPELLINGS[found[0]];
}

export function buildMain(table, spelling = spellingOf({ table })) {
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
  // Treasure only in open water, written exactly as this version's vanilla table writes it, and no
  // other rule on any of the three entries.
  const treasure = entries.find(e => e.value.endsWith('/treasure'));
  if (!(spelling.condition in treasure)) fail('fishing.json: treasure is not limited to open water any more');
  if (!same(treasure[spelling.condition], spelling.openWater)) fail(`fishing.json: the open water rule of treasure changed (${JSON.stringify(treasure[spelling.condition])})`);
  for (const entry of entries) onlyKeys(entry, ['type', 'value', 'weight', 'quality', ...(entry === treasure ? [spelling.condition] : [])], `fishing.json: ${entry.value}`);
  return out;
}

// One new catch as an item entry, keys in the order vanilla writes them.
function extraEntry({ item, weight, count }, spelling) {
  return { type: 'minecraft:item', ...(count ? { [spelling.modifier]: spelling.setCount(...count) } : {}), name: `minecraft:${item}`, weight };
}

export function buildTreasure(table, spelling = spellingOf({ table })) {
  itemNames(table, 'fishing/treasure.json', EXPECTED_TREASURE);
  const out = structuredClone(table);
  const pool = out.pools[0];
  for (const e of pool.entries) {
    if ((e.weight ?? 1) !== 1) fail(`fishing/treasure.json: ${e.name} has weight ${e.weight}, expected 1`);
    // No condition and no quality: every treasure is equally likely, everywhere treasure is caught.
    onlyKeys(e, ['type', 'name', 'weight', spelling.modifier], `fishing/treasure.json: ${e.name}`);
  }
  pool.entries.push(...EXTRA_TREASURE.map(e => extraEntry(e, spelling)));
  return out;
}

// Every key of a JSON value, at any depth, with the type of its value.
function keysIn(value, found = []) {
  if (Array.isArray(value)) value.forEach(v => keysIn(v, found));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { found.push(`${k}:${typeof v}`); keysIn(v, found); }
  return found;
}
// Keys that only the other spelling has; the game would skip them without a word.
const FOREIGN = new Map([
  [SPELLINGS.lists, ['modifier:object', 'condition:object']],
  [SPELLINGS.single, ['conditions:object', 'functions:object', 'condition:string', 'function:string']]
]);

export default async function ({ vanilla, registry }) {
  const items = registry('item');
  for (const [rel, expected] of [['fishing/fish.json', EXPECTED_FISH], ['fishing/junk.json', EXPECTED_JUNK]]) itemNames(read(vanilla, rel), rel, expected);
  const main = read(vanilla, 'fishing.json');
  const treasure = read(vanilla, 'fishing/treasure.json');
  const spelling = spellingOf({ main, treasure });
  const files = {
    [`${TABLES}/fishing.json`]: buildMain(main, spelling),
    [`${TABLES}/fishing/treasure.json`]: buildTreasure(treasure, spelling)
  };
  // Loot entries name their item under "name", which the shared check does not look at.
  for (const e of files[`${TABLES}/fishing/treasure.json`].pools[0].entries) {
    if (!items.has(e.name.replace(/^minecraft:/, ''))) throw new Error(`anglers-loot: unknown item ${e.name}`);
  }
  for (const [file, table] of Object.entries(files)) {
    const wrong = keysIn(table).filter(k => FOREIGN.get(spelling).includes(k));
    if (wrong.length) throw new Error(`anglers-loot: ${file} mixes two loot table spellings (${[...new Set(wrong)].join(', ')})`);
  }
  return files;
}
