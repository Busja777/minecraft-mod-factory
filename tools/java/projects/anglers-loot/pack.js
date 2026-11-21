// Anglers Loot: fishing gives less junk and more treasure. The vanilla fishing loot tables of the
// cache are read and only weights and entries are changed, so every condition stays vanilla
// (open water for treasure, the jungle-only bamboo, Luck of the Sea through the "quality" values).
// The build stops if a vanilla table is not shaped as this file expects.
//
// Only the tables that change are overridden: gameplay/fishing (junk/treasure/fish weights),
// gameplay/fishing/treasure (two extra catches) and, since 1.2, gameplay/fishing/fish (biome
// catches). junk.json stays vanilla; it is still read and checked, because the main table points
// to it and its jungle bamboo is the model for the biome rule.
//
// Chances per cast in open water without Luck of the Sea (weight / sum of weights):
//   vanilla  junk 10/100 = 10 %,  treasure 5/100 = 5 %,  fish 85/100 = 85 %
//   pack     junk  5/98  ≈ 5.1 %, treasure 8/98  ≈ 8.2 %, fish 85/98  ≈ 86.7 %
// The biome catches only change which fish the fish share brings (BIOME_FISH below); the three
// shares above stay the same everywhere.
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

// Biome catches (1.2): an extra entry of the fish table that only counts where the hook is in one of
// the biomes, written as vanilla writes the jungle-only bamboo of the junk table (location_check).
// The vanilla fish weights stay (cod 60, salmon 25, tropical fish 2, pufferfish 13 = 100); in such a
// biome the extra weight is added, so the fish table there sums to 125:
//   warm oceans, jungles, mangrove swamp   tropical fish  2 → 25 of 125 = 20 %  (vanilla 2 %)
//   frozen rivers and oceans, taigas       salmon        25 → 50 of 125 = 40 %  (vanilla 25 %)
//   cold oceans                            cod           60 → 85 of 125 = 68 %  (vanilla 60 %)
// The other fish keep their weight, so they become a little rarer there (each × 100/125).
export const BIOME_FISH = [
  { item: 'tropical_fish', weight: 23, biomes: ['warm_ocean', 'lukewarm_ocean', 'deep_lukewarm_ocean', 'jungle', 'sparse_jungle', 'bamboo_jungle', 'mangrove_swamp'] },
  { item: 'salmon', weight: 25, biomes: ['frozen_river', 'frozen_ocean', 'deep_frozen_ocean', 'taiga', 'snowy_taiga', 'old_growth_pine_taiga', 'old_growth_spruce_taiga'] },
  { item: 'cod', weight: 25, biomes: ['cold_ocean', 'deep_cold_ocean'] }
];

