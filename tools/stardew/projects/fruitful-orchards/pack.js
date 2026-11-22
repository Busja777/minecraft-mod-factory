// Fruitful Orchards: fruit trees sometimes grow two fruits a day instead of one. The player picks
// the chance of the second fruit in the Content Patcher config (25 %, 50 % = default, 100 %).
// Growth time, seasons, fruit quality, textures and everything else stay vanilla.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/FruitTrees is keyed by the unqualified sapling ID; "Fruit" lists "The fruit items to add
//   to the tree each day while the tree is in-season. The first matching fruit (if any) is
//   selected each day", and each fruit entry supports the item spawn fields.
//   https://stardewvalleywiki.com/Modding:Fruit_trees (revision 190774; raw data as of 1.6.8:
//   each of the eight vanilla trees has exactly one Fruit entry, Id "Default", MinStack -1,
//   MaxStack -1, StackModifiers null).
// - Item spawn fields: MinStack -1 "keeps the value set by the item query (usually 1)";
//   StackModifiers are "Quantity modifiers applied to the ... Stack value".
//   https://stardewvalleywiki.com/Modding:Item_queries#Item_spawn_fields
// - A quantity modifier is { Id, Modification, Amount, Condition }; "Add" with Amount 1 adds the
//   second fruit, the Condition "Defaults to always true".
//   https://stardewvalleywiki.com/Modding:Common_data_field_types#Quantity_modifiers
// - Condition "RANDOM <chance>": "A random probability check which is re-rolled each time it's
//   called" (https://stardewvalleywiki.com/Modding:Game_state_queries). At 100 % the pack leaves
//   the Condition out, so the second fruit always comes.
// - The patch only adds one modifier to the tree's fruit entry with EditData + TargetField
//   [<sapling>, "Fruit", "#0", "StackModifiers"] and Entries keyed by its own Id (Content Patcher
//   docs, action-editdata.md "Target field": "list index | The position of a value within the
//   list (like #0 for the first value)", "Edit a list": the key of a model is its Id field; release
//   notes 1.29.2: "Using TargetField to add an entry to a null list or dictionary now
//   auto-creates it"). The index "#0" is used instead of the Id "Default" because the 1.6.16
//   migration guide lists "Fixed some non-unique inner IDs" for Data/FruitTrees; vanilla has a
//   single fruit entry per tree, so "#0" is that entry in every version.
// - The chance is a config option (author-guide/config.md) and selects the patches through "When".
// - 1.1: the config menu shows a readable name, description and value labels, in English
//   (i18n/default.json) and German (i18n/de.json, texts in de.js). Content Patcher reads the keys
//   config.<field>.name, config.<field>.description and config.<field>.values.<value> itself
//   (author-guide/config.md, "Translations"); the ConfigSchema Description stays as it is and is
//   the English description. Nothing else changes.
//
// Trees, saplings and fruit: tools/stardew/data/items.json; seasons and Pierre prices for the page:
// https://stardewvalleywiki.com/Fruit_Trees (revision 195302): fruit trees "require 28 days to
// mature, after which they produce one fruit per day when in season" (unchanged by this pack).

import { DE } from './de.js';

// sapling ID (key in Data/FruitTrees) → [sapling name, fruit name, vanilla fruit item ID]
export const TREES = {
  628: ['Cherry Sapling', 'Cherry', '(O)638'],
  629: ['Apricot Sapling', 'Apricot', '(O)634'],
  630: ['Orange Sapling', 'Orange', '(O)635'],
  631: ['Peach Sapling', 'Peach', '(O)636'],
  632: ['Pomegranate Sapling', 'Pomegranate', '(O)637'],
  633: ['Apple Sapling', 'Apple', '(O)613'],
  69: ['Banana Sapling', 'Banana', '(O)91'],
  835: ['Mango Sapling', 'Mango', '(O)834']
};

// Config values (percent, compared as text) → chance of the second fruit.
export const CHANCES = { 25: 0.25, 50: 0.5, 100: 1 };
export const DEFAULT = '50';
export const EXTRA = 1; // fruits added on a lucky day

// 1.1: English config texts (the description is the ConfigSchema Description); German in de.js.
export const CONFIG_EN = {
  SecondFruitChance: { name: 'Second fruit chance', values: { 25: '25 %', 50: '50 %', 100: '100 %' } }
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

export const modifierOf = chance => ({
  Id: '{{ModId}}_SecondFruit',
  Modification: 'Add',
  Amount: EXTRA,
  ...(chance < 1 ? { Condition: `RANDOM ${chance}` } : {})
});

export default async function ({ items }) {
  if (!(DEFAULT in CHANCES)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const [value, chance] of Object.entries(CHANCES)) {
    if (!(chance > 0 && chance <= 1) || Math.round(chance * 100) !== Number(value)) throw new Error(`chance ${value}: ${chance}`);
  }
  for (const [sapling, [saplingName, fruitName, fruitId]] of Object.entries(TREES)) {
    if (items.items[`(O)${sapling}`] !== saplingName) throw new Error(`(O)${sapling} is not ${saplingName} in items.json`);
    if (items.items[fruitId] !== fruitName) throw new Error(`${fruitId} is not ${fruitName} in items.json`);
  }

  const changes = [];
  for (const [value, chance] of Object.entries(CHANCES)) {
    for (const [sapling, [, fruitName]] of Object.entries(TREES)) {
      const modifier = modifierOf(chance);
      changes.push({
        LogName: `${fruitName} tree: second fruit (${value} %)`,
        Action: 'EditData',
        Target: 'Data/FruitTrees',
        TargetField: [sapling, 'Fruit', '#0', 'StackModifiers'],
        Entries: { [modifier.Id]: modifier },
        When: { SecondFruitChance: value }
      });
    }
  }
  const schema = {
    SecondFruitChance: {
      AllowValues: Object.keys(CHANCES).join(', '),
      Default: DEFAULT,
      Description: 'Chance in percent that a fruit tree grows two fruits instead of one on a day. Growth time, seasons and fruit quality are not changed.'
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
