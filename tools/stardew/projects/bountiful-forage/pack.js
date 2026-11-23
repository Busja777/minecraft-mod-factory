// Bountiful Forage: more standard forage can appear in Cindersap Forest and on the Beach. The player
// picks the step in the Content Patcher config (+25 %, +50 % = default, +100 %). Which items spawn,
// their seasons and chances stay vanilla: the pack never touches a Forage list, so no item can
// appear anywhere it does not already appear.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Locations is keyed by the location's internal name; "Forest" is "Cindersap forest south of
//   the farm" and "Beach" is "The beach south of Pelican Town" (list "Location names").
//   https://stardewvalleywiki.com/Modding:Location_data (revision 186972)
// - Same page, location fields: "MinDailyForageSpawn / MaxDailyForageSpawn: The minimum and maximum
//   number of forage to try spawning in one day, if applicable and the location has fewer than
//   MaxSpawnedForageAtOnce forage. Default 1 and 4 respectively." and "MaxSpawnedForageAtOnce: The
//   maximum number of spawned forage that can be present at once on the map before they stop
//   spawning. Default 6." Field "Forage": the game "chooses a random number of spawn opportunities
//   (between 1 and 4)" and for each one a random tile and a random forage entry whose Condition and
//   Season match; if the tile is not valid or the entry's Chance fails it retries nine times.
// - Vanilla values of Forest and Beach: the raw Data/Locations entries are not published on the
//   wiki, so the pack does not read them. All pages describe the documented defaults for both maps:
//   "The number of attempts to add an item is a random number ranging from 1 to
//   min(4, 6-numberOfSpawnedObjectsOnMap)" and "a hard limit of six standard forageable items per
//   map" (https://stardewvalleywiki.com/Foraging, "Spawning", revision 195239); Cindersap Forest:
//   "the six item per map limit" (https://stardewvalleywiki.com/Cindersap_Forest, revision 194137);
//   the Beach: "at most six items are possible at one time" (https://stardewvalleywiki.com/The_Beach,
//   revision 192724). VANILLA below holds these values; the pack writes absolute numbers derived from
//   them, so the result is the same whether vanilla sets the fields or leaves the defaults.
// - Only the two "Max" fields are raised (× (1 + step), rounded up). MinDailyForageSpawn stays 1
//   and is not written, so a quiet night is still possible and the extra forage is "up to".
// - Not affected (spawned by other code, the pages say so): Spring Onions in the forest, Coral, Sea
//   Urchins and Seaweed in the Beach tide pools, the extra Summer 12-14 coral (Cindersap Forest and
//   The Beach pages, revisions above), the Forest farm map (its own location "Farm_Forest").
// - The patch changes only those two fields of the entries "Forest" and "Beach" with EditData
//   "Fields" ("The individual fields you want to change for existing entries ... the field name for
//   an object"; "If you only want to change a few fields, use Fields instead for best compatibility
//   with other mods", Content Patcher docs, action-editdata.md, "Edit a dictionary"). The entries
//   themselves and every other field, including their Forage lists, stay as they are (and so do
//   other mods' edits to them). TargetField is not needed: both fields sit directly on the entry.
// - The step is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default) and
//   selects one patch through "When". Config menu texts: config.<field>.name / .description /
//   .values.<value> in i18n/default.json (English, the description is the ConfigSchema Description)
//   and i18n/de.json (German, de.js); Content Patcher reads them itself (author-guide/config.md,
//   "Translations"; translations.md).
//
// Balance: no item, price or chance changes, only how many standard forage items the two maps can
// hold and try to spawn per night (Forest forage averages 1.6 to 1.8 a night, the Beach 1.1, page
// revisions above). Gatherer ("20% chance of double harvest") and Botanist ("Foraged items are
// always highest quality", https://stardewvalleywiki.com/Foraging/Skill, revision 190234) apply to
// the extra items as to any forage, and each picked item gives the usual 7 Foraging XP (Foraging,
// "Experience Points"). Nothing can be produced in a loop: the limit per map still caps it.

import { DE } from './de.js';

// Data/Locations key → page of the location (for the log and the report).
export const LOCATIONS = {
  Forest: 'Cindersap Forest',
  Beach: 'the Beach'
};

// Documented vanilla/default values (see above).
export const VANILLA = { MinDailyForageSpawn: 1, MaxDailyForageSpawn: 4, MaxSpawnedForageAtOnce: 6 };
// The fields this pack raises.
export const RAISED = ['MaxDailyForageSpawn', 'MaxSpawnedForageAtOnce'];

