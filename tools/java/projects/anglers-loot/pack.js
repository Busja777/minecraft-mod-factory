// Anglers Loot: fishing gives less junk and more treasure. The vanilla fishing loot tables of the
// cache are read and only weights and entries are changed, so every condition stays vanilla
// (open water for treasure, the jungle-only bamboo, Luck of the Sea through the "quality" values).
// The build stops if a vanilla table is not shaped as this file expects.
//
// Only the tables that change are overridden: gameplay/fishing (junk/treasure/fish weights),
// gameplay/fishing/treasure (two extra catches) and, since 1.2, gameplay/fishing/fish (biome
// catches). junk.json stays vanilla; it is still read and checked, because the main table points
// to it and its jungle bamboo is the model for the biome rule.
// Since 1.3 the pack also has its own advancement tab about fishing ("Angler's Logbook" below); it
// only adds advancements and changes nothing about the loot.
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

// ── 1.3: the advancement tab "Angler's Logbook" ───────────────────────────────────────────────
// Own tab instead of a branch under vanilla husbandry: husbandry is already the fullest vanilla tab,
// an own tab keeps all fishing goals on one screen and leaves the vanilla tabs untouched.
// Every catch uses minecraft:fishing_rod_hooked as vanilla husbandry/fishy_business writes it
// ("item" = one of the caught items), plus an "entity" check that the hook itself came back (the
// trigger passes the hooked entity, or the hook when nothing was hooked): reeling in a dropped item
// or a mob never counts, only a real catch. Treasure is matched on the caught item, which includes
// the heart of the sea and the bottles o' enchanting that this pack's treasure table adds.
// Biome catches check where the hook is, the same position the 1.2 biome catches of the fish table
// use (BIOME_FISH). No vanilla fishing advancement is copied: Fishy Business wants any one fish,
// Tactical Fishing a fish bucket; here every fish, the biome fish and the treasures count.
const NS = 'anglers_loot';

// How each version writes an advancement, checked against its own vanilla advancements (checkShape).
//   cond     one loot condition where a trigger takes an entity ("entity", "player", "child" …)
//   entity   the keys of an entity predicate: entity type and location
//   icon     the display icon;  background  the tab background (a block texture)
export const ADV_SHAPES = {
  lists: {
    cond: (type, fields) => [{ condition: `minecraft:${type}`, ...fields }],
    entityKeys: { type: 'type', location: 'location' },
    icon: item => ({ count: 1, id: `minecraft:${item}` }),
    background: name => `minecraft:textures/${name}.png`
  },
  single: {
    cond: (type, fields) => ({ type: `minecraft:${type}`, ...fields }),
    entityKeys: { type: 'minecraft:entity_type', location: 'minecraft:location' },
    icon: item => ({ id: `minecraft:${item}` }),
    background: name => `minecraft:${name}`
  }
};
const entityIs = (shape, { type, biomes }) => shape.cond('entity_properties', {
  entity: 'this',
  predicate: {
    ...(type ? { [shape.entityKeys.type]: `minecraft:${type}` } : {}),
    ...(biomes ? { [shape.entityKeys.location]: { biomes: Array.isArray(biomes) ? biomes.map(b => `minecraft:${b}`) : `minecraft:${biomes}` } } : {})
  }
});
const itemsOf = list => (list.length === 1 ? `minecraft:${list[0]}` : list.map(i => `minecraft:${i}`));

// A catch: the hook came back with one of the items (in one of the biomes, if given).
export const caught = (shape, items, biomes) => ({
  trigger: 'minecraft:fishing_rod_hooked',
  conditions: { entity: entityIs(shape, { type: 'fishing_bobber', biomes }), item: { items: itemsOf(items) } }
});

