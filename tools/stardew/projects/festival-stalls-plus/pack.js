// Festival Stalls Plus: the festival booths sell a few more fitting goods: seeds for the rest of the
// season (Pierre's shop is closed on most festival days), seasonal flowers and festive food. Every
// item is one the player can get in the game anyway; the vanilla stock of each booth stays as it is.
// Since 1.1 the magic shop boat of the Night Market sells a little winter forage and a few beach finds
// too, one small selection per night. Since 1.2 the player picks how much the booths charge for
// these goods: Fair, Normal (default) or Steep.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Shops holds the festival shops; their IDs are listed under "And the main festival shops"
//   on https://stardewvalleywiki.com/Modding:Shops (revision 195385). "Items" is a list of entries
//   with the item spawn fields Id, ItemId plus Price ("The gold price to purchase the item from the
//   shop"), AvailableStock ("The maximum number of the item which can be purchased in one day") and
//   AvailableStockLimit ("Player": "The limit applies to each player separately").
//   https://stardewvalleywiki.com/Modding:Item_queries#Item_spawn_fields
// - The pack adds its entries with EditData, TargetField [<shop ID>, "Items"] and Entries keyed by
//   its own Id, so no vanilla entry is replaced (the Modding:Shops example edits a shop's Items list
//   exactly like this; Content Patcher action-editdata.md, "Edit a list" and "Target field"). New
//   entries go to the bottom of the booth's list.
// - No Condition: a festival shop only opens at its festival.
// - Prices:
//   seeds: Pierre's own shop price (https://stardewvalleywiki.com/Crops, "Pierre's" price per seed,
//     revision 193979; the same as https://stardewvalleywiki.com/Pierre%27s_General_Store,
//     revision 195226). Pierre's shop is locked on the day of every festival that starts before
//     7pm (https://stardewvalleywiki.com/Festivals, "Shop Closures", revision 194215).
//   goods: a multiple of the sell price, rounded up to 10g. The booths' own everyday goods sell
//     between 0.83× and 1.67× their sell price (ANCHORS below); the default 1.5× is inside that range.
//     Since 1.2 the player picks the multiple in the config (see "Price levels" below).
//     Sell prices: the {{tprice|<sell price>}} values on https://stardewvalleywiki.com/Traveling_Cart
//     (revision 192698; Module:Tcartprice multiplies that value by 3–5, so it is the sell price).
//   Goods are limited to 10 per player and day (like the Flower Dance's "Daffodil (10)"), seeds are
//   unlimited like in Pierre's shop.
// - Seeds are only offered if the crop can still be harvested this season when planted on the
//   festival day (growth days from the Crops page); at the Dance of the Moonlight Jellies (the last
//   day of summer) the booth sells fall seeds for planting on fall 1.
//
// Festival dates: Festivals page (revision 194215). Booth stock (vanilla, used to avoid
// duplicates): Egg Festival (192059), Flower Dance (194047), Luau (187204), Dance of the Moonlight
// Jellies (184308), Spirit's Eve (192510), Festival of Ice (192452), Feast of the Winter Star
// (179976), each page's "Shop" section.
//
// 1.1, the Night Market (winter 15 to 17, https://stardewvalleywiki.com/Night_Market, revision
// 195534): its magic shop boat has one shop per night, Festival_NightMarket_MagicBoat_Day1 to _Day3
// (Modding:Shops, same list as above), and sells for gold ({{Price|…}} on the Night Market page).
// Each night gets one winter forage item and one beach find, as goods under the same rules (1.5 ×
// the sell price, 10 per player and day). No seeds: the boat already sells every seed Pierre has for
// spring, summer and fall (one season per night), and nothing planted on a winter day can be
// harvested outdoors, which the seed rule above requires. Coral, Sea Urchin and Nautilus Shell are
// beach forage, not fish, so the Fisher/Angler bonus ("Fish worth 25/50% more",
// https://stardewvalleywiki.com/Fishing/Skill, revision 190353) does not raise their sell price.
//
// 1.2, price levels: a config option "Prices" (author-guide/config.md: ConfigSchema with AllowValues
// and Default) selects the multiple for every added good: Fair 1.25×, Normal 1.5× (default, the
// prices of 1.0 and 1.1), Steep 2×. Each level is its own set of patches with "When": { "Prices":
// <level> } (author-guide.md#conditions), like Machine Tempo. Seeds keep Pierre's price at every
// level (their rule is his shop price, not the sell price), and the booths' own stock is untouched.
// The floor is 1.25×, so nothing bought here can be sold back at a profit, professions included.
// Which sell bonuses can apply is set by the item category ("Properties" column of the category
// table on https://stardewvalleywiki.com/Modding:Items, revision 193945): Rancher for animal products
// (-5, -6, -18), Tiller for vegetables, fruits (if not foraged) and flowers (-75, -79, -80), Artisan
// (-26) and Tapper (-27) for artisan goods, Fisher/Angler for fish (-4), Gemologist for minerals;
// cooking (-7), seeds (-74) and forage greens (-81) get none. KIND_BONUS below gives each good the
// highest bonus its kind can get:
//   Egg: Rancher +20 % (the Farming page with the profession text is not in the cache; the in-game
//     text is "Animal products worth 20% more"; at Fair the Egg costs 70g = 1.4×, so even a bonus
//     up to 40 % would not make a profit);
//   flowers, crops and winter forage: Tiller +10 % at most ("+10% Tiller profession",
//     https://stardewvalleywiki.com/Blackberry, revision 193839; foraged fruit not even that,
//     https://stardewvalleywiki.com/Grape, revision 192072);
//   dishes and Winter Seeds: none;
//   Coral and Sea Urchin: none, they are "considered forage and not fish"
//     (https://stardewvalleywiki.com/Fish_Pond, revision 194160), and Nautilus Shell is not on the
//     list of fish (https://stardewvalleywiki.com/Fish, revision 195502), so Fisher (+25 %) and
//     Angler (+50 %, https://stardewvalleywiki.com/Fishing/Skill) do not apply.
//   No good here is an artisan good, so Artisan (+40 %) does not apply either. The highest bonus is
//   Rancher's 20 % on the Egg, below the 1.25× floor; the build checks every good at every level.
//
// 1.3, config texts: the config menu shows a readable name, description and value labels, in
// English (i18n/default.json) and German (i18n/de.json, texts in de.js). Content Patcher reads the
// keys config.<field>.name, config.<field>.description and config.<field>.values.<value> itself
// (author-guide/config.md, "Translations"); the ConfigSchema Description stays as it is and is the
// English description. Nothing else changes.
//
// Left out on purpose: the Stardew Valley Fair (Festival_StardewValleyFair_StarTokens sells for
// star tokens, which have no gold value to price against), the Desert Festival (its egg merchant
// DesertFestival_EggShop and the villager shops DesertFestival_<name> sell for Calico Eggs, the
// festival's own currency that "sell[s] for 0g", https://stardewvalleywiki.com/Desert_Festival,
// revision 195409: no gold value either), the Night Market's decoration boat (decorations only),
// furniture and hats (only (O) objects can be checked here).

