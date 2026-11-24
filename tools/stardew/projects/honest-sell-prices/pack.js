// Honest Sell Prices: the player picks the sell price of three groups of farm goods in the Content
// Patcher config, each on its own: crops, animal products and artisan goods with a fixed price.
// Every group has the levels 75 %, 100 % (default = the normal game, the pack changes nothing),
// 125 % and 150 % of the vanilla price.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Objects is a string → model lookup, "The key is the unqualified item ID", and the field
//   "Price": "The price when sold by the player. This is not the price when bought from a shop."
//   https://stardewvalleywiki.com/Modding:Objects (revision 193966)
// - The pack writes only that one field of each item with EditData "Fields" ("The key for each
//   field is ... the field name for an object"; the documented example edits one field of a
//   Data/Objects entry by its ID), Content Patcher action-editdata.md. Name, category, edibility,
//   texture and everything else stay as they are.
// - Shipping bin and shops pay the same: "The amount of gold received from shipping is the same as
//   when selling to a merchant." https://stardewvalleywiki.com/Shipping (revision 193038). So the
//   new price counts for both, for Pierre buying crops as much as for the bin.
// - There is no documented global or per-category sell price modifier for the shipping bin in 1.6.
//   Data/Shops "PriceModifiers" are "applied to the sell price for items in this shop" (the price a
//   shop asks from the player) and "SalableItemTags" only says which items a shop buys
//   (https://stardewvalleywiki.com/Modding:Shops, revision 195385); Data/Machines "PriceModifiers"
//   only change machine output (https://stardewvalleywiki.com/Modding:Machines, revision 191352).
//   So the price of each item is set on its own, from the vanilla prices in the tables below.
// - Each level is one patch per group, chosen with "When" on its config field (author-guide/
//   config.md: ConfigSchema with AllowValues/Default; author-guide.md#conditions). Level 100 has no
//   patch. New price = vanilla price × level, rounded to whole gold, at least 1g.
// - Professions still apply on top, the game multiplies the item's price: Tiller "Crops worth 10%
//   more" (vegetables, flowers, fruit that was not foraged), Rancher "Animal products worth 20%
//   more", Artisan "Artisan goods worth 40% more" (https://stardewvalleywiki.com/Farming/Skill,
//   revision 190383; categories in https://stardewvalleywiki.com/Modding:Items, revision 193945,
//   "Categories"). Quality (silver ×1.25, gold ×1.5, iridium ×2) and the multiplayer profit margin
//   apply as before.
// - Flavoured artisan goods have no price of their own: Wine "3 × Fruit Base Price", Juice "2.25 ×
//   Ingredient Base Price" (https://stardewvalleywiki.com/Keg, revision 195253), Jelly and Pickles
//   "2 × Base Ingredient Price + 50", Aged Roe "2 × Base Roe Price"
//   (https://stardewvalleywiki.com/Preserves_Jar, revision 195389), Dried Fruit and Dried Mushrooms
//   "7.5 × Base Price + 25" (https://stardewvalleywiki.com/Dehydrator, revision 193436), Smoked Fish
//   "2 × Fish Price" (https://stardewvalleywiki.com/Fish_Smoker, revision 194228), flower honey
//   100 + 2 × the flower's price (Tulip 160, Fairy Rose 680; https://stardewvalleywiki.com/Bee_House,
//   revision 191201). The item query FLAVORED_ITEM makes them
//   (https://stardewvalleywiki.com/Modding:Item_queries, revision 190776). So they follow the
//   price of what went in: wine, juice, jelly, pickles, dried fruit and flower honey made from the
//   crops here follow the Crops setting. They are not part of the ArtisanGoods setting, and their
//   own Data/Objects entries (Wine, Jelly … the unflavoured base items) are not touched.
//
// Groups and vanilla prices (every price also checked against the item's own wiki page, infobox
// "sellprice", revision in brackets):
// - CROPS: the harvest of every crop on https://stardewvalleywiki.com/Crops (revision 193979,
//   "Sells For" of each crop). Category vegetable, fruit or flower.
// - ANIMAL_PRODUCTS: what the farm animals produce, https://stardewvalleywiki.com/Animals (revision
//   195447, "Produces" of each animal; brown eggs are on the Egg and Large Egg pages).
// - ARTISAN_GOODS: the artisan goods with a fixed price, from the product tables of the machines on
//   https://stardewvalleywiki.com/Artisan_Goods (revision 195351): Keg, Cheese Press, Loom,
//   Mayonnaise Machine, Oil Maker, Preserves Jar (pages and revisions above, plus Cheese Press
//   183811, Loom 190254, Mayonnaise Machine 190554, Oil Maker 190486).
// Left out on purpose (LEFT_OUT below, each with its reason): 1.6 objects with text IDs that are
// not in tools/stardew/data/items.json yet (Carrot, Summer Squash, Broccoli, Powdermelon, Raisins),
// things on the Crops page that are no harvest, items a shop sells or that are made from shop goods
// at a price the setting could beat (Cactus Fruit, Oil, Vinegar), Coffee ("not considered to be an
// Artisan Good", https://stardewvalleywiki.com/Coffee, revision 184120) and the tree syrups ("do not
// benefit from the Artisan Profession, and are not included here", Artisan Goods page).
//
// Fair play (checked in the build below): nothing may be bought in a shop and sold back for more.
// - SHOPS lists every gold price a shop asks for an item of the three groups: Pierre's General
//   Store (revision 195226), JojaMart (194246), The Stardrop Saloon (194225), the Island Resort bar
//   (https://stardewvalleywiki.com/Ginger_Island, revision 195344), Oasis (184402), Krobus
//   (194307), Marnie's Ranch (195237), Pierre's booth at the Luau (187204). Checked and without such
//   items: Fish Shop, Blacksmith, Dwarf, Volcano Dungeon, Adventurer's Guild, Carpenter's Shop,
//   Wizard's Tower, Harvey's Clinic, Ice Cream Stand, Bookseller, the festivals (Egg Festival,
//   Flower Dance, Dance of the Moonlight Jellies, Stardew Valley Fair, Spirit's Eve, Festival of
//   Ice, Feast of the Winter Star, Trout Derby, SquidFest, Night Market) and the Desert Festival
//   (sells for Calico Eggs). Island Trader and Desert Trader only trade items for items.
// - For each item, the highest sell price at a level (with the profession bonus of its group, at
//   normal quality, which is what shops sell) must stay below every shop price for it. Where it
//   would not, the price is capped just below (CAP). Today that is only Beer: Gus sells it for 400g,
//   so at 150 % Beer goes to 285g (× 1.4 = 399g) instead of 300g.
// - The Traveling Cart asks "a random value between 100–1000, or 3–5 times the item's normal sell
//   price, whichever is higher" (https://stardewvalleywiki.com/Modding:Common_data_field_types,
//   revision 190068; Traveling Cart page, revision 192698: limited quantities, normal quality). That
//   price follows the new price, and 3 × price is always above price × 1.4, so nothing bought there
//   can be sold back for more.
// - Shop goods that machines turn into goods of these groups: Rice (Pierre 200g) gives 2 Vinegar
//   (https://stardewvalleywiki.com/Vinegar, revision 192677), Sunflower Seeds (JojaMart 125g,
//   Pierre 200g) give Oil (https://stardewvalleywiki.com/Oil, revision 190659), so both stay out.
//   Krobus' Void Egg (5,000g) and Marnie's Golden Egg (100,000g) make mayonnaise worth far less.
//   Cactus Fruit (Sandy, 150g) already makes more valuable wine and jelly in the normal game; the
//   pack keeps its price as it is, so that does not grow.

