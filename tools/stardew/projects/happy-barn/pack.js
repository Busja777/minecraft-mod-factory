// Happy Barn: farm animals that take two days or more between two produce make it sooner. The
// player picks the level in the Content Patcher config: Gentle, Generous (default) or Abundant.
// Animals that already produce every day (chickens, cows, pigs) are not touched, and neither are
// the items they make, quality, prices, feeding, mood or friendship gain.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/FarmAnimals is a string → model lookup; the key is the animal type's ID
//   (https://stardewvalleywiki.com/Modding:Animal_data, revision 195533, "Data format").
//   Fields this pack sets, all in "Produce" and "Player profession effects" there:
//   * DaysToProduce: "The number of days between item productions. For example, setting 1 will
//     produce an item every day. Default 1."
//   * FriendshipForFasterProduce: "The minimum friendship points needed to reduce the DaysToProduce
//     by one. Defaults to no reduction based on friendship."
//   * ProfessionForFasterProduce (not set, only explains the sheep): "The internal ID of a
//     profession which reduces the DaysToProduce by one."
// - The vanilla values come from the animal pages, because the wiki does not publish the raw
//   Data/FarmAnimals entries (see VANILLA below for the sentence on each page). No other animal
//   page names a friendship or profession bonus to the produce interval; the Farming page says
//   Shepherd increases "wool production from sheep" and Coopmaster halves the incubation time
//   (https://stardewvalleywiki.com/Farming, revision 191914). So after this pack the shortest
//   interval of every animal is still at least one day:
//   * Ducks, goats (2 days), rabbits (4), ostriches and dinosaurs (7): DaysToProduce minus one
//     (Abundant: minus two for 4 days or more), never below 1.
//   * Sheep (3 days, 900 friendship → one day less, Shepherd → one day less, both → every day):
//     DaysToProduce stays 3. Lowering it would let both bonuses take it to 0, and what the game does
//     with 0 is not documented. Instead the pack lowers FriendshipForFasterProduce from 900 to 200
//     (1 heart; "Each half-heart is equivalent to 100 points of friendship", Animals, revision
//     195447, "Friendship"). A sheep with 1 to 4.5 hearts grows wool one day sooner; the best case
//     stays every day, as in vanilla.
// - Animal IDs (Data/FarmAnimals keys): the debug command "animal <type>" lists the "Valid types
//   for the base game" (https://stardewvalleywiki.com/Modding:Console_commands, revision 193722,
//   "Farm animals"): Blue/Brown/Void/White Chicken, Brown/White Cow, Dinosaur, Duck, Goat, Ostrich,
//   Pig, Rabbit, Sheep. Modding:Animal data itself uses "Goat" (Animals/Goat texture) and the
//   chicken IDs (AlternatePurchaseTypes example).
// - Content Patcher: EditData with "Fields" changes single fields of existing entries and keeps
//   the rest of each entry, including changes of other mods (action-editdata.md, "Fields": "If you
//   only want to change a few fields, use Fields instead for best compatibility with other mods").
// - The level is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default)
//   and selects one patch through "When" (author-guide.md#conditions). Config menu texts:
//   config.Production.name / .description / .values.<value> in i18n/default.json, which Content
//   Patcher reads itself (config.md, "Translations": all keys optional, not case-sensitive). The
//   ConfigSchema Description is also the English description text.
// - Not used on purpose: DeluxeProduceCareDivisor and DeluxeProduceLuckMultiplier. Modding:Animal
//   data calls them "Quantity modifiers" but gives plain numbers as defaults (1200 and 0), so their
//   type is not clear from the docs. DeluxeProduceMinimumFriendship (default 200) is clear, but the
//   vanilla value of ducks and rabbits is not documented.
// - The game's own rules stay: an unfed animal does not produce, below 70 mood it may skip a day,
//   and an animal that produced without the quality roll produces again the next day (Animals,
//   revision 195447, "Produce" and "Special case"). The effect numbers below are the best case.
//
// Other packs of the series: Machine Tempo edits Data/Machines (cheese press, loom …) and Fish Pond
// Bounty edits Data/FishPondData. This pack only edits Data/FarmAnimals.

