// Craft It Sooner: the Sprinkler, the Quality Sprinkler and three soil and growth basics can be
// crafted at a lower Farming level. The player picks one of three levels in the Content Patcher
// config (Light, Medium = default, Strong). Only the unlock condition changes: ingredients, output
// and every other recipe stay vanilla, and so does the Iridium Sprinkler.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/CraftingRecipes is a string → string lookup keyed by the recipe name; each value is a
//   slash-delimited string. For crafting recipes, field 0 holds the ingredients, 1 is unused
//   (Home/Field), 2 the yield, 3 "big craftable?", 4 the unlock conditions and 5 the display name.
//   The unlock condition "s <skill> <level>" means: "When the player reaches the given level of the
//   named skill, the recipe will be unlocked on the level up menu."
//   https://stardewvalleywiki.com/Modding:Recipe_data (revision 193377, sections "Format" and
//   "Unlock conditions"; raw Data/CraftingRecipes as of 1.6.15 on the same page).
// - Players who already passed the new level are covered too: "Missing recipes that should already
//   be unlocked are now added to the player automatically on save load."
//   https://stardewvalleywiki.com/Modding:Migrate_to_Stardew_Valley_1.6 (item data changes).
// - The patch changes only field 4 of each recipe with EditData "Fields": "The key for each field
//   is the field index (starting at zero) for a slash-delimited string" (Content Patcher docs,
//   action-editdata.md, "Fields"). Ingredients, yield and display name are never written.
// - The level is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default)
//   and selects one patch through "When" (author-guide.md#conditions).

// Data/CraftingRecipes field positions this pack relies on (Modding:Recipe data, crafting format).
export const FIELD = { ingredients: 0, yield: 2, bigCraftable: 3, unlock: 4 };

// Raw vanilla values as of 1.6.15 (Modding:Recipe data, "Crafting recipes", revision 193377).
// pack.js reads the vanilla unlock level and checks the output from these strings.
export const VANILLA = {
  Sprinkler: '334 1 335 1/Home/599/false/s Farming 2/',
  'Quality Sprinkler': '335 1 336 1 338 1/Home/621/false/s Farming 6/',
  'Basic Retaining Soil': '390 2/Field/370/false/s Farming 4/',
  'Quality Retaining Soil': '390 3 330 1/Field/371 2/false/s Farming 7/',
  'Speed-Gro': '726 1 Moss 5/Field/465 5/false/s Farming 3/'
};
// Never changed (brief: the Iridium Sprinkler stays vanilla).
export const UNTOUCHED = { 'Iridium Sprinkler': '336 1 337 1 787 1/Home/645/false/s Farming 9/' };

// Config value → Farming level per recipe (never later than vanilla, never below level 1).
export const LEVELS = {
  Light: { Sprinkler: 1, 'Quality Sprinkler': 5, 'Basic Retaining Soil': 3, 'Quality Retaining Soil': 6, 'Speed-Gro': 2 },
  Medium: { Sprinkler: 1, 'Quality Sprinkler': 4, 'Basic Retaining Soil': 2, 'Quality Retaining Soil': 5, 'Speed-Gro': 1 },
  Strong: { Sprinkler: 1, 'Quality Sprinkler': 3, 'Basic Retaining Soil': 1, 'Quality Retaining Soil': 4, 'Speed-Gro': 1 }
};
export const DEFAULT = 'Medium';

// "334 1 335 1/Home/599/false/s Farming 2/" → { skill: 'Farming', level: 2, output: '599', big: 'false' }
export function parseRecipe(raw) {
  const fields = raw.split('/');
  const unlock = /^s (\w+) (\d+)$/.exec(fields[FIELD.unlock] || '');
  if (!unlock) throw new Error(`"${raw}": field ${FIELD.unlock} is not a skill unlock`);
  return { skill: unlock[1], level: Number(unlock[2]), output: fields[FIELD.yield].split(' ')[0], big: fields[FIELD.bigCraftable] };
}

export default async function ({ items }) {
  if (!(DEFAULT in LEVELS)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const [name, raw] of Object.entries(VANILLA)) {
    const { skill, output, big } = parseRecipe(raw);
    if (skill !== 'Farming') throw new Error(`${name}: unlocks with ${skill}, not Farming`);
    if (big !== 'false' || items.items[`(O)${output}`] !== name) throw new Error(`${name}: vanilla output ${output} is not the object ${name} (items.json)`);
  }
  for (const name of Object.keys(UNTOUCHED)) if (name in VANILLA) throw new Error(`${name} must stay vanilla`);

  const changes = Object.entries(LEVELS).map(([level, table]) => {
    if (Object.keys(table).sort().join() !== Object.keys(VANILLA).sort().join()) throw new Error(`${level}: every recipe needs a level`);
    const fields = {};
    for (const [name, value] of Object.entries(table)) {
      const vanilla = parseRecipe(VANILLA[name]);
      if (!(Number.isInteger(value) && value >= 1 && value <= vanilla.level)) throw new Error(`${level} ${name}: level ${value} is outside 1 to vanilla ${vanilla.level}`);
      if (value === vanilla.level) continue; // already vanilla: no edit
      fields[name] = { [FIELD.unlock]: `s ${vanilla.skill} ${value}` };
    }
    return {
      LogName: `Craft it sooner (${level})`,
      Action: 'EditData',
      Target: 'Data/CraftingRecipes',
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
          Description: 'How much sooner the recipes unlock. Medium: Sprinkler at Farming 1, Quality Sprinkler at 4. Light stays closer to the original levels, Strong goes lower still. The Iridium Sprinkler is not changed.'
        }
      },
      Changes: changes
    }
  };
}
