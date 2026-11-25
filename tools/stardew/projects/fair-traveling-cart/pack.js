// Fair Traveling Cart: the traveling cart in Cindersap Forest gets a price cap. No object of its
// regular stock costs more than a multiple of its normal sell price; the multiple is a config
// choice (2×, 3× = default, 4×). What the cart sells, how much of it and when it comes stay vanilla.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Shops, shop "Traveler" = the traveling cart ("Vanilla shop IDs").
//   https://stardewvalleywiki.com/Modding:Shops (revision 195385)
// - Shop fields "PriceModifiers" ("Quantity modifiers applied to the sell price for items in this
//   shop") and "PriceModifierMode" ("what to do if multiple modifiers ... apply at the same time").
//   Item-level price modifiers "stack with the PriceModifiers field on the shop" (Modding:Shops,
//   Items → PriceModifiers), so the shop-level list works on the price the cart's own entries made.
// - Quantity modifiers: { Id, Modification (Add, Subtract, Multiply, Divide, Set), Amount,
//   Condition (a game state query) }; mode "Minimum" = "Apply the modifier which results in the
//   lowest value". https://stardewvalleywiki.com/Modding:Common_data_field_types#Quantity_modifiers
//   (revision 190068)
// - The cap: mode Minimum with
//     1. "{{ModId}}_KeepCartPrice": Multiply 1, no condition = the price the cart rolled itself;
//     2. one "Set <multiple × sell price>" per sell price, with Condition
//        "ITEM_ID Target <qualified IDs of the objects with that sell price>".
//   The lower of the two wins, so each listed object costs min(cart price, multiple × sell price).
//   Items that match no condition (furniture, hats, catalogues, skill books, rarecrows, portraits,
//   recipes) only get "Multiply 1" and keep their price.
// - ITEM_ID {{t|target}} {{t|item ID}}+: "Whether the item has one of the given qualified or
//   unqualified item IDs"; item queries take "Target (the machine output, tree fruit, shop item,
//   etc)" and "apply in cases where there's an item (e.g. machine recipes, shops, etc)".
//   https://stardewvalleywiki.com/Modding:Game_state_queries#For_items_only (revision 193977)
// - The two shop fields are written with EditData "Fields" on the "Traveler" entry (Content Patcher
//   action-editdata.md, "Fields"). Items, Owners, conditions, stock and every other field of the
//   shop are never written, so the cart sells the same things on the same days.
// - The multiple is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default)
//   and selects one patch through "When" (author-guide.md#conditions). Config menu texts: i18n keys
//   config.PriceCap.name / .description / .values.<value> in i18n/default.json, which Content
//   Patcher reads itself (config.md, "Translations": all keys optional, not case-sensitive). The
//   ConfigSchema Description is also the English description text.
//
// Vanilla cart pricing (what the cap works against): "a random value between 100–1000, or 3–5
// times the item's normal sell price, whichever is higher (like the Traveling Cart)"
// (Modding:Common data field types, quantity modifier example); Module:Tcartprice (revision 148797)
// renders every standard-stock price on https://stardewvalleywiki.com/Traveling_Cart (revision
// 192698) the same way (low 3 × sell price but at least 100, high 5 × sell price but at least 1000).
// So the vanilla price is never below max(100, 3 × sell): at 2× and 3× every listed object costs
// exactly 2× / 3× its sell price, at 4× it costs the cart's own roll whenever that is lower.
//
// Sell prices: the {{tprice|<sell price>}} values of the standard stock tables on the Traveling
// Cart page (revision 192698), copied below; 332 objects, all in tools/stardew/data/items.json.
// "Iridium Ore" has two sprites with that name in items.json ((O)386, (O)387); both get the cap.
//
// Left out on purpose: Rare Seed and Coffee Bean. They are also special stock with fixed prices
// (Rare Seed 1,000g, Coffee Bean 2,500g, Traveling Cart page "Special Stock"); a cap on their IDs
// would hit those entries too, so they keep the cart's price everywhere. Furniture (random
// 250–2,500g) and the special stock are not objects of the standard stock and stay vanilla.