// The vanilla advancements whose spelling the shapes copy; the build stops if one differs.
export function checkShape(vanilla, shape) {
  const adv = rel => {
    const file = path.join(vanilla.data, 'minecraft', 'advancement', `${rel}.json`);
    if (!fs.existsSync(file)) fail(`advancement ${rel} is missing`);
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  };
  const fishy = adv('husbandry/fishy_business');
  if (!same(fishy.criteria.cod, { trigger: 'minecraft:fishing_rod_hooked', conditions: { item: { items: 'minecraft:cod' } } })) fail(`husbandry/fishy_business: the cod criterion changed (${JSON.stringify(fishy.criteria.cod)})`);
  if (!same(fishy.display.icon, shape.icon('fishing_rod'))) fail(`husbandry/fishy_business: icon is written as ${JSON.stringify(fishy.display.icon)}`);
  const bred = adv('husbandry/bred_all_animals').criteria['minecraft:horse'];
  if (!same(bred?.conditions?.child, entityIs(shape, { type: 'horse' }))) fail(`husbandry/bred_all_animals: entity type is written as ${JSON.stringify(bred?.conditions?.child)}`);
  const time = adv('adventure/adventuring_time').criteria['minecraft:badlands'];
  if (!same(time?.conditions?.player, entityIs(shape, { biomes: 'badlands' }))) fail(`adventure/adventuring_time: the biome check is written as ${JSON.stringify(time?.conditions?.player)}`);
  const root = adv('husbandry/root');
  if (root.display.background !== shape.background('gui/advancements/backgrounds/husbandry')) fail(`husbandry/root: background is written as ${root.display.background}`);
}

// What can come up as treasure (the item the player gets): every entry of the built treasure table,
// the book as the enchanted book it becomes. The fishing rod is left out, junk has one too.
export function treasureCatches(treasure, junk, fish) {
  const elsewhere = new Set([junk, fish].flatMap(t => t.pools[0].entries.map(e => e.name)));
  const out = [];
  for (const e of treasure.pools[0].entries) {
    const item = e.name.replace(/^minecraft:/, '');
    if (elsewhere.has(e.name)) continue;
    if (item === 'book') {
      if (!JSON.stringify(e).includes('minecraft:enchant_with_levels')) fail('fishing/treasure.json: the book is not enchanted any more');
      out.push('enchanted_book');
    } else out.push(item);
  }
  return out;
}

// Titles of the biome groups of BIOME_FISH, in the same order.
const BIOME_ADV = [
  ['warm', 'Tropical Waters', 'Catch a tropical fish in a warm ocean, a jungle or a mangrove swamp'],
  ['frozen', 'Ice Fishing', 'Catch a salmon in a frozen river, a frozen ocean or a taiga'],
  ['cold', 'Cold Current', 'Catch a cod in a cold ocean']
];
// The fish of the fish table: [item, title, description]
const FISH_ADV = {
  cod: ['Cod Squad', 'Catch a cod with a fishing rod'],
  salmon: ['Upstream', 'Catch a salmon with a fishing rod'],
  tropical_fish: ['Living Rainbow', 'Catch a tropical fish with a fishing rod'],
  pufferfish: ['Handle With Care', 'Catch a pufferfish with a fishing rod']
};
const TREASURE_NAMES = { name_tag: 'a name tag', saddle: 'a saddle', bow: 'a bow', enchanted_book: 'an enchanted book', nautilus_shell: 'a nautilus shell', heart_of_the_sea: 'a heart of the sea', experience_bottle: "a bottle o' enchanting" };
const listing = (names, word = 'and') => `${names.slice(0, -1).join(', ')} ${word} ${names.at(-1)}`;

// Experience rewards: small for goals, larger for challenges. Never items.
export const ADV_REWARDS = {
  'biome/warm': 10, 'biome/frozen': 10, 'biome/cold': 10,
  'treasure/heart_of_the_sea': 30,
  'fish/every_fish': 50,
  'treasure/every_treasure': 100
};

