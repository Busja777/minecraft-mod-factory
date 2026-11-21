// Stocked Shelves: Willy's fish shop also sells the fishing supplies he does not stock in the base
// game, as soon as the player could make them at home: Wild Bait, the Quality Bobber, and the two
// fishing dishes Dish O' The Sea and Seafoam Pudding. His own stock stays as it is.
// Since 1.1 Krobus' shop in the sewers sells three more dark goods (Void Salmon, Squid Ink, Bug
// Steak) once the player could get them on their own. His own stock stays as it is too.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Shops, shop "FishShop" = Willy's fish shop ("Vanilla shop IDs");
//   "Items" is a list of entries with the item spawn fields Id, ItemId, Condition plus Price ("The
//   gold price to purchase the item from the shop").
//   https://stardewvalleywiki.com/Modding:Shops#Format, https://stardewvalleywiki.com/Modding:Item_queries#Item_spawn_fields
// - The pack adds its entries with EditData, TargetField ["FishShop", "Items"] and Entries keyed by
//   its own Id, so Willy's entries are not replaced (the Modding:Shops example edits exactly this
//   list; Content Patcher action-editdata.md, "Edit a list" and "Target field").
// - A second patch only sorts: Wild Bait after Willy's Bait and the dishes after his Trout Soup
//   (MoveEntries with ID/AfterID per the Content Patcher schema; "(O)685" and "(O)219" are the IDs
//   of those two entries in the Modding:Shops example). It is a separate patch so the items are
//   still added if a sort target were missing.
// - Condition: each item appears once the player could make it themselves, the same moment the
//   game unlocks it at home: PLAYER_HAS_CRAFTING_RECIPE / PLAYER_HAS_COOKING_RECIPE Current <name>
//   (https://stardewvalleywiki.com/Modding:Game_state_queries#Player_info_.26_progress).
//   Wild Bait: recipe from Linus' 4-heart event (https://stardewvalleywiki.com/Wild_Bait).
//   Quality Bobber: recipe from Willy after the "Juicy Bugs Wanted!" special order
//   (https://stardewvalleywiki.com/Quality_Bobber).
//   Dish O' The Sea: Fishing level 3 (https://stardewvalleywiki.com/Dish_O%27_The_Sea).
//   Seafoam Pudding: Fishing level 9 (https://stardewvalleywiki.com/Seafoam_Pudding).
// - Prices follow Willy's own markups (https://stardewvalleywiki.com/Fish_Shop): tackle at twice
//   its sell price (Spinner: sells for 250, Willy asks 500), dishes at 2.5 times (Trout Soup: sells
//   for 100, Willy asks 250), premium bait at his Deluxe Bait price (100). ApplyProfitMargins stays
//   at its default, like his entries.
// - Left out on purpose (rare rewards or legendary-fish helpers): Magic Bait (Qi gems), Challenge
//   Bait (fishing mastery), Curiosity Lure (only drops), any fish.
//
// Krobus (1.1):
// - Data/Shops, shop "ShadowShop" = Krobus' shop ("Vanilla shop IDs" on Modding:Shops). Same kind
//   of EditData on TargetField ["ShadowShop", "Items"] with the pack's own Ids, so his entries stay.
//   No sorting patch: the IDs of his vanilla entries are not documented, so the goods go to the end.
// - AvailableStock = "The maximum number of the item which can be purchased in one day"
//   (Modding:Shops, item fields). Krobus limits his own goods per day (https://stardewvalleywiki.com/Krobus#Shop,
//   revision 194307): 5 fish on Wednesdays, 5 dishes on Saturdays, 10 of each essence.
// - Prices follow his markup on monster loot: twice the sell price (Void Essence sells for 50 and
//   costs 100, Solar Essence 40 → 80, Bat Wing 15 → 30, Slime 5 → 10; sell prices from each item's
//   wiki page). At twice the price nothing can be resold at a profit, not even a fish with the
//   Angler profession (+50 %).
// - Fish only on Wednesdays (since 1.2), like Krobus' own fish (5 a week, Krobus#Shop: Wednesday,
//   5, 200g each). A fish smoker doubles a fish's price, and the Fisher, Angler and Artisan
//   professions all count (https://stardewvalleywiki.com/Smoked_Fish, revision 191902): Void Salmon
//   (150) can become smoked fish worth up to 150 × 1.5 × 2 × 1.4 = 630g. Krobus' own Wednesday fish
//   allow the same (Sturgeon, sell 200, bought for 200, up to 840g smoked), so 5 Void Salmon on a
//   Wednesday stay within what the game itself gives; 5 every day (1.1) did not.
// - Conditions: each good appears once the player could get it on their own.
//   Void Salmon (sell 150, https://stardewvalleywiki.com/Void_Salmon): after catching one,
//   PLAYER_HAS_CAUGHT_FISH Current (O)795 ("have caught any of the specified fish qualified IDs").
//   Squid Ink (sell 110, https://stardewvalleywiki.com/Squid_Ink): comes from Squid and Midnight
//   Squid fish ponds, so after catching either: PLAYER_HAS_CAUGHT_FISH Current (O)151 (O)798.
//   Bug Steak (sell 50, https://stardewvalleywiki.com/Bug_Steak): crafting recipe at Combat level 1
//   ("Bug Steak":"684 10/Home/874/false/s Combat 1/", Modding:Recipe data),
//   PLAYER_HAS_CRAFTING_RECIPE Current Bug Steak.
// - Left out on purpose: Void Mayonnaise and Monster Musk (both loved gifts of Krobus: buying them
//   would buy his friendship; Monster Musk is also a Wizard special-order reward), Bug Meat (Willy's
//   "Juicy Bugs Wanted!" order asks for 100 of it), Stardrops and other unique rewards.