// name → sell price (Traveling Cart page, Standard Stock tables, revision 192698)
export const SELL_PRICES = {
  // Cooked Dishes
  'Algae Soup': 100, 'Artichoke Dip': 210, "Autumn's Bounty": 350, 'Baked Fish': 100,
  'Bean Hotpot': 100, 'Blackberry Cobbler': 260, 'Blueberry Tart': 150, Bread: 60, Bruschetta: 210,
  'Carp Surprise': 150, 'Cheese Cauliflower': 300, 'Chocolate Cake': 200, Chowder: 135,
  Coleslaw: 345, 'Complete Breakfast': 350, Cookie: 140, 'Crab Cakes': 275, 'Cranberry Candy': 175,
  'Cranberry Sauce': 120, 'Crispy Bass': 150, "Dish O' The Sea": 220, 'Eggplant Parmesan': 200,
  Escargot: 125, "Farmer's Lunch": 150, 'Fiddlehead Risotto': 350, 'Fish Stew': 175,
  'Fish Taco': 500, 'Fried Calamari': 150, 'Fried Eel': 120, 'Fried Egg': 35,
  'Fried Mushroom': 200, 'Fruit Salad': 450, 'Glazed Yams': 200, Hashbrowns: 120, 'Ice Cream': 120,
  'Lobster Bisque': 205, 'Lucky Lunch': 250, 'Maki Roll': 220, 'Maple Bar': 300,
  "Miner's Treat": 200, Omelet: 125, 'Pale Broth': 150, Pancakes: 80, 'Parsnip Soup': 120,
  'Pepper Poppers': 200, 'Pink Cake': 480, Pizza: 300, 'Plum Pudding': 260,
  'Poppyseed Muffin': 250, 'Pumpkin Pie': 385, 'Pumpkin Soup': 300, 'Radish Salad': 300,
  'Red Plate': 400, 'Rhubarb Pie': 400, 'Rice Pudding': 260, 'Roasted Hazelnuts': 270,
  'Roots Platter': 100, Salad: 110, 'Salmon Dinner': 300, Sashimi: 75, 'Seafoam Pudding': 300,
  'Shrimp Cocktail': 160, Spaghetti: 120, 'Spicy Eel': 175, 'Stir Fry': 335, 'Strange Bun': 225,
  Stuffing: 165, 'Super Meal': 220, 'Survival Burger': 180, 'Tom Kha Soup': 250, Tortilla: 50,
  'Triple Shot Espresso': 450, 'Trout Soup': 100, 'Vegetable Medley': 120,
  // Crops & Foraging
  Amaranth: 150, Artichoke: 160, Beet: 100, 'Bok Choy': 80, Cauliflower: 175, Corn: 50,
  Eggplant: 60, 'Fiddlehead Fern': 90, Garlic: 60, 'Green Bean': 40, Hops: 25, Kale: 110,
  Parsnip: 35, Potato: 80, Pumpkin: 320, Radish: 90, 'Red Cabbage': 260, Tomato: 60,
  'Unmilled Rice': 30, Wheat: 25, Yam: 160, Apple: 100, Apricot: 50, Blackberry: 20, Blueberry: 50,
  'Cactus Fruit': 75, Cherry: 80, Coconut: 100, Cranberries: 75, 'Crystal Fruit': 150, Grape: 80,
  'Hot Pepper': 40, Melon: 250, Orange: 100, Peach: 140, Pomegranate: 140, Rhubarb: 220,
  Salmonberry: 5, 'Spice Berry': 80, Starfruit: 750, Strawberry: 120, 'Wild Plum': 80,
  'Blue Jazz': 50, Crocus: 60, 'Fairy Rose': 290, Poppy: 140, 'Summer Spangle': 90, Sunflower: 80,
  'Sweet Pea': 50, Tulip: 30, 'Cave Carrot': 25, Chanterelle: 160, 'Common Mushroom': 40,
  Daffodil: 30, Dandelion: 40, Hazelnut: 90, Holly: 80, Leek: 60, Morel: 150,
  'Purple Mushroom': 250, 'Red Mushroom': 75, Sap: 2, 'Snow Yam': 100, 'Spring Onion': 8,
  'Wild Horseradish': 50, 'Winter Root': 70,
  // Seeds & Fertilizer
  'Basic Fertilizer': 2, 'Basic Retaining Soil': 4, 'Deluxe Speed-Gro': 40,
  'Quality Fertilizer': 10, 'Quality Retaining Soil': 5, 'Speed-Gro': 20, Acorn: 20,
  'Maple Seed': 5, 'Pine Cone': 5, 'Apple Sapling': 1000, 'Apricot Sapling': 500,
  'Cherry Sapling': 850, 'Orange Sapling': 1000, 'Peach Sapling': 1500,
  'Pomegranate Sapling': 1500, 'Tea Sapling': 250, 'Amaranth Seeds': 35, 'Artichoke Seeds': 15,
  'Bean Starter': 30, 'Beet Seeds': 10, 'Blueberry Seeds': 40, 'Bok Choy Seeds': 25,
  'Cauliflower Seeds': 40, 'Coffee Bean': 15, 'Corn Seeds': 75, 'Cranberry Seeds': 120,
  'Eggplant Seeds': 10, 'Fairy Seeds': 100, 'Fall Seeds': 45, 'Garlic Seeds': 20,
  'Grape Starter': 30, 'Hops Starter': 30, 'Jazz Seeds': 15, 'Kale Seeds': 35, 'Melon Seeds': 40,
  'Parsnip Seeds': 10, 'Pepper Seeds': 20, 'Poppy Seeds': 50, 'Potato Seeds': 25,
  'Pumpkin Seeds': 50, 'Radish Seeds': 20, 'Rare Seed': 200, 'Red Cabbage Seeds': 50,
  'Rhubarb Seeds': 50, 'Rice Shoot': 20, 'Spangle Seeds': 25, 'Spring Seeds': 35,
  'Starfruit Seeds': 200, 'Summer Seeds': 55, 'Sunflower Seeds': 20, 'Tomato Seeds': 25,
  'Tulip Bulb': 10, 'Wheat Seeds': 5, 'Winter Seeds': 30, 'Yam Seeds': 30,
  // Fish & Beach Forage
  Clam: 50, Coral: 80, 'Nautilus Shell': 120, 'Rainbow Shell': 300, 'Sea Urchin': 160,
  'Joja Cola': 25, Albacore: 75, Anchovy: 30, Bream: 45, Bullhead: 75, Carp: 30, Catfish: 200,
  Chub: 50, Cockle: 50, Crab: 100, Crayfish: 75, Dorado: 100, Eel: 85, Flounder: 100,
  Ghostfish: 45, Halibut: 80, Herring: 30, 'Largemouth Bass': 100, Lingcod: 120, Lobster: 120,
  'Midnight Carp': 150, Mussel: 30, Octopus: 150, Oyster: 40, Perch: 55, Periwinkle: 20, Pike: 100,
  Pufferfish: 200, 'Rainbow Trout': 65, 'Red Mullet': 75, 'Red Snapper': 50, Salmon: 75,
  Sandfish: 75, Sardine: 40, 'Scorpion Carp': 150, 'Sea Cucumber': 75, Shad: 60, Shrimp: 60,
  'Smallmouth Bass': 50, Snail: 65, Squid: 80, Sturgeon: 200, Sunfish: 30, 'Super Cucumber': 250,
  'Tiger Trout': 150, Tilapia: 75, Tuna: 100, Walleye: 105, Woodskip: 75,
  // Artisan Goods
  Beer: 200, Caviar: 500, Cheese: 230, Cloth: 470, 'Duck Mayonnaise': 375, 'Goat Cheese': 400,
  'Green Tea': 100, Honey: 100, Jelly: 160, Juice: 150, Mayonnaise: 190, Mead: 200,
  'Pale Ale': 300, Pickles: 100, 'Truffle Oil': 1065, Wine: 400,
  // Animal Products
  'Duck Feather': 250, "Rabbit's Foot": 565, Wool: 340, 'Duck Egg': 95, Egg: 50, 'Large Egg': 95,
  'Goat Milk': 225, 'Large Goat Milk': 345, Milk: 125, 'Large Milk': 190, Truffle: 625,
  // Crafting
  Bomb: 50, 'Brick Floor': 1, 'Cherry Bomb': 50, 'Cobblestone Path': 1, 'Crystal Floor': 1,
  'Crystal Path': 1, Gate: 4, 'Gravel Path': 1, 'Hardwood Fence': 10, 'Iron Fence': 6,
  'Life Elixir': 500, 'Mega Bomb': 50, 'Oil of Garlic': 1000, 'Quality Sprinkler': 450,
  Sprinkler: 100, 'Stepping Stone Path': 1, 'Stone Fence': 2, 'Stone Floor': 1, 'Straw Floor': 1,
  'Weathered Floor': 1, 'Wood Fence': 1, 'Wood Floor': 1, 'Wood Path': 1,
  // Resources
  Coal: 15, 'Copper Bar': 60, 'Copper Ore': 5, 'Gold Bar': 250, 'Gold Ore': 25,
  'Iridium Bar': 1000, 'Iridium Ore': 100, 'Iron Bar': 120, 'Iron Ore': 10, 'Refined Quartz': 50,
  'Battery Pack': 500, Clay: 20, Fiber: 1, Hardwood: 15, Stone: 2, Wood: 2,
  // Tapper Products
  'Maple Syrup': 200, 'Oak Resin': 150, 'Pine Tar': 100,
  // Bait & Tackle
  Bait: 1, Magnet: 15, 'Barbed Hook': 500, 'Cork Bobber': 250, 'Dressed Spinner': 500,
  'Lead Bobber': 150, Spinner: 250, 'Trap Bobber': 200, 'Treasure Hunter': 250,
  // Monster Loot
  'Bat Wing': 15, 'Bug Meat': 8, Slime: 5, 'Solar Essence': 40, 'Void Essence': 50
};
export const STANDARD_STOCK_COUNT = 332;