import { configDe } from './de.js';

const SEASONS = ['spring', 'summer', 'fall', 'winter'];
export const SEASON_DAYS = 28;

// shop ID (Modding:Shops) → festival, date, the booth's vanilla objects (each page's "Shop"
// section) and what this pack adds
export const STALLS = {
  Festival_EggFestival_Pierre: {
    festival: 'Egg Festival', season: 'spring', day: 13,
    vanilla: ['Strawberry Seeds'],
    add: ['Egg', 'Potato Seeds', 'Cauliflower Seeds']
  },
  Festival_FlowerDance_Pierre: {
    festival: 'Flower Dance', season: 'spring', day: 24,
    vanilla: ['Daffodil', 'Dandelion'],
    add: ['Tulip', 'Blue Jazz']
  },
  Festival_Luau_Pierre: {
    festival: 'Luau', season: 'summer', day: 11,
    vanilla: ['Starfruit'],
    add: ['Melon Seeds', 'Blueberry Seeds', 'Pepper Seeds']
  },
  Festival_DanceOfTheMoonlightJellies_Pierre: {
    festival: 'Dance of the Moonlight Jellies', season: 'summer', day: 28,
    vanilla: ['Seafoam Pudding'],
    add: ['Pumpkin Seeds', 'Cranberry Seeds', 'Eggplant Seeds']
  },
  Festival_SpiritsEve_Pierre: {
    festival: "Spirit's Eve", season: 'fall', day: 27,
    vanilla: ['Jack-O-Lantern'],
    add: ['Pumpkin', 'Pumpkin Pie', 'Cranberry Candy']
  },
  Festival_FestivalOfIce_TravelingMerchant: {
    festival: 'Festival of Ice', season: 'winter', day: 8,
    vanilla: ['Cranberry Sauce', 'Stuffing', 'Pumpkin Soup'],
    add: ['Chowder', 'Fish Stew', 'Winter Seeds']
  },
  Festival_FeastOfTheWinterStar_Pierre: {
    festival: 'Feast of the Winter Star', season: 'winter', day: 25,
    vanilla: ['Triple Shot Espresso', 'Powdermelon', 'Garlic', 'Fire Quartz', 'Frozen Tear', 'Fried Mushroom', 'Duck Egg', 'Bread', 'Cave Carrot', 'Perch', 'Clam', 'Winter Root'],
    add: ['Plum Pudding', 'Cookie', 'Holly']
  },
  // 1.1: the Night Market's magic shop boat, one shop per night (vanilla objects: the seeds of
  // each night's "Permanent Stock" table on the Night Market page; the rest are decorations, hats,
  // furniture and big craftables)
  Festival_NightMarket_MagicBoat_Day1: {
    festival: 'Night Market (night 1)', season: 'winter', day: 15,
    vanilla: ['Parsnip Seeds', 'Bean Starter', 'Cauliflower Seeds', 'Potato Seeds', 'Tulip Bulb', 'Kale Seeds', 'Jazz Seeds', 'Garlic Seeds'],
    add: ['Crystal Fruit', 'Coral']
  },
  Festival_NightMarket_MagicBoat_Day2: {
    festival: 'Night Market (night 2)', season: 'winter', day: 16,
    vanilla: ['Melon Seeds', 'Tomato Seeds', 'Blueberry Seeds', 'Pepper Seeds', 'Wheat Seeds', 'Radish Seeds', 'Poppy Seeds', 'Spangle Seeds', 'Hops Starter', 'Corn Seeds', 'Sunflower Seeds', 'Red Cabbage Seeds'],
    add: ['Snow Yam', 'Sea Urchin']
  },
  Festival_NightMarket_MagicBoat_Day3: {
    festival: 'Night Market (night 3)', season: 'winter', day: 17,
    vanilla: ['Corn Seeds', 'Eggplant Seeds', 'Pumpkin Seeds', 'Bok Choy Seeds', 'Yam Seeds', 'Cranberry Seeds', 'Wheat Seeds', 'Fairy Seeds', 'Amaranth Seeds', 'Grape Starter', 'Sunflower Seeds', 'Artichoke Seeds'],
    add: ['Crocus', 'Nautilus Shell']
  }
};
// The festival shop IDs listed on Modding:Shops (revision 195385) that this pack may edit.
export const DOCUMENTED_SHOPS = [
  'Festival_EggFestival_Pierre', 'Festival_FlowerDance_Pierre', 'Festival_Luau_Pierre',
  'Festival_DanceOfTheMoonlightJellies_Pierre', 'Festival_SpiritsEve_Pierre',
  'Festival_FestivalOfIce_TravelingMerchant', 'Festival_FeastOfTheWinterStar_Pierre',
  'Festival_NightMarket_MagicBoat_Day1', 'Festival_NightMarket_MagicBoat_Day2', 'Festival_NightMarket_MagicBoat_Day3'
];
// Shops that do not sell for gold (the Fair: star tokens; the Desert Festival: Calico Eggs) or sell
// no objects (the decoration boat): never touched.
export const NOT_TOUCHED = ['Festival_StardewValleyFair_StarTokens', 'DesertFestival_EggShop', 'Festival_NightMarket_DecorationBoat'];
export const NOT_TOUCHED_PREFIX = 'DesertFestival_';