import { CONFIG_DE } from './de.js';

// Config field → { bonus: highest profession multiplier for the group, items: name → vanilla price }
export const GROUPS = {
  Crops: {
    bonus: 1.1, // Tiller
    items: {
      // Spring
      'Blue Jazz': 50, Cauliflower: 175, Garlic: 60, 'Green Bean': 40, Kale: 110, Parsnip: 35, Potato: 80,
      Rhubarb: 220, Strawberry: 120, Tulip: 30, 'Unmilled Rice': 30,
      // Summer
      Blueberry: 50, Corn: 50, Hops: 25, 'Hot Pepper': 40, Melon: 250, Poppy: 140, Radish: 90, 'Red Cabbage': 260,
      Starfruit: 750, 'Summer Spangle': 90, Sunflower: 80, Tomato: 60, Wheat: 25,
      // Fall
      Amaranth: 150, Artichoke: 160, Beet: 100, 'Bok Choy': 80, Cranberries: 75, Eggplant: 60, 'Fairy Rose': 290,
      Grape: 80, Pumpkin: 320, Yam: 160,
      // Special
      'Ancient Fruit': 550, Pineapple: 300, 'Taro Root': 100, 'Sweet Gem Berry': 3000, 'Tea Leaves': 50
    }
  },
  AnimalProducts: {
    bonus: 1.2, // Rancher
    items: {
      Egg: 50, 'Brown Egg': 50, 'Large Egg': 95, 'Large Brown Egg': 95, 'Void Egg': 65, 'Golden Egg': 500,
      'Duck Egg': 95, 'Duck Feather': 250, Wool: 340, "Rabbit's Foot": 565, 'Dinosaur Egg': 350, 'Ostrich Egg': 600,
      Milk: 125, 'Large Milk': 190, 'Goat Milk': 225, 'Large Goat Milk': 345, Truffle: 625
    }
  },
  ArtisanGoods: {
    bonus: 1.4, // Artisan
    items: {
      Beer: 200, 'Pale Ale': 300, Mead: 300, 'Green Tea': 100, Cheese: 230, 'Goat Cheese': 400, Cloth: 470,
      Mayonnaise: 190, 'Duck Mayonnaise': 375, 'Void Mayonnaise': 275, 'Dinosaur Mayonnaise': 800,
      'Truffle Oil': 1065, Caviar: 500
    }
  }
};

