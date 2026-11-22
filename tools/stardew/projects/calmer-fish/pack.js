// Calmer Fish: fish are easier to catch. The player picks one of three levels in the Content
// Patcher config (Light, Medium = default, Strong); every non-legendary fish caught with a fishing
// rod gets a lower difficulty, everything else in Data/Fish stays vanilla.
// 1.1: an optional switch "Legendaries" (default false, so 1.0 behaviour stays) makes the ten
// legendary fish (and their Legendary Fish II versions) a little calmer too, by a fixed gentle factor
// that does not depend on the level.
// 1.2: the config menu shows readable names, descriptions and value labels, in English
// (i18n/default.json) and German (i18n/de.json, texts in de.js). Content Patcher reads the keys
// config.<field>.name, config.<field>.description and config.<field>.values.<value> itself
// (author-guide/config.md, "Translations"); the ConfigSchema Description stays as it is and is the
// English description. Nothing else changes.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Fish is a string → string lookup; each value is a slash-delimited string. For fish caught
//   with a rod (field 1 is not "trap"), field 0 is the name, field 1 the "chance to dart" ("How
//   often the fish darts in the fishing minigame; between 15 (carp) and 100 (glacierfish)") and
//   field 2 the "darting randomness" (behaviour: mixed, smooth, floater, sinker or dart).
//   https://stardewvalleywiki.com/Modding:Fish_data (revision 187068)
//   The Fish page calls field 1 the fish's "Difficulty" (column "Difficulty & Behavior").
// - The keys are the unqualified object IDs: Data/Locations fish entries "ignore the Data/Fish
//   requirements ... for objects whose ID isn't listed in Data/Fish"
//   (https://stardewvalleywiki.com/Modding:Location_data, revision 186972).
// - The patch changes only field 1 of each fish with EditData "Fields": "The key for each field
//   is the field index (starting at zero) for a slash-delimited string" (Content Patcher docs,
//   action-editdata.md, "Fields"). Name, behaviour, sizes, times, seasons, weather, locations,
//   depth, chances, minimum fishing level and the tutorial flag are never written, so they stay
//   vanilla (and so do other mods' edits to those fields). The raw vanilla strings are not
//   published on the wiki, so the pack deliberately does not rewrite whole strings.
// - The level is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default)
//   and selects one patch through "When" (author-guide.md#conditions). The legendary switch is a
//   second option with AllowValues "true, false" ("use "true, false" for a field that can be enabled
//   or disabled, and Content Patcher will recognize it as a boolean", config.md) and its own patch.
//
// Vanilla difficulty and behaviour of every rod fish: https://stardewvalleywiki.com/Fish
// (tables "Fishing Pole Fish" and "Night Market Fish", column "Difficulty & Behavior", revision
// 195502). Legendary fish (tables "Legendary Fish" and "Legendary Fish II") are left out of FISH and
// the levels on purpose; only the Legendaries switch touches them. Their difficulty and behaviour
// come from the same two tables and match each fish's own page (Crimsonfish rev. 193655, Angler
// 193659, Legend 193653, Glacierfish 193652, Mutant Carp 193657, Son of Crimsonfish 193656, Ms.
// Angler 193660, Legend II 193654, Glacierfish Jr. 193651, Radioactive Carp 193658). Legend and
// Legend II have 110 there, above the "between 15 (carp) and 100 (glacierfish)" of Modding:Fish data,
// so legendary values are checked against 15 to 110. The Fish page: the Legendary Fish II "have the
// same difficulties as the older generation of fish", i.e. they read their own Data/Fish entries.
// Item IDs come from tools/stardew/data/items.json; Goby is a 1.6 object with the text ID "Goby"
// (Content Patcher docs, action-editdata.md, the Data/Objects "Goby" example), not in items.json.
//
// Side effect (documented, not avoidable through data): fishing XP per catch is
// ((quality + 1) × 3) + difficulty / 3 (https://stardewvalleywiki.com/Fishing#Experience_Points,
// revision 193904), so calmer fish give somewhat less XP per catch.