// seed → [Pierre's price, growth days, crop seasons] (Crops page, revision 193979)
export const SEEDS = {
  'Potato Seeds': [50, 6, ['spring']],
  'Cauliflower Seeds': [80, 12, ['spring']],
  'Melon Seeds': [80, 12, ['summer']],
  'Blueberry Seeds': [80, 13, ['summer']],
  'Pepper Seeds': [40, 5, ['summer']],
  'Pumpkin Seeds': [100, 13, ['fall']],
  'Cranberry Seeds': [240, 7, ['fall']],
  'Eggplant Seeds': [20, 5, ['fall']]
};

// goods → sell price (Traveling Cart page, revision 192698)
export const GOODS = {
  Egg: 50, Tulip: 30, 'Blue Jazz': 50, Pumpkin: 320, 'Pumpkin Pie': 385, 'Cranberry Candy': 175,
  Chowder: 135, 'Fish Stew': 175, 'Winter Seeds': 30, 'Plum Pudding': 260, Cookie: 140, Holly: 80,
  // 1.1, Night Market
  'Crystal Fruit': 150, Coral: 80, 'Snow Yam': 100, 'Sea Urchin': 160, Crocus: 60, 'Nautilus Shell': 120
};

// the booths' own everyday goods: name → [booth price, sell price] (festival pages; sell prices
// from the Traveling Cart page). Single luxury items like the Luau's Starfruit are not anchors.
export const ANCHORS = {
  Daffodil: [50, 30],
  Dandelion: [50, 40],
  'Cranberry Sauce': [200, 120],
  Stuffing: [200, 165],
  'Pumpkin Soup': [250, 300]
};