// Every section of the Crops page (revision 193979) is either in Crops above or here, and so is every
// artisan good of the machine tables with a fixed price.
export const LEFT_OUT = {
  Carrot: '1.6 object with a text ID, not in items.json yet',
  'Summer Squash': '1.6 object with a text ID, not in items.json yet',
  Broccoli: '1.6 object with a text ID, not in items.json yet',
  Powdermelon: '1.6 object with a text ID, not in items.json yet',
  Raisins: '1.6 object with a text ID, not in items.json yet',
  'Coffee Bean': 'it is the seed itself; Coffee is no artisan good',
  Fiber: 'a resource, not a harvest',
  'Mixed Seeds': 'seeds',
  'Mixed Flower Seeds': 'seeds',
  'Wild Seeds': 'seeds of forage plants',
  'Cactus Fruit': 'Sandy sells it for 150g and its wine already sells for more',
  Oil: 'Pierre sells it for 200g, JojaMart sells Sunflower Seeds (one Oil each) for 125g',
  Vinegar: 'Pierre sells it for 200g and Rice (two Vinegar) for 200g',
  Coffee: 'not an artisan good; Gus sells it for 300g'
};

// Gold prices shops ask for items of the groups (sources in the header). [shop, price]
export const SHOPS = {
  Beer: [['The Stardrop Saloon', 400], ['Island Resort bar', 500]],
  'Pale Ale': [['Island Resort bar', 1000]],
  Mead: [['Island Resort bar', 800]],
  'Void Egg': [['Krobus', 5000]],
  'Golden Egg': [["Marnie's Ranch", 100000]],
  Starfruit: [["Pierre's booth at the Luau", 3000]]
};
// Documented results of the checks, so a change of tables or levels cannot pass unnoticed.
export const EXPECTED_CAPS = { ArtisanGoods: { 150: { Beer: 285 } } };