import { configDe } from './de.js';

// Data/Fish field positions this pack relies on (Modding:Fish data, rod-fish format).
export const FIELD = { name: 0, difficulty: 1, behaviour: 2 };
export const BEHAVIOURS = ['mixed', 'smooth', 'floater', 'sinker', 'dart'];

// name → [vanilla difficulty, vanilla behaviour] (Fish page, see above)
export const FISH = {
  Pufferfish: [80, 'floater'],
  Anchovy: [30, 'dart'],
  Tuna: [70, 'smooth'],
  Sardine: [30, 'dart'],
  Bream: [35, 'smooth'],
  'Largemouth Bass': [50, 'mixed'],
  'Smallmouth Bass': [28, 'mixed'],
  'Rainbow Trout': [45, 'mixed'],
  Salmon: [50, 'mixed'],
  Walleye: [45, 'smooth'],
  Perch: [35, 'dart'],
  Carp: [15, 'mixed'],
  Catfish: [75, 'mixed'],
  Pike: [60, 'dart'],
  Sunfish: [30, 'mixed'],
  'Red Mullet': [55, 'smooth'],
  Herring: [25, 'dart'],
  Eel: [70, 'smooth'],
  Octopus: [95, 'sinker'],
  'Red Snapper': [40, 'mixed'],
  Squid: [75, 'sinker'],
  'Sea Cucumber': [40, 'sinker'],
  'Super Cucumber': [80, 'sinker'],
  Ghostfish: [50, 'mixed'],
  Stonefish: [65, 'sinker'],
  'Ice Pip': [85, 'dart'],
  'Lava Eel': [90, 'mixed'],
  Sandfish: [65, 'mixed'],
  'Scorpion Carp': [90, 'dart'],
  Flounder: [50, 'sinker'],
  'Midnight Carp': [55, 'mixed'],
  Sturgeon: [78, 'mixed'],
  'Tiger Trout': [60, 'dart'],
  Bullhead: [46, 'smooth'],
  Tilapia: [50, 'mixed'],
  Chub: [35, 'dart'],
  Dorado: [78, 'mixed'],
  Albacore: [60, 'mixed'],
  Shad: [45, 'smooth'],
  Lingcod: [85, 'mixed'],
  Halibut: [50, 'sinker'],
  Woodskip: [50, 'mixed'],
  'Void Salmon': [80, 'mixed'],
  Slimejack: [55, 'dart'],
  Stingray: [80, 'sinker'],
  Lionfish: [50, 'smooth'],
  'Blue Discus': [60, 'dart'],
  Goby: [55, 'dart'],
  'Midnight Squid': [55, 'sinker'],
  'Spook Fish': [60, 'dart'],
  Blobfish: [75, 'floater']
};
// Objects with a text ID in 1.6 (not in items.json), with their source.
export const TEXT_IDS = { Goby: 'Goby' };
// Legendary fish (Fish page, "Legendary Fish" and "Legendary Fish II"): name → [vanilla
// difficulty, vanilla behaviour]. Never touched by the levels; only by the Legendaries switch.
export const LEGENDARY_FISH = {
  Crimsonfish: [95, 'mixed'],
  Angler: [85, 'smooth'],
  Legend: [110, 'mixed'],
  Glacierfish: [100, 'mixed'],
  'Mutant Carp': [80, 'dart'],
  'Son of Crimsonfish': [95, 'mixed'],
  'Ms. Angler': [85, 'smooth'],
  'Legend II': [110, 'mixed'],
  'Glacierfish Jr.': [100, 'mixed'],
  'Radioactive Carp': [80, 'dart']
};
export const LEGENDARY = Object.keys(LEGENDARY_FISH);
// Legendary II name → the original it copies (Fish page: same difficulties).
const LEGENDARY_II = { 'Son of Crimsonfish': 'Crimsonfish', 'Ms. Angler': 'Angler', 'Legend II': 'Legend', 'Glacierfish Jr.': 'Glacierfish', 'Radioactive Carp': 'Mutant Carp' };
export const LEGENDARY_MAX = 110; // Legend, Legend II (see above)