// Also special stock with a fixed price (Traveling Cart page, "Special Stock"): never capped.
export const SPECIAL_STOCK = { 'Rare Seed': 1000, 'Coffee Bean': 2500 };

// Vanilla price rule (Modding:Common data field types example, Module:Tcartprice).
export const VANILLA = { set: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], multiply: [3, 4, 5] };
export const vanillaMin = sell => Math.max(Math.min(...VANILLA.set), sell * Math.min(...VANILLA.multiply));
export const vanillaMax = sell => Math.max(Math.max(...VANILLA.set), sell * Math.max(...VANILLA.multiply));

// Config values (the multiple of the sell price, compared as text) → multiple.
export const CAPS = ['2', '3', '4'];
export const DEFAULT = '3';
export const capOf = (sell, cap) => sell * Number(cap);

export const CONFIG = {
  PriceCap: {
    AllowValues: CAPS.join(', '),
    Default: DEFAULT,
    Description: 'Highest price at the traveling cart, as a multiple of the item\'s normal sell price. Furniture, Rare Seeds, Coffee Beans and the rare special items keep their price.'
  }
};
// Config menu texts: English name and value labels, the description is the ConfigSchema
// Description. Every label starts with "<value>x".
export const CONFIG_TEXT = {
  PriceCap: {
    name: 'Price cap',
    values: { 2: '2x the sell price', 3: '3x the sell price', 4: '4x the sell price (mildest)' }
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
      if (!t.values[v].startsWith(`${v}x`)) throw new Error(`${lang} label of ${v} must start with ${v}x`);
      keys[`config.${field}.values.${v}`] = t.values[v];
    }
  }
  return keys;
}