// Data/FarmAnimals key → vanilla produce interval in days, the wiki page that says it (revision)
// and its sentence. fasterAt: the documented friendship for one day less (sheep only).
export const VANILLA = {
  'White Chicken': { days: 1, page: 'Chicken (195314)', says: 'A mature and fed chicken produces a white or brown Egg every day' },
  'Brown Chicken': { days: 1, page: 'Chicken (195314)', says: 'A mature and fed chicken produces a white or brown Egg every day' },
  'Blue Chicken': { days: 1, page: 'Chicken (195314)', says: 'Aside from appearance, blue chickens are identical to white chickens (Animals 195447)' },
  'Void Chicken': { days: 1, page: 'Void Chicken (195312)', says: 'A mature and fed void chicken produces a Void Egg every day' },
  'White Cow': { days: 1, page: 'Cow (195327)', says: 'A mature and fed cow produces Milk every day' },
  'Brown Cow': { days: 1, page: 'Cow (195327)', says: 'A mature and fed cow produces Milk every day' },
  Pig: { days: 1, page: 'Pig (195340)', says: 'A mature and fed pig produces Truffles every day, if the conditions are met' },
  Duck: { days: 2, page: 'Duck (195334)', says: 'A mature and fed duck produces a Duck Egg every 2 days' },
  Goat: { days: 2, page: 'Goat (195332)', says: 'A mature and fed goat produces Goat Milk every 2 days' },
  Sheep: { days: 3, fasterAt: 900, page: 'Sheep (195321)', says: 'A mature sheep grows in its coat every 3 days … at least 4.5 Hearts (900 points) of Friendship reduces the time by one day. The Shepherd Profession also reduces the time by one day' },
  Rabbit: { days: 4, page: 'Rabbit (195310)', says: 'A mature and fed rabbit produces Wool every 4 days' },
  Ostrich: { days: 7, page: 'Ostrich (195338)', says: 'A mature and fed Ostrich produces an Ostrich Egg every 7 days' },
  Dinosaur: { days: 7, page: 'Dinosaur (195336)', says: 'A mature and fed dinosaur produces a Dinosaur Egg every 7 days' }
};

// Level → how many days sooner an animal with the given vanilla interval produces.
export const LEVELS = {
  Gentle: days => (days >= 4 ? 1 : 0),
  Generous: days => (days >= 2 ? 1 : 0),
  Abundant: days => (days >= 4 ? 2 : days >= 2 ? 1 : 0)
};
export const DEFAULT = 'Generous';
// Sheep: friendship for the one-day bonus once the level shortens a 3-day animal (1 heart).
export const SHEEP_FRIENDSHIP = 200;

// → { <animal ID>: { DaysToProduce } or { FriendshipForFasterProduce } } for one level
export function fieldsOf(level) {
  const sooner = LEVELS[level];
  const fields = {};
  for (const [id, a] of Object.entries(VANILLA)) {
    const by = sooner(a.days);
    if (!by) continue;
    if (a.fasterAt) fields[id] = { FriendshipForFasterProduce: SHEEP_FRIENDSHIP };
    else fields[id] = { DaysToProduce: a.days - by };
  }
  return fields;
}

// Produce per 28 days (one season) in the best case: fed, happy, no profession, and for sheep
// between 1 and 4.5 hearts. → { <animal ID>: { before, after, percent } } for the changed animals.
export function effectOf(level) {
  const out = {};
  for (const [id, f] of Object.entries(fieldsOf(level))) {
    const a = VANILLA[id];
    const days = f.DaysToProduce ?? a.days - 1;
    out[id] = { days, before: 28 / a.days, after: 28 / days, percent: Math.round((a.days / days - 1) * 100) };
  }
  return out;
}