// name → [kind, sell price from the item's wiki page, condition, sort after (vanilla entry ID or own key)]
export const SUPPLIES = {
  'Wild Bait': ['bait', 15, 'PLAYER_HAS_CRAFTING_RECIPE Current Wild Bait', '(O)685'],
  'Quality Bobber': ['tackle', 300, 'PLAYER_HAS_CRAFTING_RECIPE Current Quality Bobber', null],
  "Dish O' The Sea": ['dish', 220, "PLAYER_HAS_COOKING_RECIPE Current Dish O' The Sea", '(O)219'],
  'Seafoam Pudding': ['dish', 300, 'PLAYER_HAS_COOKING_RECIPE Current Seafoam Pudding', "Dish O' The Sea"]
};

// Willy's prices: bait fixed like Deluxe Bait, tackle ×2 (Spinner 250 → 500), dishes ×2.5 (Trout Soup 100 → 250).
export const DELUXE_BAIT_PRICE = 100;
export const priceOf = (kind, sell) => ({ bait: DELUXE_BAIT_PRICE, tackle: sell * 2, dish: Math.round(sell * 2.5) })[kind];

// Never in this shop: rewards and helpers for legendary fish.
export const NEVER = ['Magic Bait', 'Challenge Bait', 'Curiosity Lure'];