// Config values → difficulty factor. The new difficulty never drops below the easiest vanilla
// fish (Carp, 15), so nothing becomes easier than a carp.
export const LEVELS = { Light: 0.85, Medium: 0.7, Strong: 0.55 };
export const DEFAULT = 'Medium';
export const MINIMUM = 15;
// Legendaries switch: one gentle factor, the same 15 % as the Light level, whatever level is chosen
// (legendary fish stay a real challenge even at Strong). Default off.
export const LEGENDARY_FACTOR = 0.85;
export const LEGENDARY_DEFAULT = 'false';

export const calmer = (difficulty, factor) => Math.max(MINIMUM, Math.min(difficulty, Math.round(difficulty * factor)));

// 1.2: English config texts (the description is the ConfigSchema Description); German in de.js.
export const CONFIG_EN = {
  Level: { name: 'Level', values: { Light: 'Light', Medium: 'Medium', Strong: 'Strong' } },
  Legendaries: { name: 'Legendary fish too', values: { true: 'On', false: 'Off' } }
};

// Config menu texts (Content Patcher author-guide/config.md, "Translations"): for every field
// config.<field>.name, config.<field>.description and config.<field>.values.<value>, in
// i18n/default.json (English, the description is the ConfigSchema Description itself) and
// i18n/de.json. Every field and value needs its text in both languages, and every number of the
// English description must be in the German one too (decimal comma).
export function configI18n(schema, en, de) {
  const files = { 'i18n/default.json': {}, 'i18n/de.json': {} };
  for (const [lang, texts] of [['en', en], ['de', de]]) {
    if (Object.keys(texts).sort().join() !== Object.keys(schema).sort().join()) throw new Error(`${lang}: config texts for ${Object.keys(texts).join(', ')}, settings are ${Object.keys(schema).join(', ')}`);
  }
  for (const [field, def] of Object.entries(schema)) {
    const values = def.AllowValues.split(',').map(v => v.trim());
    for (const [file, texts, description] of [['i18n/default.json', en[field], def.Description], ['i18n/de.json', de[field], de[field].description]]) {
      if (!texts.name || !description) throw new Error(`${file}: ${field} needs a name and a description`);
      if (Object.keys(texts.values || {}).sort().join() !== [...values].sort().join()) throw new Error(`${file}: ${field} needs a label for each of ${values.join(', ')}`);
      files[file][`config.${field}.name`] = texts.name;
      files[file][`config.${field}.description`] = description;
      for (const v of values) files[file][`config.${field}.values.${v}`] = texts.values[v];
    }
    for (const n of def.Description.match(/\d+(\.\d+)?/g) || []) if (!de[field].description.includes(n.replace('.', ','))) throw new Error(`de.js: ${field}: the German description lacks ${n}`);
  }
  return files;
}

