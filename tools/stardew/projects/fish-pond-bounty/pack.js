// Fish Pond Bounty: fish ponds of 30 common fish give their roe more reliably and, in fuller ponds,
// in bigger amounts. One fixed level, no config. Roe is the only produce this pack adds; the few
// other items some of these fish make (solar essence, rainbow shells, prismatic shards, treasure
// chests, bug meat) stay exactly as rare as in vanilla. Legendary fish are not touched.
// 1.0: 23 river and ocean fish whose only vanilla produce is roe. 1.1: 7 more fish (Catfish,
// Sunfish, Rainbow Trout, Spook Fish, Dorado, Lingcod, Pike).
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/FishPondData is a list of entries { Id, RequiredTags, Precedence, SpawnTime,
//   ProducedItems, PopulationGates, MaxPopulation, BaseMinProduceChance, BaseMaxProduceChance,
//   WaterColor } (https://stardewvalleywiki.com/Modding:Fish_ponds, revision 186716).
// - Matching: "The first matching entry based on the Precedence field is used". RequiredTags are
//   context tags the fish must all have. Vanilla uses Precedence 0 for specific fish, 100 for custom
//   groups, 500 for broad fish types, 1000 for the fallback; lower values are checked first
//   (Modding:Fish ponds and Modding:Migrate to Stardew Valley 1.6, "Fish pond changes").
//   This pack adds one entry per fish with RequiredTags ["item_<name>"] (automatic tag from the item
//   name: "trimmed, lowercase, with spaces replaced with underscores, and with single quotes
//   removed", https://stardewvalleywiki.com/Modding:Context_tags, revision 193554) and Precedence
//   -10. So for these fish the pack's entry is found before vanilla's (0); vanilla's entries are not
//   edited or removed and still serve every other fish, and they take over again when the pack is
//   removed.
// - Content Patcher: EditData with Entries keyed by Id adds new list entries (action-editdata.md,
//   "Edit a list"; FishPondData "Use the new Id field to target an entry, and add it when creating a
//   new entry. Required." in the 1.6 migration guide).
// - Because the whole entry is chosen for a fish, the pack's entry also carries everything else
//   vanilla's entry decides, copied from the documented vanilla values:
//   * PopulationGates: "The key is the population number at which this gate applies", the value a
//     list of "<item ID> [min] [max]" quest items (Modding:Fish ponds). The wiki tables list the
//     population at which a quest occurs (3, 5, 7); the gate key is one higher: the documented
//     example "6": ["422 2 3", "60 2", "749 2 3", "116"] is exactly the quest the Fish Pond page
//     lists for population 5 of Super Cucumber, Octopus and Rainbow Trout (checked below for Rainbow
//     Trout). Quest items and amounts from https://stardewvalleywiki.com/Fish_Pond#Quests (revision
//     194160), the same on each fish page ("Fish Pond", "Quests").
//   * SpawnTime: the "Normal Spawn Frequency" column of the same table (days per new fish).
//   * BaseMinProduceChance 0.15 / BaseMaxProduceChance 0.95: the Fish Pond page gives the daily base
//     chance as "(population of pond × 0.08) + 0.15", i.e. 23 % to 95 %, for "all ponds besides
//     Legendary Fish", which is the documented lerp between min and max over the population.
//   * MaxPopulation and WaterColor stay unset: these fish grow to 10 after their last quest and do
//     not tint the water (Fish Pond page, "Notes": only legendary fish, Lava Eel, Super Cucumber,
//     Slimejack and Void Salmon change the water colour).
// - ProducedItems: "it checks each entry in the list and takes the first one that matches", each
//   with RequiredPopulation, Chance ("applied after the base chance") and the item spawn fields
//   MinStack/MaxStack (https://stardewvalleywiki.com/Modding:Item_queries#Item_spawn_fields: random
//   value between them, inclusive). ItemId "(O)812" = roe "for the current fish".
//
// Vanilla produce (Fish Pond page, "Produce"; per population on each fish page, "Fish Pond"):
//   river fish (Bream … Walleye, Bullhead, Largemouth Bass, Goby) 1 roe at 90 % of the base chance,
//   ocean fish (Albacore … Tuna) 1 roe at 70 % to 100 %, Carp, Herring and Catfish 1 roe at 100 %,
//   Sunfish 1 roe at 90 %. Five of the 1.1 fish also make one rare item at population 9 or 10.
// This pack, for every fish: first the rare vanilla items (EXTRAS, same population, chance and
// amount as vanilla, checked first like in vanilla), then roe: population 7+: 2–3 roe at 40 %, else
// population 4+: 1–2 roe at 40 %, else 1 roe (100 %). So the rare items keep exactly their vanilla
// daily chance, and at every population the roe is at least the vanilla roe.
//
// The raw vanilla ProducedItems are not published; the wiki gives the share of each item per
// population ("% of Items", "The first entry that is valid for the current population and passes
// its random chance check is the produced item ... The raw entries have been processed and summed").
// EXTRAS is the simplest list that reproduces those shares: DOCUMENTED holds the wiki shares, and
// the build recomputes them from EXTRAS plus the vanilla roe chance and fails if any differs by
// more than the wiki's rounding. Fish whose shares cannot be traced back to one list this way
// (several different rare items mixed per population: Lionfish, Blue Discus, Ghostfish, Octopus,
// Stingray, Woodskip, Stonefish, Ice Pip), fish whose vanilla roe is already more than 1 per day
// (Blobfish, Lava Eel, Sandfish, Scorpion Carp, Sturgeon, Tiger Trout, Void Salmon) or whose pond
// tints the water (Super Cucumber, Slimejack) stay vanilla, as do Squid and Midnight Squid (squid
// ink, not roe) and the crab pot animals (roe is a rare side product there). Flounder and Midnight Carp (sea/river
// jelly from population 7) need the 1.6 text-ID objects SeaJelly/RiverJelly, which are not in
// tools/stardew/data/items.json yet.
//
// Item IDs: tools/stardew/data/items.json (wiki Modding:Objects/Object sprites). Goby is a 1.6
// object with a text ID that is not in that list; it is only matched by its name tag (item_goby,
// Goby page "Fish Pond": 4 days, same quests as the other river fish, "The only possible output is
// orange Goby Roe").

// Quest groups: wiki "Population Quest Occurs at" → items as [name, min, max?] (min 1 = one item).
export const QUESTS = {
  river: {
    3: [['Acorn', 3], ['Bug Meat', 10], ['Maple Seed', 3], ['Pine Cone', 3]],
    5: [['Gold Ore', 3], ['Maple Syrup', 1], ['Mixed Seeds', 5]],
    7: [['Crayfish', 1], ['Honey', 1], ['Jade', 2], ['Periwinkle', 1]]
  },
  muddy: {
    3: [['Bug Meat', 10], ['Clay', 2, 3], ['Green Algae', 2, 3], ['Slime', 5]],
    5: [['Common Mushroom', 2, 3], ['Earth Crystal', 1, 2], ['Limestone', 1]],
    7: [['Mudstone', 1], ['Snail', 1], ['Wild Bait', 5]]
  },
  ocean: {
    3: [['Driftwood', 3], ['Frozen Geode', 1], ['Seaweed', 1, 2]],
    5: [['Clam', 2], ['Coral', 2]],
    7: [['Aquamarine', 2], ['Mussel', 1], ['Sea Urchin', 2]]
  },
  carp: { 3: [['Green Algae', 2]], 5: [['Cave Carrot', 2]] },
  herring: { 3: [['Driftwood', 3]], 5: [['Coral', 1]] },
  // 1.1
  catfish: {
    3: [['Amethyst', 2], ['Copper Bar', 3], ['Red Mushroom', 3], ['Topaz', 2]],
    5: [['Bat Wing', 10], ['Earth Crystal', 2], ['Mixed Seeds', 5], ['Purple Mushroom', 2, 3]],
    7: [['Diamond', 1], ['Iron Bar', 3], ['Mayonnaise', 1], ['Pickles', 1]]
  },
  sunfish: { 3: [['Acorn', 2], ['Geode', 2]], 5: [['Amethyst', 1], ['Mixed Seeds', 3]] },
  trout: {
    3: [['Coral', 3], ['Honey', 1], ['Oyster', 1], ['Refined Quartz', 3]],
    5: [['Purple Mushroom', 2, 3], ['Emerald', 2], ['Omni Geode', 2, 3], ['Dried Starfish', 1]],
    7: [['Diamond', 1], ['Gold Bar', 3], ['Iridium Ore', 1], ['Jelly', 1], ['Pickles', 1]]
  },
  spook: {
    3: [['Amethyst', 3], ['Coral', 3], ['Iron Bar', 3], ['Oyster', 1], ['Red Mushroom', 3], ['Refined Quartz', 3]],
    5: [['Dried Starfish', 1], ['Emerald', 2], ['Granite', 1], ['Omni Geode', 2, 3], ['Purple Mushroom', 2, 3]],
    7: [['Diamond', 1], ['Gold Bar', 3], ['Iridium Ore', 1], ['Mayonnaise', 1], ['Pickles', 1]]
  },
  predator: {
    3: [['Bream', 2], ['Carp', 2], ['Chub', 2]],
    5: [['Bullhead', 2], ['Largemouth Bass', 2]],
    7: [['Ghostfish', 2], ['Sandfish', 2], ['Woodskip', 2]]
  }
};
// The gate the wiki prints as an example (Modding:Fish ponds), = Rainbow Trout's population 5 quest.
export const DOCUMENTED_GATE = { group: 'trout', key: '6', items: ['422 2 3', '60 2', '749 2 3', '116'] };

// fish → [quest group, spawn days, vanilla roe chance (for the check below; ocean: the lowest value)]
export const FISH = {
  Bream: ['river', 2, 0.9],
  Chub: ['river', 2, 0.9],
  Perch: ['river', 2, 0.9],
  Salmon: ['river', 2, 0.9],
  Shad: ['river', 2, 0.9],
  'Smallmouth Bass': ['river', 2, 0.9],
  Walleye: ['river', 3, 0.9],
  Goby: ['river', 4, 0.9],
  Bullhead: ['muddy', 2, 0.9],
  'Largemouth Bass': ['muddy', 3, 0.9],
  Anchovy: ['ocean', 1, 0.7],
  Albacore: ['ocean', 2, 0.7],
  Halibut: ['ocean', 2, 0.7],
  'Red Mullet': ['ocean', 2, 0.7],
  'Red Snapper': ['ocean', 2, 0.7],
  Sardine: ['ocean', 2, 0.7],
  'Sea Cucumber': ['ocean', 2, 0.7],
  Tilapia: ['ocean', 2, 0.7],
  Eel: ['ocean', 3, 0.7],
  Tuna: ['ocean', 3, 0.7],
  Pufferfish: ['ocean', 4, 0.7],
  Carp: ['carp', 1, 1],
  Herring: ['herring', 1, 1],
  // 1.1
  Catfish: ['catfish', 4, 1],
  Sunfish: ['sunfish', 1, 0.9],
  'Rainbow Trout': ['trout', 2, 1],
  'Spook Fish': ['spook', 4, 1],
  Dorado: ['predator', 3, 1],
  Lingcod: ['predator', 3, 1],
  Pike: ['predator', 3, 1]
};
// 1.6 objects with text IDs, not in items.json (matched by name tag only).
const TEXT_ID_FISH = ['Goby'];
// Names with two IDs in items.json (both sprites are drawn as Iridium Ore): 386 is the item, see the
// raw recipes on https://stardewvalleywiki.com/Modding:Recipe_data (revision 193377):
// "Deluxe Scarecrow":"388 50 386 1 771 40/..." = 50 wood, 1 iridium ore, 40 fiber.
const ID_OF = { 'Iridium Ore': '(O)386' };

// Rare vanilla items, checked before the roe in this order (see DOCUMENTED for the source).
const BUG_MEAT = [{ key: 'BugMeat', item: 'Bug Meat', RequiredPopulation: 9, Chance: 0.05, MinStack: 20, MaxStack: 20 }];
export const EXTRAS = {
  Sunfish: [{ key: 'SolarEssence', item: 'Solar Essence', RequiredPopulation: 10, Chance: 0.08, MinStack: 1, MaxStack: 1 }],
  'Rainbow Trout': [
    { key: 'PrismaticShard', item: 'Prismatic Shard', RequiredPopulation: 9, Chance: 0.001, MinStack: 1, MaxStack: 1 },
    { key: 'RainbowShell', item: 'Rainbow Shell', RequiredPopulation: 9, Chance: 0.02, MinStack: 1, MaxStack: 1 }
  ],
  'Spook Fish': [{ key: 'TreasureChest', item: 'Treasure Chest', RequiredPopulation: 9, Chance: 0.003, MinStack: 1, MaxStack: 1 }],
  Dorado: BUG_MEAT,
  Lingcod: BUG_MEAT,
  Pike: BUG_MEAT
};
// "% of Items" per population band from each fish page, section "Fish Pond", "Produce":
// item → [[from, to, percent]]. Catfish: Catfish page (rev. 194361), Sunfish (194289), Rainbow Trout
// (193322), Spook Fish (192189), Dorado (193288), Lingcod (193345), Pike (193602).
const PREDATOR = { Roe: [[1, 8, 100], [9, 10, 95]], 'Bug Meat': [[9, 10, 5]] };
export const DOCUMENTED = {
  Catfish: { Roe: [[1, 10, 100]] },
  Sunfish: { Roe: [[1, 9, 90], [10, 10, 83]], 'Solar Essence': [[10, 10, 8]] },
  'Rainbow Trout': { Roe: [[1, 8, 100], [9, 10, 98]], 'Rainbow Shell': [[9, 10, 2]], 'Prismatic Shard': [[9, 10, 0.1]] },
  'Spook Fish': { Roe: [[1, 8, 100], [9, 10, 99.7]], 'Treasure Chest': [[9, 10, 0.3]] },
  Dorado: PREDATOR,
  Lingcod: PREDATOR,
  Pike: PREDATOR
};

export const ROE = '(O)812';
// Checked top to bottom, the first that passes its population and chance gives the roe.
export const PRODUCE = [
  { key: 'RoeFullPond', RequiredPopulation: 7, Chance: 0.4, MinStack: 2, MaxStack: 3 },
  { key: 'RoeBusyPond', RequiredPopulation: 4, Chance: 0.4, MinStack: 1, MaxStack: 2 },
  { key: 'Roe', RequiredPopulation: 0, Chance: 1, MinStack: 1, MaxStack: 1 }
];
export const PRECEDENCE = -10;
export const BASE_CHANCE = { min: 0.15, max: 0.95 };

export const tagOf = name => `item_${name.trim().toLowerCase().replace(/'/g, '').replace(/\s+/g, '_')}`;
const keyOf = name => name.replace(/[^A-Za-z]/g, '');

// Expected roe per produced item at a population (without the game's extra-roe roll, which applies
// on top in both cases).
export function expectedRoe(population) {
  let rest = 1;
  let sum = 0;
  for (const p of PRODUCE) {
    if (population < p.RequiredPopulation) continue;
    sum += rest * p.Chance * (p.MinStack + p.MaxStack) / 2;
    rest *= 1 - p.Chance;
  }
  return sum;
}

// Share of each item among the days the base chance passed ("% of Items"), first match wins.
// roe: vanilla (one entry, 1 roe at the vanilla chance) or this pack (expected roe count).
export function shares(name, population, roe = 'vanilla') {
  let rest = 1;
  const out = {};
  for (const e of EXTRAS[name] || []) {
    if (population < e.RequiredPopulation) continue;
    out[e.item] = (out[e.item] || 0) + rest * e.Chance;
    rest *= 1 - e.Chance;
  }
  out.Roe = rest * (roe === 'vanilla' ? FISH[name][2] : expectedRoe(population));
  return out;
}

export default async function ({ items }) {
  const ids = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)\d+$/.test(id)) (ids[name] ||= []).push(id);
  const idOf = name => {
    const found = ID_OF[name] ? [ID_OF[name]] : ids[name] || [];
    if (ID_OF[name] && !ids[name]?.includes(ID_OF[name])) throw new Error(`${name}: ${ID_OF[name]} is not in items.json`);
    if (found.length !== 1) throw new Error(`${name}: ${found.length ? `several IDs (${found.join(', ')})` : 'not in items.json'}`);
    return found[0];
  };
  for (const name of Object.keys(FISH)) if (!TEXT_ID_FISH.includes(name)) idOf(name);
  // the rare vanilla items must give the documented shares, and so must the vanilla roe chance
  for (const [name, doc] of Object.entries(DOCUMENTED)) {
    if (!FISH[name]) throw new Error(`${name}: documented but not in FISH`);
    for (const [item, bands] of Object.entries(doc)) {
      for (const [from, to, percent] of bands) {
        const step = String(percent).includes('.') ? 0.1 : 1; // the wiki rounds to this
        for (let pop = from; pop <= to; pop++) {
          const got = 100 * (shares(name, pop)[item] || 0);
          if (Math.abs(got - percent) > step / 2 + 1e-9) throw new Error(`${name}: ${item} at population ${pop} is ${got.toFixed(3)} %, the wiki says ${percent} %`);
        }
      }
    }
  }
  for (const name of Object.keys(EXTRAS)) if (!DOCUMENTED[name]) throw new Error(`${name}: rare items without documented shares`);
  // every population must get at least the vanilla roe, and the rare items exactly the vanilla chance
  for (const name of Object.keys(FISH)) {
    for (let pop = 1; pop <= 10; pop++) {
      const vanilla = shares(name, pop);
      const pack = shares(name, pop, 'pack');
      if (pack.Roe < vanilla.Roe) throw new Error(`${name}: less roe than vanilla at population ${pop}`);
      for (const item of Object.keys(vanilla)) if (item !== 'Roe' && pack[item] !== vanilla[item]) throw new Error(`${name}: ${item} differs from vanilla`);
    }
  }
  if (PRODUCE.at(-1).Chance !== 1 || PRODUCE.at(-1).RequiredPopulation !== 0) throw new Error('the last produce entry must always give roe');
  if (expectedRoe(10) > 2) throw new Error('more than double roe is not a fair value');

  const gatesOf = group => {
    const gates = {};
    for (const [population, quest] of Object.entries(QUESTS[group])) {
      gates[String(Number(population) + 1)] = quest.map(([item, min, max]) => {
        const id = idOf(item).slice(3);
        return max ? `${id} ${min} ${max}` : min > 1 ? `${id} ${min}` : id;
      });
    }
    return gates;
  };
  const example = gatesOf(DOCUMENTED_GATE.group)[DOCUMENTED_GATE.key] || [];
  if (example.length !== DOCUMENTED_GATE.items.length || !DOCUMENTED_GATE.items.every(q => example.includes(q))) throw new Error(`gate ${DOCUMENTED_GATE.key} of ${DOCUMENTED_GATE.group} is ${JSON.stringify(example)}, the wiki example is ${JSON.stringify(DOCUMENTED_GATE.items)}`);

  const entries = {};
  for (const [name, [group, spawn]] of Object.entries(FISH)) {
    if (!(spawn >= 1 && spawn <= 5)) throw new Error(`${name}: spawn time ${spawn}`);
    const id = `{{ModId}}_${keyOf(name)}`;
    entries[id] = {
      Id: id,
      RequiredTags: [tagOf(name)],
      Precedence: PRECEDENCE,
      SpawnTime: spawn,
      BaseMinProduceChance: BASE_CHANCE.min,
      BaseMaxProduceChance: BASE_CHANCE.max,
      ProducedItems: [
        ...(EXTRAS[name] || []).map(({ key, item, ...p }) => ({ Id: `{{ModId}}_${key}`, ItemId: idOf(item), ...p })),
        ...PRODUCE.map(({ key, ...p }) => ({ Id: `{{ModId}}_${key}`, ItemId: ROE, ...p }))
      ],
      PopulationGates: gatesOf(group)
    };
  }
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [{
        LogName: 'More roe from the ponds of common fish',
        Action: 'EditData',
        Target: 'Data/FishPondData',
        Entries: entries
      }]
    }
  };
}