const SHOP = 'Traveler';
const KEEP = '{{ModId}}_KeepCartPrice';

// Every qualified ID the name has in items.json (only Iridium Ore has two).
export function idsOf(items) {
  const ids = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)\d+$/.test(id)) (ids[name] ??= []).push(id);
  return ids;
}

// sell price → qualified IDs of the capped objects with that price, sorted by price
export function groups(items) {
  const ids = idsOf(items);
  const bySell = new Map();
  for (const [name, sell] of Object.entries(SELL_PRICES)) {
    if (name in SPECIAL_STOCK) continue;
    if (!bySell.has(sell)) bySell.set(sell, []);
    bySell.get(sell).push(...ids[name]);
  }
  return [...bySell.entries()].sort((a, b) => a[0] - b[0]);
}

export default async function ({ items }) {
  const ids = idsOf(items);
  const names = Object.keys(SELL_PRICES);
  if (names.length !== STANDARD_STOCK_COUNT) throw new Error(`${names.length} standard stock items, the wiki lists ${STANDARD_STOCK_COUNT}`);
  for (const [name, sell] of Object.entries(SELL_PRICES)) {
    if (!ids[name]) throw new Error(`${name} is not in items.json`);
    if (ids[name].length > 1 && name !== 'Iridium Ore') throw new Error(`${name} has ${ids[name].length} IDs`);
    if (!(Number.isInteger(sell) && sell > 0)) throw new Error(`${name}: sell price ${sell}`);
  }
  for (const [name, price] of Object.entries(SPECIAL_STOCK)) {
    if (!(name in SELL_PRICES)) throw new Error(`${name} is not in the standard stock`);
    if (price <= capOf(SELL_PRICES[name], CAPS.at(-1))) throw new Error(`${name}: special price ${price} would not need a cap`);
  }
  if (!CAPS.includes(DEFAULT) || CAPS[1] !== DEFAULT) throw new Error('the default must be the middle level');
  for (const cap of CAPS) {
    const k = Number(cap);
    // a cap below the vanilla maximum (5×) and at least as high as the item's sell price
    if (!(Number.isInteger(k) && k >= 2 && k < Math.max(...VANILLA.multiply))) throw new Error(`cap ${cap}`);
  }
  const all = groups(items);
  const seen = new Set();
  for (const [, list] of all) for (const id of list) {
    if (seen.has(id)) throw new Error(`${id} is in two groups`);
    seen.add(id);
  }
  for (const name of Object.keys(SPECIAL_STOCK)) for (const id of ids[name]) if (seen.has(id)) throw new Error(`${name} must not be capped`);

  const changes = CAPS.map(cap => {
    const modifiers = [{ Id: KEEP, Modification: 'Multiply', Amount: 1 }];
    for (const [sell, list] of all) {
      const amount = capOf(sell, cap);
      if (!(amount < vanillaMax(sell))) throw new Error(`sell ${sell}: cap ${amount} does not lower the vanilla maximum`);
      // at 2× and 3× the cap is never above the cart's lowest price, so every listed object costs exactly the cap
      if (Number(cap) <= Math.min(...VANILLA.multiply) && !(amount <= vanillaMin(sell))) throw new Error(`sell ${sell}: ${amount}`);
      modifiers.push({ Id: `{{ModId}}_Cap${sell}`, Modification: 'Set', Amount: amount, Condition: `ITEM_ID Target ${list.join(' ')}` });
    }
    return {
      LogName: `Traveling cart prices capped at ${cap}x the sell price`,
      Action: 'EditData',
      Target: 'Data/Shops',
      Fields: { [SHOP]: { PriceModifierMode: 'Minimum', PriceModifiers: modifiers } },
      When: { PriceCap: cap }
    };
  });
  const i18n = configKeys(CONFIG, { PriceCap: { ...CONFIG_TEXT.PriceCap, description: CONFIG.PriceCap.Description } }, 'English');
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: CONFIG,
      Changes: changes
    },
    'i18n/default.json': i18n
  };
}
