// Stocked Shelves: Willy's fish shop also sells the fishing supplies he does not stock in the base
// game, as soon as the player could make them at home: Wild Bait, the Quality Bobber, and the two
// fishing dishes Dish O' The Sea and Seafoam Pudding. His own stock stays as it is.
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

  const entries = {};
  const moves = [];
  for (const [name, [kind, sell, condition, after]] of Object.entries(SUPPLIES)) {
    const id = `{{ModId}}_${keyOf(name)}`;
    entries[id] = { Id: id, ItemId: idOf[name], Price: priceOf(kind, sell), Condition: condition };
    if (after) moves.push({ ID: id, AfterID: SUPPLIES[after] ? `{{ModId}}_${keyOf(after)}` : after });
  }
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        { LogName: "More fishing supplies at Willy's", Action: 'EditData', Target: 'Data/Shops', TargetField: ['FishShop', 'Items'], Entries: entries },
        { LogName: "Sort them next to Willy's bait and soup", Action: 'EditData', Target: 'Data/Shops', TargetField: ['FishShop', 'Items'], MoveEntries: moves }
      ]
    }
  };
}
