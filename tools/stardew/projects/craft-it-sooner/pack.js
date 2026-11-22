// Craft It Sooner: the Sprinkler, the Quality Sprinkler and three soil and growth basics can be
// crafted at a lower Farming level. The player picks one of three levels in the Content Patcher
// config (Light, Medium = default, Strong). Only the unlock condition changes: ingredients, output
// and every other recipe stay vanilla, and so does the Iridium Sprinkler.
// Since 1.1 four more farm basics follow the same setting: Quality Fertilizer and Deluxe Speed-Gro
// (Farming), the Bee House (Farming) and the Tapper (Foraging, the skill it already uses).
// Chosen on purpose and left vanilla:
// - Keg (Farming 8) and Iridium Sprinkler (Farming 9): the biggest money and late-game levers.
// - Scarecrow and Basic Fertilizer already unlock at Farming 1, the lowest level; Cask has no skill
//   unlock at all (field 4 is "null", it comes with the farmhouse cellar). Nothing to make sooner.
// Vanilla levels checked on the item pages as well: Quality Fertilizer Farming 9
// (https://stardewvalleywiki.com/Quality_Fertilizer), Deluxe Speed-Gro Farming 8
// (https://stardewvalleywiki.com/Deluxe_Speed-Gro), Bee House Farming 3
// (https://stardewvalleywiki.com/Bee_House), Tapper Foraging 4 since 1.6
// (https://stardewvalleywiki.com/Tapper, history: "now learned at Foraging Level 4 instead of Level 3").
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
// - 1.2: the config menu shows a readable name, description and value labels, in English
//   (i18n/default.json) and German (i18n/de.json, texts in de.js). Content Patcher reads the keys
//   config.<field>.name, config.<field>.description and config.<field>.values.<value> itself
//   (author-guide/config.md, "Translations"); the ConfigSchema Description stays as it is and is
//   the English description. Nothing else changes.

import { DE } from './de.js';

// Data/CraftingRecipes field positions this pack relies on (Modding:Recipe data, crafting format).
export const FIELD = { ingredients: 0, yield: 2, bigCraftable: 3, unlock: 4 };

// Raw vanilla values as of 1.6.15 (Modding:Recipe data, "Crafting recipes", revision 193377).
// pack.js reads the vanilla unlock level and checks the output from these strings.
export const VANILLA = {
  Sprinkler: '334 1 335 1/Home/599/false/s Farming 2/',
  'Quality Sprinkler': '335 1 336 1 338 1/Home/621/false/s Farming 6/',
  'Basic Retaining Soil': '390 2/Field/370/false/s Farming 4/',
  'Quality Retaining Soil': '390 3 330 1/Field/371 2/false/s Farming 7/',
  'Speed-Gro': '726 1 Moss 5/Field/465 5/false/s Farming 3/',
  // 1.1
  'Quality Fertilizer': '92 4 -4 1/Field/369 2/false/s Farming 9/',
  'Deluxe Speed-Gro': '725 1 881 5/Field/466 5/false/s Farming 8/',
  'Bee House': '388 40 382 8 335 1 724 1/Home/10/true/s Farming 3/',
  Tapper: '388 40 334 2/Home/105/true/s Foraging 4/'
};
// Big craftables are not in items.json (objects only): their output IDs as the raw recipe data gives
// them (field 2), so a wrong row in VANILLA is still caught.
export const BIG_OUTPUT = { 'Bee House': '10', Tapper: '105' };
// Skills a recipe may unlock with in this pack.
export const SKILLS = ['Farming', 'Foraging'];
// Never changed: the Iridium Sprinkler (brief) and the Keg (the biggest money lever of the farm).
export const UNTOUCHED = {
  'Iridium Sprinkler': '336 1 337 1 787 1/Home/645/false/s Farming 9/',
  Keg: '388 30 334 1 335 1 725 1/Home/12/true/s Farming 8/'
};

// Config value → skill level per recipe (never later than vanilla, never below level 1).
// 1.1 recipes: Light one level sooner, Medium two, Strong three (never below 1); the Bee House only
// one level at Medium because honey is an income source.
export const LEVELS = {
  Light: { Sprinkler: 1, 'Quality Sprinkler': 5, 'Basic Retaining Soil': 3, 'Quality Retaining Soil': 6, 'Speed-Gro': 2, 'Quality Fertilizer': 8, 'Deluxe Speed-Gro': 7, 'Bee House': 2, Tapper: 3 },
  Medium: { Sprinkler: 1, 'Quality Sprinkler': 4, 'Basic Retaining Soil': 2, 'Quality Retaining Soil': 5, 'Speed-Gro': 1, 'Quality Fertilizer': 7, 'Deluxe Speed-Gro': 6, 'Bee House': 2, Tapper: 2 },
  Strong: { Sprinkler: 1, 'Quality Sprinkler': 3, 'Basic Retaining Soil': 1, 'Quality Retaining Soil': 4, 'Speed-Gro': 1, 'Quality Fertilizer': 6, 'Deluxe Speed-Gro': 5, 'Bee House': 1, Tapper: 1 }
};
export const DEFAULT = 'Medium';

// 1.2: English config texts (the description is the ConfigSchema Description); German in de.js.
export const CONFIG_EN = {
  Level: { name: 'Level', values: { Light: 'Light', Medium: 'Medium', Strong: 'Strong' } }
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
    if (!SKILLS.includes(skill)) throw new Error(`${name}: unlocks with ${skill}, not ${SKILLS.join(' or ')}`);
    if (big === 'true') {
      if (BIG_OUTPUT[name] !== output) throw new Error(`${name}: vanilla output ${output} is not the big craftable ${BIG_OUTPUT[name]}`);
    } else if (big !== 'false' || items.items[`(O)${output}`] !== name) throw new Error(`${name}: vanilla output ${output} is not the object ${name} (items.json)`);
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
  const schema = {
    Level: {
      AllowValues: Object.keys(LEVELS).join(', '),
      Default: DEFAULT,
      Description: 'How much sooner the recipes unlock. Medium: Sprinkler at Farming 1, Quality Sprinkler at 4, Quality Fertilizer at 7, Tapper at Foraging 2. Light stays closer to the original levels, Strong goes lower still. The Iridium Sprinkler and the Keg are not changed.'
    }
  };
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: schema,
      Changes: changes
    },
    ...configI18n(schema, CONFIG_EN, DE)
  };
}