// Config values (percent, compared as text).
export const STEPS = ['25', '50', '100'];
export const DEFAULT = '50';

export const raise = (value, step) => Math.ceil(value * (100 + Number(step)) / 100);
export const fieldsOf = step => Object.fromEntries(RAISED.map(f => [f, raise(VANILLA[f], step)]));

// English config texts (the description is the ConfigSchema Description); German in de.js.
// Every label is "+<step> % (limit <new forage limit per map>)".
export const CONFIG_EN = {
  MoreForage: {
    name: 'More forage',
    values: Object.fromEntries(STEPS.map(s => [s, `+${s} % (limit ${fieldsOf(s).MaxSpawnedForageAtOnce})`]))
  }
};

// Config menu texts (Content Patcher author-guide/config.md, "Translations"): for every field
// config.<field>.name, config.<field>.description and config.<field>.values.<value>, in
// i18n/default.json and i18n/de.json. Every field and value needs its text in both languages, and
// every number of the English description must be in the German one too.
export function configI18n(schema, en, de) {
  const files = { 'i18n/default.json': {}, 'i18n/de.json': {} };
  for (const [lang, texts] of [['en', en], ['de', de]]) {
    if (Object.keys(texts).sort().join() !== Object.keys(schema).sort().join()) throw new Error(`${lang}: config texts for ${Object.keys(texts).join(', ')}, settings are ${Object.keys(schema).join(', ')}`);
  }
  for (const [field, def] of Object.entries(schema)) {
    const values = def.AllowValues.split(',').map(v => v.trim());
    for (const [file, texts, description] of [['i18n/default.json', en[field], def.Description], ['i18n/de.json', de[field], de[field].description]]) {
      if (!texts.name?.trim() || !description?.trim()) throw new Error(`${file}: ${field} needs a name and a description`);
      if (Object.keys(texts.values || {}).sort().join() !== [...values].sort().join()) throw new Error(`${file}: ${field} needs a label for each of ${values.join(', ')}`);
      files[file][`config.${field}.name`] = texts.name;
      files[file][`config.${field}.description`] = description;
      for (const v of values) {
        if (!texts.values[v]?.trim()) throw new Error(`${file}: ${field} label of ${v} missing`);
        files[file][`config.${field}.values.${v}`] = texts.values[v];
      }
    }
    for (const n of def.Description.match(/\d+(\.\d+)?/g) || []) if (!de[field].description.includes(n.replace('.', ','))) throw new Error(`de.js: ${field}: the German description lacks ${n}`);
  }
  for (const [key, text] of Object.entries(files['i18n/de.json'])) if (/\b(Sie|Ihnen|Ihr|Ihre)\b/.test(text)) throw new Error(`${key}: German config texts use the Du-form`);
  return files;
}

export default async function () {
  if (!STEPS.includes(DEFAULT)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const step of STEPS) {
    const fields = fieldsOf(step);
    for (const f of RAISED) if (!(Number.isInteger(fields[f]) && fields[f] > VANILLA[f])) throw new Error(`+${step} %: ${f} ${fields[f]} must be a whole number above vanilla ${VANILLA[f]}`);
    if (fields.MaxDailyForageSpawn < VANILLA.MinDailyForageSpawn) throw new Error(`+${step} %: MaxDailyForageSpawn below MinDailyForageSpawn`);
    for (const [lang, texts] of [['English', CONFIG_EN], ['German', DE]]) {
      const label = texts.MoreForage.values[step] || '';
      if (!label.startsWith(`+${step} %`) || !label.includes(String(fields.MaxSpawnedForageAtOnce))) throw new Error(`${lang} label of ${step} must start with +${step} % and name the limit ${fields.MaxSpawnedForageAtOnce}`);
    }
  }

  const schema = {
    MoreForage: {
      AllowValues: STEPS.join(', '),
      Default: DEFAULT,
      Description: 'How much more forage can appear in Cindersap Forest and on the Beach: the spawn attempts per day (normally up to 4) and the forage limit of each map (normally 6) rise by this percent, rounded up. Which items appear stays as in the base game.'
    }
  };
  const changes = STEPS.map(step => ({
    LogName: `More forage in ${Object.values(LOCATIONS).join(' and ')} (+${step} %)`,
    Action: 'EditData',
    Target: 'Data/Locations',
    Fields: Object.fromEntries(Object.keys(LOCATIONS).map(key => [key, fieldsOf(step)])),
    When: { MoreForage: step }
  }));
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: schema,
      Changes: changes
    },
    ...configI18n(schema, CONFIG_EN, DE)
  };
}
