// Fish Pond Bounty: fish ponds of 23 common river and ocean fish give their roe more reliably and,
// in fuller ponds, in bigger amounts. One fixed level in 1.0, no config. Roe is the only produce
// vanilla gives for these fish, and the only produce of this pack. Legendary fish are not touched.
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
//     lists for population 5 of Super Cucumber, Octopus and Rainbow Trout. Quest items and amounts
//     from https://stardewvalleywiki.com/Fish_Pond#Quests (revision 194160).
//   * SpawnTime: the "Normal Spawn Frequency" column of the same table (days per new fish).
//   * BaseMinProduceChance 0.15 / BaseMaxProduceChance 0.95: the Fish Pond page gives the daily base
//     chance as "(population of pond × 0.08) + 0.15", i.e. 23 % to 95 %, which is the documented
//     lerp between min and max over the population.
//   * MaxPopulation and WaterColor stay unset: these fish grow to 10 after their last quest and do
//     not tint the water (Fish Pond page, "Notes": only legendary fish, Lava Eel, Super Cucumber,
//     Slimejack and Void Salmon change the water colour).
// - ProducedItems: "it checks each entry in the list and takes the first one that matches", each
//   with RequiredPopulation, Chance ("applied after the base chance") and the item spawn fields
//   MinStack/MaxStack (https://stardewvalleywiki.com/Modding:Item_queries#Item_spawn_fields: random
//   value between them, inclusive). ItemId "(O)812" = roe "for the current fish".
//
// Vanilla produce of these fish (Fish Pond page, "Produce"; only roe, 1 per day):
//   river fish (Bream … Walleye, Bullhead, Largemouth Bass, Goby) 1 roe at 90 % of the base chance,
//   ocean fish (Albacore … Tuna) 1 roe at 70 % to 100 %, Carp and Herring 1 roe at 100 %.
// This pack, for every one of them: population 7+: 2–3 roe at 40 %, else population 4+: 1–2 roe at
// 40 %, else 1 roe (100 %). At every population that is at least the vanilla roe, never another item.
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
  herring: { 3: [['Driftwood', 3]], 5: [['Coral', 1]] }
};

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
  Herring: ['herring', 1, 1]
};
// 1.6 objects with text IDs, not in items.json (matched by name tag only).
const TEXT_ID_FISH = ['Goby'];

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

export default async function ({ items }) {
  const idOf = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)\d+$/.test(id)) idOf[name] = id;
  for (const name of Object.keys(FISH)) if (!idOf[name] && !TEXT_ID_FISH.includes(name)) throw new Error(`${name} is not in items.json`);
  // every population must get at least the vanilla roe
  for (const [name, [, , vanilla]] of Object.entries(FISH)) {
    for (let pop = 1; pop <= 10; pop++) if (expectedRoe(pop) < vanilla) throw new Error(`${name}: less roe than vanilla at population ${pop}`);
  }
  if (PRODUCE.at(-1).Chance !== 1 || PRODUCE.at(-1).RequiredPopulation !== 0) throw new Error('the last produce entry must always give roe');
  if (expectedRoe(10) > 2) throw new Error('more than double roe is not a fair value');

  const gatesOf = group => {
    const gates = {};
    for (const [population, quest] of Object.entries(QUESTS[group])) {
      gates[String(Number(population) + 1)] = quest.map(([item, min, max]) => {
        if (!idOf[item]) throw new Error(`quest item ${item} is not in items.json`);
        const id = idOf[item].slice(3);
        return max ? `${id} ${min} ${max}` : min > 1 ? `${id} ${min}` : id;
      });
    }
    return gates;
  };

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
      ProducedItems: PRODUCE.map(({ key, ...p }) => ({ Id: `{{ModId}}_${key}`, ItemId: ROE, ...p })),
      PopulationGates: gatesOf(group)
    };
  }
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [{
        LogName: 'More roe from the ponds of common river and ocean fish',
        Action: 'EditData',
        Target: 'Data/FishPondData',
        Entries: entries
      }]
    }
  };
}