// 1.2: config value → multiple of the sell price for the goods (seeds keep Pierre's price)
export const PRICE_LEVELS = { Fair: 1.25, Normal: 1.5, Steep: 2 };
export const DEFAULT_LEVEL = 'Normal'; // = the 1.5× of 1.0 and 1.1
export const MIN_MARKUP = 1.25; // floor: above every sell bonus a profession gives these goods (KIND_BONUS)
export const MAX_MARKUP = 2;
export const MARKUP = PRICE_LEVELS[DEFAULT_LEVEL];

// the highest profession sell bonus each kind of good can get (Modding:Items category table, see above)
export const KIND_BONUS = { animal: 0.2, plant: 0.1, dish: 0, seeds: 0, beach: 0 };
export const KIND = {
  Egg: 'animal',
  Tulip: 'plant', 'Blue Jazz': 'plant', Pumpkin: 'plant', Holly: 'plant', 'Crystal Fruit': 'plant', 'Snow Yam': 'plant', Crocus: 'plant',
  'Pumpkin Pie': 'dish', 'Cranberry Candy': 'dish', Chowder: 'dish', 'Fish Stew': 'dish', 'Plum Pudding': 'dish', Cookie: 'dish',
  'Winter Seeds': 'seeds',
  Coral: 'beach', 'Sea Urchin': 'beach', 'Nautilus Shell': 'beach'
};

export const GOODS_STOCK = 10;
export const priceOfGoods = (sell, markup = MARKUP) => Math.ceil(sell * markup / 10) * 10;
export const priceOf = (name, markup = MARKUP) => (SEEDS[name] ? SEEDS[name][0] : priceOfGoods(GOODS[name], markup));

export const keyOf = name => name.replace(/[^A-Za-z]/g, '');