// The two ways a loot table is written, each copied from that version's own vanilla tables.
//   condition / modifier  the key under which a table, pool or entry carries its conditions / item functions
//   openWater             what the treasure entry of gameplay/fishing must carry, exactly
//   setCount              "from … to of the item", as vanilla writes it (chests/pillager_outpost)
//   inBiomes              "only where the hook is in these biomes", as the bamboo of fishing/junk writes it
// The game ignores keys it does not know: a table in the wrong spelling loads without an error and
// loses its conditions (treasure everywhere), so the spelling is never guessed.
export const SPELLINGS = {
  // Minecraft 1.21.1 (data pack format 48): lists, each element names itself under "condition" / "function".
  lists: {
    condition: 'conditions',
    modifier: 'functions',
    openWater: [{ condition: 'minecraft:entity_properties', entity: 'this', predicate: { type_specific: { type: 'minecraft:fishing_hook', in_open_water: true } } }],
    setCount: (min, max) => [{ add: false, count: { type: 'minecraft:uniform', max, min }, function: 'minecraft:set_count' }],
    inBiomes: biomes => [{ condition: 'minecraft:location_check', predicate: { biomes: biomes.map(b => `minecraft:${b}`) } }]
  },
  // Minecraft 26.3 (data pack format 121): one "condition" and one "modifier", each names itself under
  // "type"; the hook check is its own predicate key. set_count without "add" sets the count (default false).
  single: {
    condition: 'condition',
    modifier: 'modifier',
    openWater: { type: 'minecraft:entity_properties', entity: 'this', predicate: { 'minecraft:type_specific/fishing_hook': { in_open_water: true } } },
    setCount: (min, max) => ({ type: 'minecraft:set_count', count: { type: 'minecraft:uniform', max, min } }),
    inBiomes: biomes => ({ type: 'minecraft:location_check', predicate: { biomes: biomes.map(b => `minecraft:${b}`) } })
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
const EXPECTED_FISH_WEIGHTS = { cod: 60, salmon: 25, tropical_fish: 2, pufferfish: 13 };
const JUNGLES = ['jungle', 'sparse_jungle', 'bamboo_jungle'];
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

// The biome rule must be written exactly as this version's vanilla junk table limits bamboo to jungles.
export function checkBiomeRule(junk, spelling) {
  const bamboo = onePool(junk, 'fishing/junk.json').entries.find(e => e.name === 'minecraft:bamboo');
  if (!bamboo || !same(bamboo[spelling.condition], spelling.inBiomes(JUNGLES))) fail(`fishing/junk.json: the jungle rule of bamboo is not written as expected (${JSON.stringify(bamboo?.[spelling.condition])})`);
}

// The vanilla fish stay as they are; each biome catch is one more entry, only valid in its biomes.
export function buildFish(table, spelling = spellingOf({ table })) {
  itemNames(table, 'fishing/fish.json', EXPECTED_FISH);
  const out = structuredClone(table);
  const pool = out.pools[0];
  for (const e of pool.entries) {
    const item = e.name.replace(/^minecraft:/, '');
    if (e.weight !== EXPECTED_FISH_WEIGHTS[item]) fail(`fishing/fish.json: ${e.name} has weight ${e.weight}, expected ${EXPECTED_FISH_WEIGHTS[item]}`);
    // No condition, no quality, no function: the fish are the same everywhere in vanilla.
    onlyKeys(e, ['type', 'name', 'weight'], `fishing/fish.json: ${e.name}`);
  }
  for (const { item, weight, biomes } of BIOME_FISH) {
    if (!EXPECTED_FISH.includes(item)) fail(`fishing/fish.json: ${item} is not a vanilla fish catch`);
    pool.entries.push({ type: 'minecraft:item', [spelling.condition]: spelling.inBiomes(biomes), name: `minecraft:${item}`, weight });
  }
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
  const junk = read(vanilla, 'fishing/junk.json');
  itemNames(junk, 'fishing/junk.json', EXPECTED_JUNK);
  const main = read(vanilla, 'fishing.json');
  const treasure = read(vanilla, 'fishing/treasure.json');
  const fish = read(vanilla, 'fishing/fish.json');
  const spelling = spellingOf({ main, treasure, junk });
  checkBiomeRule(junk, spelling);
  // Biomes are not in the registry report; every biome of the game has its own file in vanilla's data.
  for (const b of new Set(BIOME_FISH.flatMap(f => f.biomes))) {
    if (!fs.existsSync(path.join(vanilla.data, 'minecraft', 'worldgen', 'biome', `${b}.json`))) throw new Error(`anglers-loot: unknown biome minecraft:${b}`);
  }
  const files = {
    [`${TABLES}/fishing.json`]: buildMain(main, spelling),
    [`${TABLES}/fishing/treasure.json`]: buildTreasure(treasure, spelling),
    [`${TABLES}/fishing/fish.json`]: buildFish(fish, spelling)
  };
  // Loot entries name their item under "name", which the shared check does not look at.
  for (const rel of ['fishing/treasure.json', 'fishing/fish.json']) {
    for (const e of files[`${TABLES}/${rel}`].pools[0].entries) {
      if (!items.has(e.name.replace(/^minecraft:/, ''))) throw new Error(`anglers-loot: unknown item ${e.name}`);
    }
  }
  for (const [file, table] of Object.entries(files)) {
    const wrong = keysIn(table).filter(k => FOREIGN.get(spelling).includes(k));
    if (wrong.length) throw new Error(`anglers-loot: ${file} mixes two loot table spellings (${[...new Set(wrong)].join(', ')})`);
  }
  return files;
}
