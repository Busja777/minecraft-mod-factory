// Monster Loot Refresh: eleven common monsters of the regular Mines (floors 1 to 119) sometimes drop
// one or two extra items that fit the monster and its floor: a little of the floor's own ore, its
// geode, clay from the diggers, a cave carrot from the grubs, coal from the dust sprites. Every
// vanilla drop stays exactly as it is; the pack only adds. Skull Cavern monsters, rare drops and a
// config option are planned for later updates.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Monsters is a dictionary "<monster ID>": "<slash-delimited string>" in 1.6. Field 6 is
//   "objects to drop": "a list of object ID numbers, each followed by the probability of that object
//   being chosen. Multiple objects can be chosen from the list."
//   https://stardewvalleywiki.com/Modding:Monster_data (revision 186331, "Format", "Raw data").
//   The raw data printed there is "as of 1.5.1". The 1.6 migration guide lists one change to this
//   asset, the display name "Dust Spirit" → "Dust Sprite" (field 14, the key stays "Dust Spirit")
//   https://stardewvalleywiki.com/Modding:Migrate_to_Stardew_Valley_1.6 (revision 186484, table of
//   changed data assets: Data/Monsters, Content Patcher packs "mostly unaffected"). The new data
//   model with qualified IDs only comes with 1.7 (Modding:Migrate to Stardew Valley 1.7, revision
//   195506: "The former monster.objectsToDrop field (a list of string object IDs) has been
//   replaced"; "The former 'resource IDs' (formatted as negative numbers like -4) are no longer
//   supported"), so in 1.6 the drop list holds unqualified object IDs like "378", exactly as the
//   vanilla strings do. This pack writes them the same way ("<id> <chance>", chance in the vanilla
//   style ".1").
// - The keys are the monster IDs of the same page ("Monster IDs"); Frost Jelly and Sludge are the
//   entries of the blue and red slimes and Dust Spirit the one of the Dust Sprite. Which entry feeds
//   which monster is checked below: for every monster the vanilla string's drops (1.5.1) must give
//   exactly the drop list of the 1.6 monster page (VANILLA, page revision per monster). That also
//   shows these drop lists did not change in 1.6. Drops the page lists that are not in the string
//   (slime eggs, mahogany seeds, Squire's Helmet, the Bait And Bobber book) come from the game code
//   ("Extra drop items in the game code supplement this list", Modding:Monster data); they are named
//   in CODE_DROPS and not touched.
// - Content Patcher: EditData "TextOperations", operation "Append" with Target
//   ["Fields", "<entry key>", "6"] and Delimiter " " (author-guide/action-editdata.md, commit
//   0599744: "To change a field, use the format ["Fields", "entry key", "field key"]"; "The key for
//   each field is the field index (starting at zero) for a slash-delimited string"; and
//   author-guide/text-operations.md, commit e3c091a: Append "adds text at the end of the current
//   field", the delimiter goes between old and new text). So only field 6 grows by a few
//   "<id> <chance>" pairs; the vanilla string is never copied or replaced, other fields and other
//   mods' edits stay as they are. Replacing whole entries ("Entries") would need the exact 1.6
//   string of every monster, which the wiki only prints for 1.5.1; replacing field 6 ("Fields")
//   would need the exact vanilla drop list. Append needs neither and is the documented way to add
//   to a delimited list without removing other values (text-operations.md, "Example").
// - One patch per monster, so a monster that another mod removed only fails its own patch
//   ("If the entry doesn't exist, the operation will fail with an error message").
//
// Scope: the edit belongs to the monster ID, not to the Mines. The same IDs also appear elsewhere
// (Monsters page, revision 191503: Green Slime and Frost Jelly on the farm and in the Secret Woods,
// Sludge on the farm and as the purple slime of the Skull Cavern), and the extra drops come along
// there. All of them are small and fit those places too.
//
// Choices (BALANCE below enforces them):
// - Ores and geodes only on the floors where the Mines have them (https://stardewvalleywiki.com/The_Mines,
//   revision 195228: floors 1-39 copper ore and geodes, from 40 iron ore and frozen geodes, from 80
//   gold ore and magma geodes). Slimes take on the ore of their floor (green: copper, blue: iron,
//   red: gold), like the copper and iron slimes of the Quarry Mine.
// - No bars, gems, rings or other valuables: nothing sells for more than 150g (sell prices from
//   each item page, PRICES), and no extra drop is worth more than 6g per kill on average
//   (chance × sell price). Every chance is at most 30 %.
// - Only items the monster does not drop in vanilla, so no vanilla chance changes.
//
// Item IDs: tools/stardew/data/items.json (wiki Modding:Objects/Object sprites, revision 183077).
// The vanilla string's 114 is the Ancient Seed artifact, which that list leaves out because its
// sprite has no name there ("Springobjects114.png <!--Ancient Seed without shadow-->", same
// revision); https://stardewvalleywiki.com/Ancient_Seed (revision 195149) lists it as a 0.5 % drop
// of Bug, Cave Fly and Grub, as the string has it.