// 1.3: English config texts (the description is the ConfigSchema Description); German in de.js.
export const CONFIG_EN = {
  Prices: { name: 'Prices', values: { Fair: 'Fair', Normal: 'Normal', Steep: 'Steep' } }
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

// the season and day the seeds are planted: the festival day, or fall 1 after the last summer day
export function plantingDay({ season, day }) {
  if (day < SEASON_DAYS) return { season, day };
  return { season: SEASONS[(SEASONS.indexOf(season) + 1) % 4], day: 1 };
}

export default async function ({ items }) {
  const idOf = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)\d+$/.test(id)) idOf[name] = id;
  const ratios = Object.values(ANCHORS).map(([price, sell]) => price / sell);
  if (!(DEFAULT_LEVEL in PRICE_LEVELS)) throw new Error(`default ${DEFAULT_LEVEL} is not a price level`);
  if (!(MARKUP >= Math.min(...ratios) && MARKUP <= Math.max(...ratios))) throw new Error(`default markup ${MARKUP} is outside the booths' own range`);
  for (const [level, markup] of Object.entries(PRICE_LEVELS)) {
    if (!/^[A-Z][a-z]+$/.test(level)) throw new Error(`price level "${level}"`);
    if (!(markup >= MIN_MARKUP && markup <= MAX_MARKUP)) throw new Error(`${level}: ${markup}× is outside ${MIN_MARKUP}× to ${MAX_MARKUP}×`);
  }
  if (!(MIN_MARKUP > 1 + Math.max(...Object.values(KIND_BONUS)))) throw new Error('the floor is not above every profession bonus');
  for (const name of Object.keys(ANCHORS)) if (!idOf[name]) throw new Error(`anchor ${name} is not in items.json`);
  for (const name of Object.keys(GOODS)) if (!(KIND[name] in KIND_BONUS)) throw new Error(`${name}: no kind for the profession check`);
  for (const name of Object.keys(KIND)) if (!(name in GOODS)) throw new Error(`${name}: kind without a good`);

  const used = new Set();
  const stalls = [];
  const changes = [];
  for (const [shop, stall] of Object.entries(STALLS)) {
    if (NOT_TOUCHED.includes(shop) || shop.startsWith(NOT_TOUCHED_PREFIX)) throw new Error(`${shop} must stay vanilla`);
    if (!DOCUMENTED_SHOPS.includes(shop)) throw new Error(`${shop} is not a documented festival shop ID`);
    if (!SEASONS.includes(stall.season) || !(stall.day >= 1 && stall.day <= SEASON_DAYS)) throw new Error(`${shop}: date`);
    if (!(stall.add.length >= 2 && stall.add.length <= 3)) throw new Error(`${shop}: ${stall.add.length} items`);
    const entries = {};
    for (const name of stall.add) {
      if (!idOf[name]) throw new Error(`${name} is not in items.json`);
      if (stall.vanilla.includes(name)) throw new Error(`${shop} already sells ${name}`);
      if (!!SEEDS[name] === (name in GOODS)) throw new Error(`${name} must be either seeds or goods`);
      if (SEEDS[name]) {
        const [price, days, seasons] = SEEDS[name];
        const plant = plantingDay(stall);
        if (!seasons.includes(plant.season)) throw new Error(`${shop}: ${name} cannot be planted in ${plant.season}`);
        if (plant.day + days > SEASON_DAYS) throw new Error(`${shop}: ${name} needs ${days} days, planted on ${plant.season} ${plant.day}`);
        if (!(Number.isInteger(price) && price > 0)) throw new Error(`${name}: price ${price}`);
      } else {
        const sell = GOODS[name];
        if (!(Number.isInteger(sell) && sell > 0)) throw new Error(`${name}: sell price ${sell}`);
        for (const [level, markup] of Object.entries(PRICE_LEVELS)) {
          const price = priceOfGoods(sell, markup);
          if (!(price >= sell * MIN_MARKUP)) throw new Error(`${name} (${level}): ${price}g for sell price ${sell}`);
          if (!(price > sell * (1 + KIND_BONUS[KIND[name]]))) throw new Error(`${name} (${level}): ${price}g could be sold back at a profit with a profession`);
        }
      }
      used.add(name);
    }
    stalls.push([shop, stall]);
  }
  for (const name of [...Object.keys(SEEDS), ...Object.keys(GOODS)]) if (!used.has(name)) throw new Error(`${name} is in a table but no booth sells it`);

  // one set of patches per price level, selected by the config (When)
  for (const [level, markup] of Object.entries(PRICE_LEVELS)) {
    for (const [shop, stall] of stalls) {
      const entries = {};
      for (const name of stall.add) {
        const id = `{{ModId}}_${keyOf(name)}`;
        entries[id] = {
          Id: id,
          ItemId: idOf[name],
          Price: priceOf(name, markup),
          ...(SEEDS[name] ? {} : { AvailableStock: GOODS_STOCK, AvailableStockLimit: 'Player' })
        };
      }
      changes.push({
        LogName: `More goods at the ${stall.festival} (${level} prices)`,
        Action: 'EditData',
        Target: 'Data/Shops',
        TargetField: [shop, 'Items'],
        Entries: entries,
        When: { Prices: level }
      });
    }
  }
  const levels = Object.entries(PRICE_LEVELS).map(([level, markup]) => `${level} ${markup}x`).join(', ');
  const schema = {
    Prices: {
      AllowValues: Object.keys(PRICE_LEVELS).join(', '),
      Default: DEFAULT_LEVEL,
      Description: `What the festival booths charge for the goods this pack adds, as a multiple of the sell price: ${levels}. Seeds always cost what Pierre asks, and the booths' own stock is not changed.`
    }
  };
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: schema,
      Changes: changes
    },
    ...configI18n(schema, CONFIG_EN, configDe({ levels: PRICE_LEVELS }))
  };
}