export const LEVELS = { 75: 0.75, 100: 1, 125: 1.25, 150: 1.5 };
export const DEFAULT = '100';

export const priceOf = (vanilla, share) => Math.max(1, Math.round(vanilla * share));
// The highest price that, with the bonus, stays below a shop price.
export const capOf = (shopPrice, bonus) => Math.ceil(shopPrice / bonus) - 1;

// Config texts: English (the description is the ConfigSchema Description), German in de.js.
export const CONFIG = {
  Crops: {
    AllowValues: Object.keys(LEVELS).join(', '),
    Default: DEFAULT,
    Description: 'Sell price of crops (vegetables, fruit and flowers from the field) in percent of the normal price. Wine, juice, jelly, pickles, dried fruit and flower honey take their price from the crop and change with it. 100 is the normal game.'
  },
  AnimalProducts: {
    AllowValues: Object.keys(LEVELS).join(', '),
    Default: DEFAULT,
    Description: "Sell price of animal products (eggs, milk, wool, duck feathers, rabbit's feet, truffles) in percent of the normal price. Cheese and mayonnaise are artisan goods and have their own setting. 100 is the normal game."
  },
  ArtisanGoods: {
    AllowValues: Object.keys(LEVELS).join(', '),
    Default: DEFAULT,
    Description: 'Sell price of artisan goods with a fixed price (cheese, mayonnaise, cloth, beer, pale ale, mead, green tea, truffle oil, caviar) in percent of the normal price. Beer stays below the 400g Gus asks for it. Wine, juice, jelly, pickles, honey and dried fruit take their price from what went in. 100 is the normal game.'
  }
};
const LABELS = { 75: '75 %', 100: '100 % (normal)', 125: '125 %', 150: '150 %' };
export const CONFIG_TEXT = {
  Crops: { name: 'Crop prices', values: LABELS },
  AnimalProducts: { name: 'Animal product prices', values: LABELS },
  ArtisanGoods: { name: 'Artisan goods prices', values: LABELS }
};
const LOG_NAMES = { Crops: 'Crop', AnimalProducts: 'Animal product', ArtisanGoods: 'Artisan goods' };

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

// → { field: { level: { name: { vanilla, price, capped } } } } for every level but 100
export function priceTable() {
  const out = {};
  for (const [field, group] of Object.entries(GROUPS)) {
    out[field] = {};
    for (const [level, share] of Object.entries(LEVELS)) {
      if (share === 1) continue;
      const prices = {};
      for (const [name, vanilla] of Object.entries(group.items)) {
        let price = priceOf(vanilla, share);
        let capped = false;
        for (const [, shopPrice] of SHOPS[name] || []) {
          const cap = capOf(shopPrice, group.bonus);
          if (cap < vanilla) throw new Error(`${name}: ${shopPrice}g in a shop is already below its vanilla price × ${group.bonus}`);
          if (price > cap) { price = cap; capped = true; }
        }
        prices[name] = { vanilla, price, capped };
      }
      out[field][level] = prices;
    }
  }
  return out;
}

