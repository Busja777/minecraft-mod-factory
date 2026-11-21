// Calmer Fish: fish are easier to catch. The player picks one of three levels in the Content
// Patcher config (Light, Medium = default, Strong); every non-legendary fish caught with a fishing
// rod gets a lower difficulty, everything else in Data/Fish stays vanilla.
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
//   and selects one patch through "When" (author-guide.md#conditions).
//
// Vanilla difficulty and behaviour of every rod fish: https://stardewvalleywiki.com/Fish
// (tables "Fishing Pole Fish" and "Night Market Fish", column "Difficulty & Behavior", revision
// 195502). Legendary fish (tables "Legendary Fish" and "Legendary Fish II") are left out on purpose.
// Item IDs come from tools/stardew/data/items.json; Goby is a 1.6 object with the text ID "Goby"
// (Content Patcher docs, action-editdata.md, the Data/Objects "Goby" example), not in items.json.
//
// Side effect (documented, not avoidable through data): fishing XP per catch is
// ((quality + 1) × 3) + difficulty / 3 (https://stardewvalleywiki.com/Fishing#Experience_Points,
// revision 193904), so calmer fish give somewhat less XP per catch.

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
// Legendary fish (Fish page, "Legendary Fish" and "Legendary Fish II"): never touched.
export const LEGENDARY = ['Crimsonfish', 'Angler', 'Legend', 'Mutant Carp', 'Glacierfish', 'Son of Crimsonfish', 'Ms. Angler', 'Legend II', 'Radioactive Carp', 'Glacierfish Jr.'];

// Config values → difficulty factor. The new difficulty never drops below the easiest vanilla
// fish (Carp, 15), so nothing becomes easier than a carp.
export const LEVELS = { Light: 0.85, Medium: 0.7, Strong: 0.55 };
export const DEFAULT = 'Medium';
export const MINIMUM = 15;

export const calmer = (difficulty, factor) => Math.max(MINIMUM, Math.min(difficulty, Math.round(difficulty * factor)));

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
  if (new Set(Object.keys(FISH).map(n => idOf[n])).size !== Object.keys(FISH).length) throw new Error('two fish share an item ID');

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
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: {
        Level: {
          AllowValues: Object.keys(LEVELS).join(', '),
          Default: DEFAULT,
          Description: 'How much calmer fish are in the fishing minigame. Light lowers the difficulty by 15 %, Medium by 30 %, Strong by 45 %. Legendary fish are not changed.'
        }
      },
      Changes: changes
    }
  };
}
