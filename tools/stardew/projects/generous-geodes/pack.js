// Generous Geodes: the plain Geode, the Frozen Geode and the Magma Geode give their minerals and
// artifact more often and plain stone, clay and ore less often. The player picks one of three
// levels in the Content Patcher config (Gentle, Generous = default, Lavish). No item is added that
// the geode does not give in vanilla. Omni Geodes and Artifact Troves stay untouched (later updates).
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Objects, fields "GeodeDrops" and "GeodeDropsDefaultItems" (section "Geodes & artifact
//   spots", https://stardewvalleywiki.com/Modding:Objects, revision 193966):
//   * GeodeDrops is a list of item spawn fields plus "Chance" (default 1), "SetFlagOnPickup" and
//     "Precedence"; "If set to an item query which returns multiple items, one of them will be
//     selected at random".
//   * GeodeDropsDefaultItems "chooses a predefined list of possible geode drops like clay, coal,
//     copper, iridium, etc.".
//   * "If both fields are specified, each geode will choose between them with an equal 50% chance.
//     If GeodeDrops is specified but no entries match, the geode will use the
//     GeodeDropsDefaultItems regardless of whether it's true."
// - Vanilla contents (wiki pages Geode rev. 190877, Frozen Geode rev. 190881, Magma Geode rev.
//   185672, "Geode Contents"): the minerals and the one artifact of each geode have the same chance
//   each (1/32, 1/30, 1/26) and add up to exactly 1/2; stone, clay, the foraged mineral (Earth
//   Crystal, Frozen Tear, Fire Quartz), coal and ores make up the other 1/2. That is the documented
//   50/50 split of "both fields specified": vanilla gives these geodes GeodeDropsDefaultItems (the
//   resources) and GeodeDrops (the minerals + artifact, one uniform pick). This reading is an
//   inference from the documented numbers; the raw vanilla entries are not published on the wiki.
// - The pack sets both fields per geode with EditData "Fields" (Content Patcher action-editdata.md,
//   "Edit a dictionary"; only these two fields of the three entries change):
//   * GeodeDrops = one entry whose "RandomItemId" (Modding:Item queries, "Item spawn fields": "Each
//     entry in the list has an equal probability of being chosen") is exactly the vanilla mineral +
//     artifact list of that geode, with Chance = the mineral share of the level;
//   * GeodeDropsDefaultItems = false, so the 50/50 coin flip is skipped and the GeodeDrops entry is
//     always tried first. When its Chance roll fails, "no entries match" and the geode falls back to
//     the default items, i.e. exactly the vanilla resource half (stone, clay, foraged mineral, coal,
//     ores with their vanilla amounts and mine-level rules).
//   Result: minerals + artifact = Chance (vanilla 0.5), resources = 1 - Chance, the split inside
//   each half stays vanilla. Every mineral and artifact stays reachable (more often than before), so
//   museum progress works as in vanilla.
// - Priority "Early" (action-editdata.md, "Priority") so that other mods that add their own drops
//   to these lists apply after this pack and keep their entries.
// - The level is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default)
//   and selects one patch via "When" (author-guide.md#conditions). {{ModId}} keeps the entry ID
//   unique (tokens.md#ModId).
// - 1.1, config texts: i18n keys config.Generosity.name / .description / .values.<value> in
//   i18n/default.json (English, CONFIG_TEXT below) and i18n/de.json (German, CONFIG_DE in de.js).
//   Content Patcher reads them itself for the config menu (author-guide/config.md, "Translations":
//   all keys optional, not case-sensitive) and picks the file of the game language
//   (translations.md). The ConfigSchema Description stays as it was and is also the English
//   description text.
//
// Item IDs: tools/stardew/data/items.json (wiki Modding:Objects/Object sprites); the names below are
// resolved through it, so a wrong name fails the build.

import { CONFIG_DE } from './de.js';

// geode → { item: the geode, foraged: its foraged mineral (resource half, for the page only),
//           drops: the vanilla minerals + artifact of the wiki "Geode Contents" tables, odds: 1/n each }
export const GEODES = {
  Geode: {
    foraged: 'Earth Crystal',
    odds: 32,
    drops: ['Dwarvish Helm', 'Alamite', 'Calcite', 'Celestine', 'Granite', 'Jagoite', 'Jamborite', 'Limestone', 'Malachite', 'Mudstone', 'Nekoite', 'Orpiment', 'Petrified Slime', 'Sandstone', 'Slate', 'Thunder Egg']
  },
  'Frozen Geode': {
    foraged: 'Frozen Tear',
    odds: 30,
    drops: ['Ancient Drum', 'Aerinite', 'Esperite', 'Fairy Stone', 'Fluorapatite', 'Geminite', 'Ghost Crystal', 'Hematite', 'Kyanite', 'Lunarite', 'Marble', 'Ocean Stone', 'Opal', 'Pyrite', 'Soapstone']
  },
  'Magma Geode': {
    foraged: 'Fire Quartz',
    odds: 26,
    drops: ['Dwarf Gadget', 'Baryte', 'Basalt', 'Bixite', 'Dolomite', 'Fire Opal', 'Helvite', 'Jasper', 'Lemon Stone', 'Neptunite', 'Obsidian', 'Star Shards', 'Tigerseye']
  }
};

// Config value → share of geodes that give a mineral or the artifact (vanilla: 0.5).
export const LEVELS = { Gentle: 0.6, Generous: 0.7, Lavish: 0.8 };
export const DEFAULT = 'Generous';
export const VANILLA_SHARE = 0.5;

// Chance of one particular mineral at a share (the list is a uniform pick).
export const perItem = (geode, share) => share / GEODES[geode].drops.length;

export const CONFIG = {
  Generosity: {
    AllowValues: Object.keys(LEVELS).join(', '),
    Default: DEFAULT,
    Description: 'How often geodes, frozen geodes and magma geodes hold a mineral or artifact instead of stone, clay or ore. Gentle 60 %, Generous 70 %, Lavish 80 % (normal game: 50 %).'
  }
};
// Config menu texts (1.1): English name and level words; the share is added to each label
// ("Gentle (60 %)"), the description is the ConfigSchema Description. German in de.js.
export const CONFIG_TEXT = {
  Generosity: { name: 'Geode generosity', values: { Gentle: 'Gentle', Generous: 'Generous', Lavish: 'Lavish' } }
};
export const percent = share => `${Math.round(share * 100)} %`;

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

// One language: level word + share in every label, and the description must name each level with
// its share (so the texts cannot drift from LEVELS).
function levelTexts(texts, description, lang) {
  const t = texts.Generosity;
  for (const [level, share] of Object.entries(LEVELS)) {
    if (!description.includes(`${t.values[level]} ${percent(share)}`)) throw new Error(`${lang} description must name ${t.values[level]} ${percent(share)}`);
  }
  if (!description.includes(percent(VANILLA_SHARE))) throw new Error(`${lang} description must name the normal ${percent(VANILLA_SHARE)}`);
  const values = Object.fromEntries(Object.entries(t.values).map(([level, word]) => [level, `${word} (${percent(LEVELS[level])})`]));
  return { Generosity: { name: t.name, description, values } };
}

export default async function ({ items }) {
  const idOf = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)\d+$/.test(id)) idOf[name] = id;
  if (!(DEFAULT in LEVELS)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const [level, share] of Object.entries(LEVELS)) {
    if (!(share > VANILLA_SHARE && share <= 0.8)) throw new Error(`${level}: share ${share} is outside 0.5 to 0.8 (fair values)`);
  }
  for (const [geode, g] of Object.entries(GEODES)) {
    for (const name of [geode, g.foraged, ...g.drops]) if (!idOf[name]) throw new Error(`${geode}: ${name} is not in items.json`);
    if (new Set(g.drops).size !== g.drops.length) throw new Error(`${geode}: a drop is listed twice`);
    // the wiki odds: every drop 1/odds, together exactly the vanilla half
    if (g.drops.length / g.odds !== VANILLA_SHARE) throw new Error(`${geode}: ${g.drops.length} drops at 1/${g.odds} are not one half`);
  }

  const changes = Object.entries(LEVELS).map(([level, share]) => {
    const fields = {};
    for (const [geode, g] of Object.entries(GEODES)) {
      fields[idOf[geode].slice(3)] = {
        GeodeDropsDefaultItems: false,
        GeodeDrops: [{
          Id: '{{ModId}}_Minerals',
          RandomItemId: g.drops.map(name => idOf[name]),
          Chance: share
        }]
      };
    }
    return {
      LogName: `Geodes: minerals and artifacts ${Math.round(share * 100)} % (${level})`,
      Action: 'EditData',
      Target: 'Data/Objects',
      Priority: 'Early',
      Fields: fields,
      When: { Generosity: level }
    };
  });
  const i18n = configKeys(CONFIG, levelTexts(CONFIG_TEXT, CONFIG.Generosity.Description, 'English'), 'English');
  const de = configKeys(CONFIG, levelTexts(CONFIG_DE, CONFIG_DE.Generosity.description, 'German'), 'German');
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