export default async function ({ items }) {
  const idOf = { ...TEXT_IDS };
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)/.test(id) && !(name in idOf)) idOf[name] = id.slice(3);
  if (!(DEFAULT in LEVELS)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const [level, factor] of Object.entries(LEVELS)) if (!(factor >= 0.5 && factor < 1)) throw new Error(`level ${level}: factor ${factor} is outside 0.5 to 1 (fair values)`);
  if (FIELD.difficulty !== 1 || FIELD.behaviour !== 2 || FIELD.name !== 0) throw new Error('Data/Fish field positions changed: name 0, chance to dart 1, darting randomness 2 (Modding:Fish data)');
  for (const [name, [difficulty, behaviour]] of Object.entries(FISH)) {
    if (!idOf[name]) throw new Error(`${name} has no known item ID`);
    if (LEGENDARY.includes(name)) throw new Error(`${name} is a legendary fish`);
    if (!(Number.isInteger(difficulty) && difficulty >= 15 && difficulty <= 100)) throw new Error(`${name}: difficulty ${difficulty} is outside the documented 15 to 100`);
    if (!BEHAVIOURS.includes(behaviour)) throw new Error(`${name}: unknown behaviour ${behaviour}`);
  }
  for (const name of LEGENDARY) if (/^\d+$/.test(idOf[name] || '') === false) throw new Error(`legendary ${name} is not in items.json`);
  if (LEGENDARY.length !== 10) throw new Error('ten legendary fish expected (five and their Legendary Fish II versions)');
  for (const [name, [difficulty, behaviour]] of Object.entries(LEGENDARY_FISH)) {
    if (!(Number.isInteger(difficulty) && difficulty >= MINIMUM && difficulty <= LEGENDARY_MAX)) throw new Error(`${name}: difficulty ${difficulty} is outside the documented ${MINIMUM} to ${LEGENDARY_MAX}`);
    if (!BEHAVIOURS.includes(behaviour)) throw new Error(`${name}: unknown behaviour ${behaviour}`);
  }
  for (const [two, one] of Object.entries(LEGENDARY_II)) if (JSON.stringify(LEGENDARY_FISH[two]) !== JSON.stringify(LEGENDARY_FISH[one])) throw new Error(`${two} must match ${one} (Fish page: same difficulties)`);
  if (!(LEGENDARY_FACTOR >= 0.8 && LEGENDARY_FACTOR < 1)) throw new Error(`legendary factor ${LEGENDARY_FACTOR} is not gentle (0.8 to 1)`);
  const every = [...Object.keys(FISH), ...LEGENDARY];
  if (new Set(every.map(n => idOf[n])).size !== every.length) throw new Error('two fish share an item ID');

  const changes = Object.entries(LEVELS).map(([level, factor]) => {
    const fields = {};
    for (const [name, [difficulty]] of Object.entries(FISH)) {
      const value = calmer(difficulty, factor);
      if (value > difficulty) throw new Error(`${name}: ${value} would be harder than vanilla ${difficulty}`);
      if (value === difficulty) continue; // already at the minimum: no edit
      fields[idOf[name]] = { [FIELD.difficulty]: String(value) };
    }
    return {
      LogName: `Calmer fish (${level}, difficulty × ${factor})`,
      Action: 'EditData',
      Target: 'Data/Fish',
      Fields: fields,
      When: { Level: level }
    };
  });
  const legendary = {};
  for (const [name, [difficulty]] of Object.entries(LEGENDARY_FISH)) {
    const value = calmer(difficulty, LEGENDARY_FACTOR);
    if (!(value < difficulty && value >= MINIMUM)) throw new Error(`${name}: ${value} is not calmer than ${difficulty} or below ${MINIMUM}`);
    legendary[idOf[name]] = { [FIELD.difficulty]: String(value) };
  }
  changes.push({
    LogName: `Calmer legendary fish (difficulty × ${LEGENDARY_FACTOR})`,
    Action: 'EditData',
    Target: 'Data/Fish',
    Fields: legendary,
    When: { Legendaries: 'true' }
  });
  const percent = Math.round(100 * (1 - LEGENDARY_FACTOR));
  const schema = {
    Level: {
      AllowValues: Object.keys(LEVELS).join(', '),
      Default: DEFAULT,
      Description: 'How much calmer fish are in the fishing minigame. Light lowers the difficulty by 15 %, Medium by 30 %, Strong by 45 %. Legendary fish are not changed by this.'
    },
    Legendaries: {
      AllowValues: 'true, false',
      Default: LEGENDARY_DEFAULT,
      Description: `Also make the legendary fish a little calmer: their difficulty is lowered by ${percent} %, whatever the level. Off by default.`
    }
  };
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: schema,
      Changes: changes
    },
    ...configI18n(schema, CONFIG_EN, configDe({ percent }))
  };
}