export const CONFIG = {
  Production: {
    AllowValues: Object.keys(LEVELS).join(', '),
    Default: DEFAULT,
    Description: 'How much sooner animals that do not produce every day make their produce. From Generous on, sheep get their faster wool at 1 heart instead of 4.5 hearts. Chickens, cows and pigs already produce every day and stay unchanged.'
  }
};
// Config menu texts: English name and value labels, the description is the ConfigSchema
// Description. Every label starts with the level's name.
export const CONFIG_TEXT = {
  Production: {
    name: 'Production',
    values: {
      Gentle: 'Gentle: rabbits, ostriches, dinosaurs 1 day sooner',
      Generous: 'Generous: ducks and goats daily, others 1 day sooner',
      Abundant: 'Abundant: as Generous, rabbits, ostriches, dinosaurs 2 days sooner'
    }
  }
};

// texts: field → { name, description, values: { <AllowValues value>: label } }
// → { 'config.<field>.name', 'config.<field>.description', 'config.<field>.values.<value>' }
export function configKeys(schema, texts, lang) {
  const keys = {};
  if (Object.keys(texts).sort().join() !== Object.keys(schema).sort().join()) throw new Error(`${lang}: config texts must cover exactly the ConfigSchema fields`);
  for (const [field, def] of Object.entries(schema)) {
    const t = texts[field];
    const values = def.AllowValues.split(',').map(v => v.trim());
    if (!t.name?.trim() || !t.description?.trim()) throw new Error(`${lang} config ${field}: name or description missing`);
    if (Object.keys(t.values).sort().join() !== [...values].sort().join()) throw new Error(`${lang} config ${field}: labels must cover exactly ${values.join(', ')}`);
    keys[`config.${field}.name`] = t.name;
    keys[`config.${field}.description`] = t.description;
    for (const v of values) {
      if (!t.values[v]?.trim()) throw new Error(`${lang} config ${field}: label of ${v} missing`);
      keys[`config.${field}.values.${v}`] = t.values[v];
    }
  }
  return keys;
}

export default async function () {
  if (!(DEFAULT in LEVELS)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const [id, a] of Object.entries(VANILLA)) {
    if (!(Number.isInteger(a.days) && a.days >= 1)) throw new Error(`${id}: vanilla interval ${a.days}`);
    if (a.fasterAt && a.days !== 3) throw new Error(`${id}: only the 3-day sheep has a documented friendship bonus`);
  }
  const changes = [];
  for (const level of Object.keys(LEVELS)) {
    const fields = fieldsOf(level);
    for (const [id, f] of Object.entries(fields)) {
      const a = VANILLA[id];
      // fair values: nothing produces more often than every day, nothing more than twice as often
      if ('DaysToProduce' in f && !(f.DaysToProduce >= 1 && f.DaysToProduce >= a.days / 2)) throw new Error(`${level} ${id}: DaysToProduce ${f.DaysToProduce} from ${a.days}`);
      if ('FriendshipForFasterProduce' in f && !(f.FriendshipForFasterProduce > 0 && f.FriendshipForFasterProduce < a.fasterAt)) throw new Error(`${level} ${id}: friendship ${f.FriendshipForFasterProduce}`);
      if (a.days === 1) throw new Error(`${level} ${id}: daily animals stay unchanged`);
    }
    if (!Object.keys(fields).length) throw new Error(`${level} changes nothing`);
    changes.push({
      LogName: `Animal produce sooner (${level})`,
      Action: 'EditData',
      Target: 'Data/FarmAnimals',
      Fields: fields,
      When: { Production: level }
    });
  }
  const i18n = configKeys(CONFIG, { Production: { ...CONFIG_TEXT.Production, description: CONFIG.Production.Description } }, 'English');
  for (const level of Object.keys(LEVELS)) if (!i18n[`config.Production.values.${level}`].startsWith(`${level}:`)) throw new Error(`English label of ${level} must start with "${level}:"`);
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: CONFIG,
      Changes: changes
    },
    'i18n/default.json': i18n
  };
}