export const keyOf = name => name.replace(/[^A-Za-z]/g, '');
const QUERY = /^PLAYER_HAS_(CRAFTING|COOKING)_RECIPE Current [A-Z][A-Za-z' ]+$/;

// Krobus (1.1): name → [sell price from the item's wiki page, stock per day, condition]
export const KROBUS = {
  'Void Salmon': [150, 5, 'PLAYER_HAS_CAUGHT_FISH Current (O)795, DAY_OF_WEEK Wednesday'],
  'Squid Ink': [110, 5, 'PLAYER_HAS_CAUGHT_FISH Current (O)151 (O)798'],
  'Bug Steak': [50, 5, 'PLAYER_HAS_CRAFTING_RECIPE Current Bug Steak']
};
export const KROBUS_MARKUP = 2; // Void Essence 50 → 100, Solar Essence 40 → 80, Bat Wing 15 → 30
export const KROBUS_NEVER = ['Void Mayonnaise', 'Monster Musk', 'Bug Meat', 'Stardrop', 'Void Egg', 'Void Ghost Pendant'];
const KROBUS_QUERY = /^(PLAYER_HAS_CAUGHT_FISH Current( \(O\)\d+)+(, DAY_OF_WEEK Wednesday)?|PLAYER_HAS_CRAFTING_RECIPE Current [A-Z][A-Za-z' ]+)$/;
// Goods that are fish themselves (a fish smoker takes them): only on Krobus' fish day.
export const KROBUS_FISH = ['Void Salmon'];
const FISH = { '(O)795': 'Void Salmon', '(O)151': 'Squid', '(O)798': 'Midnight Squid' };

export default async function ({ items }) {
  const idOf = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)/.test(id)) idOf[name] = id;
  for (const [name, [kind, sell, condition, after]] of Object.entries(SUPPLIES)) {
    if (!idOf[name]) throw new Error(`${name} is not in items.json`);
    if (NEVER.includes(name)) throw new Error(`${name} must not be sold`);
    if (items.items[idOf[name]] !== name) throw new Error(`${name}: ID mismatch`);
    if (!(Number.isInteger(sell) && sell > 0)) throw new Error(`${name}: sell price ${sell}`);
    if (!QUERY.test(condition) || !condition.endsWith(` ${name}`)) throw new Error(`${name}: condition "${condition}"`);
    if ((kind === 'dish') !== condition.includes('COOKING')) throw new Error(`${name}: dishes need a cooking recipe, the rest a crafting recipe`);
    const price = priceOf(kind, sell);
    if (!(Number.isInteger(price) && price > 0 && price <= 1000)) throw new Error(`${name}: price ${price}`);
    if (after && !/^\(O\)\d+$/.test(after) && !SUPPLIES[after]) throw new Error(`${name}: sort target ${after}`);
  }

  for (const [name, [sell, stock, condition]] of Object.entries(KROBUS)) {
    if (!idOf[name]) throw new Error(`${name} is not in items.json`);
    if (KROBUS_NEVER.includes(name)) throw new Error(`${name} must not be sold by Krobus`);
    if (!(Number.isInteger(sell) && sell > 0)) throw new Error(`${name}: sell price ${sell}`);
    if (!(Number.isInteger(stock) && stock >= 1 && stock <= 10)) throw new Error(`${name}: stock ${stock} (Krobus sells 5 to 10 a day)`);
    if (!KROBUS_QUERY.test(condition)) throw new Error(`${name}: condition "${condition}"`);
    for (const id of condition.match(/\(O\)\d+/g) || []) if (items.items[id] !== FISH[id]) throw new Error(`${name}: ${id} is not the fish ${FISH[id]}`);
    if (KROBUS_FISH.includes(name) !== condition.endsWith(', DAY_OF_WEEK Wednesday')) throw new Error(`${name}: fish (and only fish) are sold on Wednesdays only`);
    if (condition.startsWith('PLAYER_HAS_CRAFTING') && !condition.endsWith(` ${name}`)) throw new Error(`${name}: recipe condition is for another item`);
    const price = sell * KROBUS_MARKUP;
    if (!(price <= 1000)) throw new Error(`${name}: price ${price}`);
  }

  const entries = {};
  const moves = [];
  for (const [name, [kind, sell, condition, after]] of Object.entries(SUPPLIES)) {
    const id = `{{ModId}}_${keyOf(name)}`;
    entries[id] = { Id: id, ItemId: idOf[name], Price: priceOf(kind, sell), Condition: condition };
    if (after) moves.push({ ID: id, AfterID: SUPPLIES[after] ? `{{ModId}}_${keyOf(after)}` : after });
  }
  const krobus = {};
  for (const [name, [sell, stock, condition]] of Object.entries(KROBUS)) {
    const id = `{{ModId}}_Krobus_${keyOf(name)}`;
    krobus[id] = { Id: id, ItemId: idOf[name], Price: sell * KROBUS_MARKUP, AvailableStock: stock, Condition: condition };
  }
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        { LogName: "More fishing supplies at Willy's", Action: 'EditData', Target: 'Data/Shops', TargetField: ['FishShop', 'Items'], Entries: entries },
        { LogName: "Sort them next to Willy's bait and soup", Action: 'EditData', Target: 'Data/Shops', TargetField: ['FishShop', 'Items'], MoveEntries: moves },
        { LogName: "More dark goods at Krobus'", Action: 'EditData', Target: 'Data/Shops', TargetField: ['ShadowShop', 'Items'], Entries: krobus }
      ]
    }
  };
}