// The tab below its root: { name, parent, icon, title, description, frame, criteria, all }.
export function logbook(shape, treasures) {
  const list = [];
  const add = (name, parent, icon, title, description, criteria, { frame = 'task', all = false } = {}) =>
    list.push({ name, parent, icon, title, description, frame, criteria, all });
  let parent = 'root';
  for (const fish of EXPECTED_FISH) {
    add(`fish/${fish}`, parent, fish, ...FISH_ADV[fish], { [fish]: caught(shape, [fish]) });
    parent = `fish/${fish}`;
  }
  add('fish/every_fish', parent, 'barrel', 'Full Creel', 'Catch a cod, a salmon, a tropical fish and a pufferfish',
    Object.fromEntries(EXPECTED_FISH.map(f => [f, caught(shape, [f])])), { frame: 'challenge', all: true });
  BIOME_FISH.forEach(({ item, biomes }, i) => {
    const [name, title, desc] = BIOME_ADV[i];
    add(`biome/${name}`, `fish/${item}`, item === 'cod' ? 'cod_bucket' : item === 'salmon' ? 'salmon_bucket' : 'tropical_fish_bucket', title, desc,
      { [item]: caught(shape, [item], biomes) }, { frame: 'goal' });
  });
  add('treasure/any', 'root', 'name_tag', 'Lucky Cast', `Fish up a treasure: ${listing(treasures.map(t => TREASURE_NAMES[t]), 'or')}`,
    Object.fromEntries(treasures.map(t => [t, caught(shape, [t])])));
  add('treasure/enchanted_book', 'treasure/any', 'enchanted_book', 'Soggy Spellbook', 'Fish up an enchanted book', { enchanted_book: caught(shape, ['enchanted_book']) });
  add('treasure/experience_bottle', 'treasure/any', 'experience_bottle', 'Message in a Bottle', "Fish up a bottle o' enchanting", { experience_bottle: caught(shape, ['experience_bottle']) });
  add('treasure/heart_of_the_sea', 'treasure/experience_bottle', 'heart_of_the_sea', 'Heart of the Deep', 'Fish up a heart of the sea', { heart_of_the_sea: caught(shape, ['heart_of_the_sea']) }, { frame: 'goal' });
  add('treasure/every_treasure', 'treasure/heart_of_the_sea', 'nautilus_shell', 'Sunken Hoard', `Fish up every treasure: ${listing(treasures.map(t => TREASURE_NAMES[t]))}`,
    Object.fromEntries(treasures.map(t => [t, caught(shape, [t])])), { frame: 'challenge', all: true });
  return list;
}

const requirements = (criteria, all) => (all ? Object.keys(criteria).map(k => [k]) : [Object.keys(criteria)]);

export function buildAdvancements(shape, treasures) {
  const list = logbook(shape, treasures);
  const names = new Set(['root', ...list.map(a => a.name)]);
  if (names.size !== list.length + 1) fail('logbook: an advancement is defined twice');
  for (const a of list) if (!names.has(a.parent)) throw new Error(`anglers-loot: ${a.name}: parent ${a.parent} does not exist`);
  for (const key of Object.keys(ADV_REWARDS)) if (!names.has(key)) throw new Error(`anglers-loot: reward for unknown advancement ${key}`);
  for (const t of treasures) if (!TREASURE_NAMES[t]) throw new Error(`anglers-loot: no name for the treasure ${t}`);
  const files = {};
  const rootCriteria = { fishing_rod: { trigger: 'minecraft:inventory_changed', conditions: { items: [{ items: 'minecraft:fishing_rod' }] } } };
  files[`data/${NS}/advancement/root.json`] = {
    criteria: rootCriteria,
    display: {
      icon: shape.icon('fishing_rod'),
      title: { text: "Angler's Logbook" },
      description: { text: 'Pick up a fishing rod and cast a line' },
      frame: 'task',
      background: shape.background('block/dark_prismarine'),
      show_toast: false,
      announce_to_chat: false
    },
    requirements: requirements(rootCriteria, false)
  };
  for (const a of list) {
    const adv = {
      parent: `${NS}:${a.parent}`,
      criteria: a.criteria,
      display: { icon: shape.icon(a.icon), title: { text: a.title }, description: { text: a.description }, frame: a.frame },
      requirements: requirements(a.criteria, a.all)
    };
    if (ADV_REWARDS[a.name]) adv.rewards = { experience: ADV_REWARDS[a.name] };
    files[`data/${NS}/advancement/${a.name}.json`] = adv;
  }
  return files;
}

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
  // 1.3: the advancements, in the spelling that belongs to this version's loot tables.
  const shape = spelling === SPELLINGS.lists ? ADV_SHAPES.lists : ADV_SHAPES.single;
  checkShape(vanilla, shape);
  const treasures = treasureCatches(files[`${TABLES}/fishing/treasure.json`], junk, files[`${TABLES}/fishing/fish.json`]);
  const advancements = buildAdvancements(shape, treasures);
  if (Object.keys(advancements).length !== 14) throw new Error(`anglers-loot: expected 14 advancement files (root and 13), got ${Object.keys(advancements).length}`);
  return { ...files, ...advancements };
}