const MONSTER_DATA = 'https://stardewvalleywiki.com/Modding:Monster_data (revision 186331, raw data as of 1.5.1)';
const MINES = { page: 'The Mines', revid: 195228 };

// Sell prices of the added items (infobox "sellprice" of each wiki page): name → [gold, revision].
export const PRICES = {
  'Copper Ore': [5, 193144],
  'Iron Ore': [10, 193196],
  'Gold Ore': [25, 193181],
  Coal: [15, 193153],
  Stone: [2, 192695],
  Clay: [20, 192470],
  'Cave Carrot': [25, 193304],
  Geode: [50, 190877],
  'Frozen Geode': [100, 190881],
  'Magma Geode': [150, 185672]
};

// Ores and geodes by floor band (The Mines, see above). Other added items (stone, clay, coal, cave
// carrot) are not tied to a band.
export const BAND_ITEMS = {
  early: ['Copper Ore', 'Geode'],
  middle: ['Iron Ore', 'Frozen Geode'],
  deep: ['Gold Ore', 'Magma Geode']
};
const BAND_OF = { early: [1, 39], middle: [41, 79], deep: [81, 119] };

// IDs outside items.json that appear in the vanilla strings (see the header).
const EXTRA_IDS = { 114: 'Ancient Seed', '-4': 'Coal' };

