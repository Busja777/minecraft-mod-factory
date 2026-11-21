// Festival Stalls Plus: the festival booths sell a few more fitting goods: seeds for the rest of the
// season (Pierre's shop is closed on most festival days), seasonal flowers and festive food. Every
// item is one the player can get in the game anyway; the vanilla stock of each booth stays as it is.
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
//   goods: 1.5 × the sell price, rounded up to 10g. The booths' own everyday goods sell between
//     0.83× and 1.67× their sell price (ANCHORS below); 1.5× is inside that range and above 1.4×,
//     so nothing can be sold back at a profit, not even with the Artisan profession (+40 %).
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
// Left out on purpose: the Stardew Valley Fair (Festival_StardewValleyFair_StarTokens sells for
// star tokens, which have no gold value to price against), the Night Market and the Desert Festival
// shops (planned for later updates), furniture and hats (only (O) objects can be checked here).

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
  }
};
// The Fair's shop sells for star tokens: never touched.
export const NOT_TOUCHED = ['Festival_StardewValleyFair_StarTokens'];

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
  Chowder: 135, 'Fish Stew': 175, 'Winter Seeds': 30, 'Plum Pudding': 260, Cookie: 140, Holly: 80
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

export const MARKUP = 1.5;
export const MIN_MARKUP = 1.4; // the highest sell bonus that applies to these goods: Artisan +40 %
export const GOODS_STOCK = 10;
export const priceOfGoods = sell => Math.ceil(sell * MARKUP / 10) * 10;
export const priceOf = name => (SEEDS[name] ? SEEDS[name][0] : priceOfGoods(GOODS[name]));

export const keyOf = name => name.replace(/[^A-Za-z]/g, '');

// the season and day the seeds are planted: the festival day, or fall 1 after the last summer day
export function plantingDay({ season, day }) {
  if (day < SEASON_DAYS) return { season, day };
  return { season: SEASONS[(SEASONS.indexOf(season) + 1) % 4], day: 1 };
}

export default async function ({ items }) {
  const idOf = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)\d+$/.test(id)) idOf[name] = id;
  const ratios = Object.values(ANCHORS).map(([price, sell]) => price / sell);
  if (!(MARKUP >= Math.min(...ratios) && MARKUP <= Math.max(...ratios))) throw new Error(`markup ${MARKUP} is outside the booths' own range`);
  if (!(MARKUP >= MIN_MARKUP)) throw new Error('goods could be sold back at a profit');
  for (const name of Object.keys(ANCHORS)) if (!idOf[name]) throw new Error(`anchor ${name} is not in items.json`);

  const used = new Set();
  const changes = [];
  for (const [shop, stall] of Object.entries(STALLS)) {
    if (NOT_TOUCHED.includes(shop)) throw new Error(`${shop} must stay vanilla`);
    if (!/^Festival_[A-Za-z]+_(Pierre|TravelingMerchant)$/.test(shop)) throw new Error(`${shop} is not a documented festival shop ID`);
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
        const price = priceOfGoods(sell);
        if (!(Number.isInteger(sell) && sell > 0 && price >= sell * MIN_MARKUP)) throw new Error(`${name}: ${price}g for sell price ${sell}`);
      }
      used.add(name);
      const id = `{{ModId}}_${keyOf(name)}`;
      entries[id] = {
        Id: id,
        ItemId: idOf[name],
        Price: priceOf(name),
        ...(SEEDS[name] ? {} : { AvailableStock: GOODS_STOCK, AvailableStockLimit: 'Player' })
      };
    }
    changes.push({ LogName: `More goods at the ${stall.festival}`, Action: 'EditData', Target: 'Data/Shops', TargetField: [shop, 'Items'], Entries: entries });
  }
  for (const name of [...Object.keys(SEEDS), ...Object.keys(GOODS)]) if (!used.has(name)) throw new Error(`${name} is in a table but no booth sells it`);
  return { 'content.json': { Format: '2.9.0', Changes: changes } };
}
