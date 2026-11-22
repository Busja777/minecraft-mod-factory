// Machine Tempo: kegs, preserves jars, cheese presses (since 1.1) and looms (since 1.1) finish their
// goods faster. The player picks the factor in the Content Patcher config (1.0 = vanilla, 1.25,
// 1.5 = default, 2.0); one factor for all four machines.
//
// How the speed-up works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Machines is keyed by the qualified ID of the machine. Each machine has OutputRules with
//   MinutesUntilReady/DaysUntilReady per rule, and on the machine itself the optional
//   "ReadyTimeModifiers" field: "Quantity modifiers applied to the produced item's processing
//   time", combined by "ReadyTimeModifierMode" (default Stack).
//   https://stardewvalleywiki.com/Modding:Machines#Item_processing_rules
// - A quantity modifier is { Id, Modification, Amount, Condition }, Modification can be Add,
//   Subtract, Multiply, Divide or Set.
//   https://stardewvalleywiki.com/Modding:Common_data_field_types#Quantity_modifiers
//   So one modifier "Divide <factor>" per machine expresses the factor exactly, for every output
//   rule at once, without copying or touching the rules themselves (inputs, outputs, prices and
//   the minutes per rule stay vanilla, and rules other mods add are sped up too).
// - The patch sets the ReadyTimeModifiers field of the machines with EditData "Fields"
//   (Content Patcher docs, action-editdata.md "Fields"); nothing else in Data/Machines changes.
//   Assumption: vanilla 1.6 has no ReadyTimeModifiers of its own on these machines (the wiki
//   does not list the raw Data/Machines entries); if it had, this patch would replace them.
// - The factor is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default)
//   and selects one patch through "When" (author-guide.md#conditions). At 1.0 no patch applies, so
//   the game data stays exactly vanilla. {{ModId}} keeps the modifier ID unique (tokens.md#ModId).
// - 1.2, config texts: i18n keys config.Speed.name / .description / .values.<value> in
//   i18n/default.json (English, CONFIG_TEXT below) and i18n/de.json (German, CONFIG_DE in de.js).
//   Content Patcher reads them itself for the config menu (author-guide/config.md, "Translations":
//   all keys optional, not case-sensitive) and picks the file of the game language
//   (translations.md). The ConfigSchema Description stays as it was and is also the English
//   description text. Every label shows its factor (German with a decimal comma).
//
// Machine IDs (big craftables, Data/BigCraftables): Keg = (BC)12, Preserves Jar = (BC)15,
// Cheese Press = (BC)16, Loom = (BC)17. Source: the raw Data/CraftingRecipes "as of 1.6.15" on
// https://stardewvalleywiki.com/Modding:Recipe_data (revision 193377). Each machine's recipe yields
// its own ID with the "big craftable" field true: "Keg": ".../Home/12/true/...", "Preserves Jar":
// ".../Home/15/true/...", "Cheese Press": ".../Home/16/true/...", "Loom": ".../Home/17/true/...".
//
// Vanilla processing minutes per output (only for the page and the changelog, the pack itself
// does not depend on them): https://stardewvalleywiki.com/Keg#Products,
// https://stardewvalleywiki.com/Preserves_Jar, https://stardewvalleywiki.com/Cheese_Press#Products
// and https://stardewvalleywiki.com/Loom#Products (product tables, revisions 195253, 195389,
// 183811, 190254; the loom's "4 Hours" = 240 minutes).

import { CONFIG_DE } from './de.js';

export const MACHINES = {
  '(BC)12': {
    name: 'Keg',
    minutes: { Beer: 1750, Vinegar: 600, Coffee: 120, 'Green Tea': 180, Mead: 600, 'Pale Ale': 2250, Juice: 6000, Wine: 10000 }
  },
  '(BC)15': {
    name: 'Preserves Jar',
    minutes: { Pickles: 4000, Jelly: 4000, Caviar: 6000, 'Aged Roe': 4000 }
  },
  '(BC)16': {
    name: 'Cheese Press',
    since: '1.1',
    minutes: { Cheese: 200, 'Goat Cheese': 200 }
  },
  '(BC)17': {
    name: 'Loom',
    since: '1.1',
    minutes: { Cloth: 240 }
  }
};

// Config values (strings, as Content Patcher compares them) → speed factor.
export const FACTORS = { '1.0': 1, '1.25': 1.25, '1.5': 1.5, '2.0': 2 };
export const DEFAULT = '1.5';

// Processing time at a given factor (rounded down like an int conversion; the exact rounding of
// the game is not documented).
export const readyMinutes = (minutes, factor) => Math.floor(minutes / factor);

export const CONFIG = {
  Speed: {
    AllowValues: Object.keys(FACTORS).join(', '),
    Default: DEFAULT,
    Description: 'How much faster kegs, preserves jars, cheese presses and looms work. 1.0 is the normal speed, 2.0 halves the time.'
  }
};
// Config menu texts (1.2): English name and value labels, the description is the ConfigSchema
// Description. German in de.js.
export const CONFIG_TEXT = {
  Speed: {
    name: 'Machine speed',
    values: {
      '1.0': 'Normal speed (1.0)',
      '1.25': '1.25 times as fast',
      '1.5': '1.5 times as fast',
      '2.0': 'Twice as fast (2.0)'
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
  if (!(DEFAULT in FACTORS)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const [id, { name }] of Object.entries(MACHINES)) {
    if (!/^\(BC\)\d+$/.test(id)) throw new Error(`${name}: ${id} is not a qualified big craftable ID`);
  }
  for (const [value, factor] of Object.entries(FACTORS)) {
    if (!(factor >= 1 && factor <= 2)) throw new Error(`factor ${value} is outside 1 to 2 (fair values)`);
  }
  const changes = [];
  for (const [value, factor] of Object.entries(FACTORS)) {
    if (factor === 1) continue; // 1.0 = vanilla: no patch at all
    const fields = {};
    for (const id of Object.keys(MACHINES)) {
      fields[id] = {
        ReadyTimeModifiers: [{ Id: '{{ModId}}_Tempo', Modification: 'Divide', Amount: factor }]
      };
    }
    changes.push({
      LogName: `Kegs, preserves jars, cheese presses and looms ${value}x faster`,
      Action: 'EditData',
      Target: 'Data/Machines',
      Fields: fields,
      When: { Speed: value }
    });
  }
  const i18n = configKeys(CONFIG, { Speed: { ...CONFIG_TEXT.Speed, description: CONFIG.Speed.Description } }, 'English');
  const de = configKeys(CONFIG, CONFIG_DE, 'German');
  for (const value of Object.keys(FACTORS)) {
    // every label shows its factor: "1.5" in English, "1,5" in German
    if (!i18n[`config.Speed.values.${value}`].includes(value)) throw new Error(`English label of ${value} must show the factor`);
    if (!de[`config.Speed.values.${value}`].includes(value.replace('.', ','))) throw new Error(`German label of ${value} must show the factor`);
  }
  for (const [key, text] of Object.entries(de)) if (/\b(Sie|Ihnen|Ihr|Ihre)\b/.test(text)) throw new Error(`${key}: German config texts use the Du-form`);
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: CONFIG,
      Changes: changes
    },
    'i18n/default.json': i18n,
    'i18n/de.json': de
  };
}
