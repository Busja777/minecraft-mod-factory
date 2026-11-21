// Pierre's Year-Round Seeds: Pierre also sells the seeds of the other seasons, at a surcharge the
// player picks in the Content Patcher config (+25 %, +50 % = default, +100 %). Crops still only
// grow in their own season: the pack does not touch Data/Crops or anything else.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Shops, shop "SeedShop" = Pierre's general store; "Items" is a list of item entries with
//   Id, ItemId, Condition (item spawn fields), Price ("Defaults to the item's normal price") and
//   AvoidRepeat ("avoid adding this item to the shop if it would duplicate one that was already
//   added").
//   https://stardewvalleywiki.com/Modding:Shops#Format, https://stardewvalleywiki.com/Modding:Item_queries#Item_spawn_fields
// - The pack adds one entry per seed with EditData, TargetField ["SeedShop", "Items"] and Entries
//   keyed by its own Id; Pierre's own entries are not replaced (Content Patcher action-editdata.md,
//   "Edit a list" and "Target field"; new entries go to the bottom of the list).
// - Condition "!SEASON <its seasons>" keeps each seed out of the shop in its own season(s), where
//   Pierre sells it anyway, so nothing appears twice; seeds Pierre only sells from year 2 on also
//   get "YEAR 2" (Pierre's General Store page, "Available in year 2+").
//   https://stardewvalleywiki.com/Modding:Game_state_queries#Date_.26_time
// - Pierre's Missing Stocklist: "If the player found Pierre's Missing Stocklist, season conditions
//   in the Condition field are ignored in Pierre's General Store" (Modding:Shops). Then Pierre's
//   own entries already cover every season (at +50 %). This pack's entries come after his and use
//   AvoidRepeat, so the seed he already lists is not added a second time.
// - Price: set explicitly, Pierre's in-season price from the wiki × (1 + surcharge), rounded. The
//   default price is not used, because it is not documented whether Pierre's own entries set a
//   price (Sunflower Seeds cost 200g at Pierre, far above their sell price).
//   ApplyProfitMargins stays at its default, like Pierre's entries.
// - The surcharge is a config option (author-guide/config.md) and selects one patch via "When".
//
// Seeds and in-season prices: https://stardewvalleywiki.com/Pierre%27s_General_Store (Spring, Summer
// and Fall Stock, revision 195226). Pierre sells no seasonal seeds in winter; Strawberry Seeds
// (Egg Festival only) and Ginger Island seeds are not part of his stock and stay out.

// name → [seasons Pierre sells it in, his in-season price, only from year 2]
export const SEEDS = {
  'Parsnip Seeds': [['spring'], 20],
  'Bean Starter': [['spring'], 60],
  'Cauliflower Seeds': [['spring'], 80],
  'Potato Seeds': [['spring'], 50],
  'Tulip Bulb': [['spring'], 20],
  'Kale Seeds': [['spring'], 70],
  'Jazz Seeds': [['spring'], 30],
  'Garlic Seeds': [['spring'], 40, true],
  'Rice Shoot': [['spring'], 40, true],
  'Melon Seeds': [['summer'], 80],
  'Tomato Seeds': [['summer'], 50],
  'Blueberry Seeds': [['summer'], 80],
  'Pepper Seeds': [['summer'], 40],
  'Wheat Seeds': [['summer', 'fall'], 10],
  'Radish Seeds': [['summer'], 40],
  'Poppy Seeds': [['summer'], 100],
  'Spangle Seeds': [['summer'], 50],
  'Hops Starter': [['summer'], 60],
  'Corn Seeds': [['summer', 'fall'], 150],
  'Sunflower Seeds': [['summer', 'fall'], 200],
  'Red Cabbage Seeds': [['summer'], 100, true],
  'Eggplant Seeds': [['fall'], 20],
  'Pumpkin Seeds': [['fall'], 100],
  'Bok Choy Seeds': [['fall'], 50],
  'Yam Seeds': [['fall'], 60],
  'Cranberry Seeds': [['fall'], 240],
  'Fairy Seeds': [['fall'], 200],
  'Amaranth Seeds': [['fall'], 70],
  'Grape Starter': [['fall'], 60],
  'Artichoke Seeds': [['fall'], 30, true]
};

// Config values (percent, as Content Patcher compares them as text).
export const SURCHARGES = ['25', '50', '100'];
export const DEFAULT = '50';
const SEASONS = ['spring', 'summer', 'fall', 'winter'];

export const priceWith = (base, surcharge) => Math.round(base * (100 + Number(surcharge)) / 100);
export const conditionOf = (seasons, year2) => [`!SEASON ${seasons.join(' ')}`, ...(year2 ? ['YEAR 2'] : [])].join(', ');
const keyOf = name => name.replace(/[^A-Za-z]/g, '');

export default async function ({ items }) {
  const idOf = {};
  for (const [id, name] of Object.entries(items.items)) if (/^\(O\)/.test(id)) idOf[name] = id;
  if (!SURCHARGES.includes(DEFAULT)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const [name, [seasons, price]] of Object.entries(SEEDS)) {
    if (!idOf[name]) throw new Error(`${name} is not in items.json`);
    if (!seasons.length || seasons.some(s => !SEASONS.includes(s)) || seasons.includes('winter')) throw new Error(`${name}: seasons ${seasons}`);
    if (!(Number.isInteger(price) && price > 0)) throw new Error(`${name}: price ${price}`);
  }
  if (new Set(Object.keys(SEEDS).map(n => idOf[n])).size !== Object.keys(SEEDS).length) throw new Error('two seeds share an item ID');

  const changes = SURCHARGES.map(surcharge => {
    const entries = {};
    for (const [name, [seasons, price, year2]] of Object.entries(SEEDS)) {
      const id = `{{ModId}}_${keyOf(name)}`;
      entries[id] = {
        Id: id,
        ItemId: idOf[name],
        Price: priceWith(price, surcharge),
        Condition: conditionOf(seasons, year2),
        AvoidRepeat: true
      };
    }
    return {
      LogName: `Out-of-season seeds at Pierre's (+${surcharge} %)`,
      Action: 'EditData',
      Target: 'Data/Shops',
      TargetField: ['SeedShop', 'Items'],
      Entries: entries,
      When: { Surcharge: surcharge }
    };
  });
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: {
        Surcharge: {
          AllowValues: SURCHARGES.join(', '),
          Default: DEFAULT,
          Description: 'Extra cost in percent for seeds bought outside their season. Seeds still only grow in their own season.'
        }
      },
      Changes: changes
    }
  };
}