// Per monster ID (key of Data/Monsters):
//   page, revid: the wiki page with its drop list ("Infobox monster" drops or the variation table)
//   floors:      where it lives in the regular Mines (same page)
//   raw:         field 6 of the vanilla string (Modding:Monster data)
//   drops:       the page's drops as [name, percent]; a two-roll item as [name, { two, one, none }]
//                (the page's footnote for 1-2 Bat Wings)
//   add:         the extra drops of this pack as [name, chance]
export const VANILLA = {
  'Green Slime': {
    page: 'Slimes', revid: 195407, floors: [1, 29], band: 'early',
    raw: '766 .75 766 .05 153 .1 66 .015 92 .15 96 .005 99 .001',
    drops: [['Amethyst', 1.5], ['Dwarf Scroll I', 0.5], ['Dwarf Scroll IV', 0.1], ['Green Algae', 10], ['Sap', 15], ['Slime', 75], ['Slime', 5]],
    add: [['Copper Ore', 0.1]]
  },
  'Rock Crab': {
    page: 'Rock Crab', revid: 194172, floors: [1, 29], band: 'early',
    raw: '717 .15 286 .4 96 .005 99 .001',
    drops: [['Cherry Bomb', 40], ['Crab', 15], ['Dwarf Scroll I', 0.5], ['Dwarf Scroll IV', 0.1]],
    add: [['Stone', 0.3], ['Copper Ore', 0.1]]
  },
  Duggy: {
    page: 'Duggy', revid: 193043, floors: [2, 29], band: 'early',
    raw: '286 .25 535 .25 280 .03 105 .02 86 .1 72 .01 96 .005 99 .001',
    drops: [['Cherry Bomb', 25], ['Chewing Stick', 2], ['Diamond', 1], ['Dwarf Scroll I', 0.5], ['Dwarf Scroll IV', 0.1], ['Earth Crystal', 10], ['Geode', 25], ['Yam', 3]],
    add: [['Clay', 0.15]]
  },
  Grub: {
    page: 'Grub', revid: 190256, floors: [15, 29], band: 'early',
    raw: '684 .6 273 .05 273 .05 157 .02 114 .005 96 .005 99 .001',
    drops: [['Ancient Seed', 0.5], ['Bug Meat', 60], ['Dwarf Scroll I', 0.5], ['Dwarf Scroll IV', 0.1], ['White Algae', 2], ['Rice Shoot', 5], ['Rice Shoot', 5]],
    add: [['Cave Carrot', 0.05]]
  },
  'Stone Golem': {
    page: 'Stone Golem', revid: 195559, floors: [31, 39], band: 'early',
    raw: '390 .9 80 .1 382 .1 380 .1 96 .005 99 .001',
    drops: [['Coal', 10], ['Dwarf Scroll I', 0.5], ['Dwarf Scroll IV', 0.1], ['Iron Ore', 10], ['Quartz', 10], ['Stone', 90]],
    add: [['Geode', 0.08]]
  },
  'Frost Jelly': {
    page: 'Slimes', revid: 195407, floors: [41, 79], band: 'middle',
    raw: '766 .75 412 .08 70 .02 98 .015 92 .5 97 .005 99 .001',
    drops: [['Dwarf Scroll II', 0.5], ['Dwarf Scroll III', 1.5], ['Dwarf Scroll IV', 0.1], ['Jade', 2], ['Sap', 50], ['Slime', 75], ['Winter Root', 8]],
    add: [['Iron Ore', 0.1]]
  },
  'Frost Bat': {
    page: 'Bats', revid: 195250, floors: [41, 79], band: 'middle',
    raw: '767 .9 767 .55 108 .001 287 .02 97 .005 99 .001',
    drops: [['Bat Wing', { two: 49, one: 46, none: 5 }], ['Bomb', 2], ['Dwarf Scroll II', 0.5], ['Dwarf Scroll IV', 0.1], ['Rare Disc', 0.1]],
    add: [['Frozen Geode', 0.04]]
  },
  'Dust Spirit': {
    page: 'Dust Sprite', revid: 185427, floors: [41, 79], band: 'middle',
    raw: '382 .5 433 .01 336 .001 84 .02 414 .02 97 .005 99 .001',
    drops: [['Coal', 50], ['Coffee Bean', 1], ['Crystal Fruit', 2], ['Dwarf Scroll II', 0.5], ['Dwarf Scroll IV', 0.1], ['Frozen Tear', 2], ['Gold Bar', 0.1]],
    add: [['Iron Ore', 0.1]]
  },
  Sludge: {
    page: 'Slimes', revid: 195407, floors: [81, 119], band: 'deep',
    raw: '766 .8 157 .1 -4 .1 72 .01 92 .5 98 .005 99 .001',
    drops: [['Coal', 10], ['Diamond', 1], ['Dwarf Scroll III', 0.5], ['Dwarf Scroll IV', 0.1], ['Sap', 50], ['Slime', 80], ['White Algae', 10]],
    add: [['Gold Ore', 0.1]]
  },
  'Metal Head': {
    page: 'Metal Head', revid: 190640, floors: [80, 119], band: 'deep',
    raw: '768 .65 378 .1 378 .1 380 .1 380 .1 382 .1 98 .005 99 .001',
    drops: [['Coal', 10], ['Copper Ore', 10], ['Copper Ore', 10], ['Dwarf Scroll III', 0.5], ['Dwarf Scroll IV', 0.1], ['Iron Ore', 10], ['Iron Ore', 10], ['Solar Essence', 65]],
    add: [['Gold Ore', 0.1]]
  },
  'Lava Crab': {
    page: 'Lava Crab', revid: 190295, floors: [81, 119], band: 'deep',
    raw: '717 .25 287 .4 98 .005 99 .001',
    drops: [['Bomb', 40], ['Crab', 25], ['Dwarf Scroll III', 0.5], ['Dwarf Scroll IV', 0.1]],
    add: [['Magma Geode', 0.03]]
  }
};
// Drops the pages list that the strings do not have (game code), for the record only.
export const CODE_DROPS = {
  'Green Slime': ['Green Slime Egg (only with a Slime Hutch)', 'Mahogany Seed (only in the Secret Woods)'],
  Grub: ['Bait And Bobber (book)'],
  'Frost Jelly': ['Blue Slime Egg (only with a Slime Hutch)', 'Mahogany Seed (only in the Secret Woods)'],
  Sludge: ['Red Slime Egg (only with a Slime Hutch)', 'colour based drops'],
  'Metal Head': ["Squire's Helmet"]
};

export const BALANCE = { maxPrice: 150, maxChance: 0.3, maxGoldPerKill: 6 };

// ".1" like the vanilla strings
export const chanceText = c => {
  if (!(c > 0 && c < 1)) throw new Error(`chance ${c} out of range`);
  return String(Number(c.toFixed(4))).replace(/^0\./, '.');
};