export default async function ({ items }) {
  const ids = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)\d+$/.test(id)) (ids[name] ||= []).push(id);
  const idOf = name => {
    const found = ids[name] || [];
    if (found.length !== 1) throw new Error(`${name}: ${found.length ? `several IDs (${found.join(', ')})` : 'not in items.json'}`);
    return found[0].slice(3); // Data/Objects keys are unqualified
  };

  // tables
  if (!(DEFAULT in LEVELS) || LEVELS[DEFAULT] !== 1) throw new Error('the default must be the normal game (100)');
  for (const [level, share] of Object.entries(LEVELS)) if (Math.round(share * 100) !== Number(level) || share < 0.5 || share > 1.5) throw new Error(`level ${level}: ${share}`);
  const seen = new Set();
  for (const [field, group] of Object.entries(GROUPS)) {
    if (!CONFIG[field] || !CONFIG_TEXT[field] || !CONFIG_DE[field]) throw new Error(`${field}: config text missing`);
    if (![1.1, 1.2, 1.4].includes(group.bonus)) throw new Error(`${field}: ${group.bonus} is not a documented profession bonus`);
    for (const [name, price] of Object.entries(group.items)) {
      if (seen.has(name)) throw new Error(`${name} is in two groups`);
      seen.add(name);
      if (LEFT_OUT[name]) throw new Error(`${name} is left out and in ${field}`);
      if (!(Number.isInteger(price) && price > 0)) throw new Error(`${name}: price ${price}`);
      idOf(name);
    }
  }
  for (const name of Object.keys(SHOPS)) if (!seen.has(name)) throw new Error(`${name}: shop price for an item of no group`);

  // prices and the fair-play checks
  const table = priceTable();
  const caps = {};
  for (const [field, levels] of Object.entries(table)) {
    const { bonus } = GROUPS[field];
    for (const [level, prices] of Object.entries(levels)) {
      for (const [name, { vanilla, price, capped }] of Object.entries(prices)) {
        if (LEVELS[level] < 1 && !(price <= vanilla)) throw new Error(`${name} at ${level} %: ${price}g is not below vanilla ${vanilla}g`);
        if (LEVELS[level] > 1 && !(price >= vanilla)) throw new Error(`${name} at ${level} %: ${price}g is below vanilla ${vanilla}g`);
        for (const [shop, shopPrice] of SHOPS[name] || []) if (!(price * bonus < shopPrice)) throw new Error(`${name} at ${level} %: sells for ${price * bonus}g, ${shop} sells it for ${shopPrice}g`);
        // Traveling Cart: at least 3 × the (new) price
        if (!(3 * price > price * bonus)) throw new Error(`${name}: the Traveling Cart price rule no longer protects it`);
        if (capped) ((caps[field] ||= {})[level] ||= {})[name] = price;
      }
    }
    // the levels never cross
    const order = Object.keys(LEVELS).filter(l => LEVELS[l] !== 1).sort((a, b) => a - b);
    for (const name of Object.keys(GROUPS[field].items)) {
      for (let i = 1; i < order.length; i++) if (levels[order[i]][name].price < levels[order[i - 1]][name].price) throw new Error(`${name}: ${order[i]} % is cheaper than ${order[i - 1]} %`);
    }
  }
  if (JSON.stringify(caps) !== JSON.stringify(EXPECTED_CAPS)) throw new Error(`capped prices ${JSON.stringify(caps)}, expected ${JSON.stringify(EXPECTED_CAPS)}`);

  const changes = [];
  for (const [field, levels] of Object.entries(table)) {
    for (const [level, prices] of Object.entries(levels)) {
      const fields = {};
      for (const [name, { price }] of Object.entries(prices)) fields[idOf(name)] = { Price: price };
      changes.push({
        LogName: `${LOG_NAMES[field]} sell prices at ${level} %`,
        Action: 'EditData',
        Target: 'Data/Objects',
        Fields: fields,
        When: { [field]: level }
      });
    }
  }

  const en = {};
  for (const field of Object.keys(CONFIG)) en[field] = { ...CONFIG_TEXT[field], description: CONFIG[field].Description };
  const i18n = configKeys(CONFIG, en, 'English');
  const de = configKeys(CONFIG, CONFIG_DE, 'German');
  for (const field of Object.keys(CONFIG)) {
    for (const n of CONFIG[field].Description.match(/\d+/g) || []) if (!CONFIG_DE[field].description.includes(n)) throw new Error(`de.js: ${field}: the German description lacks ${n}`);
    for (const v of Object.keys(LEVELS)) if (!de[`config.${field}.values.${v}`].startsWith(`${v} %`)) throw new Error(`German label of ${field} ${v} must start with ${v} %`);
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