// "766 .75 766 .05" → [['766', 0.75], ['766', 0.05]]
export const pairs = raw => {
  const parts = raw.trim().split(/\s+/);
  if (parts.length % 2) throw new Error(`"${raw}" is not a list of <id> <chance> pairs`);
  const out = [];
  for (let i = 0; i < parts.length; i += 2) out.push([parts[i], Number(parts[i + 1])]);
  return out;
};

// average gold of one monster's extra drops per kill
export const goldPerKill = add => add.reduce((sum, [name, chance]) => sum + chance * PRICES[name][0], 0);

export default async function ({ items }) {
  const nameOf = id => items.items[`(O)${id}`] ?? EXTRA_IDS[id];
  const ids = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)\d+$/.test(id)) (ids[name] ||= []).push(id.slice(3));
  const idOf = name => {
    if (ids[name]?.length !== 1) throw new Error(`${name}: ${ids[name] ? `several IDs (${ids[name].join(', ')})` : 'not in items.json'}`);
    return ids[name][0];
  };

  const changes = [];
  for (const [key, m] of Object.entries(VANILLA)) {
    // 1. the vanilla string gives exactly the page's drops (which entry is which monster, unchanged in 1.6)
    const raw = pairs(m.raw).map(([id, chance]) => {
      const name = nameOf(id);
      if (!name) throw new Error(`${key}: vanilla ID ${id} is unknown`);
      return [name, chance];
    });
    const single = [];
    const fromRaw = [];
    for (const [name, doc] of m.drops) {
      if (typeof doc === 'number') { single.push(`${name} ${doc}`); continue; }
      const rolls = raw.filter(([n]) => n === name).map(([, c]) => c);
      if (rolls.length !== 2) throw new Error(`${key}: ${name} should be two rolls in ${MONSTER_DATA}`);
      const [a, b] = rolls;
      const got = { two: a * b, one: a * (1 - b) + (1 - a) * b, none: (1 - a) * (1 - b) };
      for (const k of ['two', 'one', 'none']) if (Math.abs(100 * got[k] - doc[k]) > 0.5 + 1e-9) throw new Error(`${key}: ${name} ${k} is ${(100 * got[k]).toFixed(1)} %, the ${m.page} page says ${doc[k]} %`);
      fromRaw.push(name);
    }
    const rawSingle = raw.filter(([n]) => !fromRaw.includes(n)).map(([n, c]) => `${n} ${Number((100 * c).toFixed(4))}`);
    if (rawSingle.sort().join('|') !== single.sort().join('|')) throw new Error(`${key}: ${MONSTER_DATA} gives ${rawSingle.join(', ')}, the ${m.page} page (revision ${m.revid}) says ${single.join(', ')}`);

    // 2. the extra drops are fair and fit the floor
    if (!m.add.length || m.add.length > 2) throw new Error(`${key}: one or two extra drops`);
    const [lo, hi] = BAND_OF[m.band];
    if (m.floors[0] < lo - 1 || m.floors[1] > hi) throw new Error(`${key}: floors ${m.floors.join('-')} are not in the ${m.band} band`);
    for (const [name, chance] of m.add) {
      if (!PRICES[name]) throw new Error(`${key}: no documented sell price for ${name}`);
      if (PRICES[name][0] > BALANCE.maxPrice) throw new Error(`${key}: ${name} is too valuable`);
      if (!(chance > 0 && chance <= BALANCE.maxChance)) throw new Error(`${key}: ${name} chance ${chance}`);
      if (raw.some(([n]) => n === name)) throw new Error(`${key}: ${name} is a vanilla drop already; this pack only adds new ones`);
      const band = Object.entries(BAND_ITEMS).find(([, list]) => list.includes(name))?.[0];
      if (band && band !== m.band) throw new Error(`${key}: ${name} belongs to the ${band} floors of ${MINES.page}, not ${m.band}`);
    }
    if (goldPerKill(m.add) > BALANCE.maxGoldPerKill + 1e-9) throw new Error(`${key}: extra drops worth ${goldPerKill(m.add)}g per kill`);

    changes.push({
      LogName: `Extra drops: ${key}`,
      Action: 'EditData',
      Target: 'Data/Monsters',
      TextOperations: [{
        Operation: 'Append',
        Target: ['Fields', key, '6'],
        Value: m.add.map(([name, chance]) => `${idOf(name)} ${chanceText(chance)}`).join(' '),
        Delimiter: ' '
      }]
    });
  }
  return { 'content.json': { Format: '2.9.0', Changes: changes } };
}
