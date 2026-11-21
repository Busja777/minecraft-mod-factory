// Pierre's Year-Round Seeds: Pierre also sells the seeds of the other seasons, at a surcharge the
// player picks in the Content Patcher config (+25 %, +50 % = default, +100 %). Since 1.1 Sandy's
// Oasis shop does the same for her seasonal seeds, with the same surcharge setting. Crops still
// only grow in their own season: the pack does not touch Data/Crops or anything else.
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
//
// Sandy (1.1): Data/Shops key "Sandy" = "Sandy's Oasis shop"
// (https://stardewvalleywiki.com/Modding:Shops, list of vanilla shop IDs, revision 195385). Her
// seeds and prices: https://stardewvalleywiki.com/Crops (revision 193979), where the seed cell of
// each crop names its shops: Rhubarb Seeds "Oasis: 100g" under Spring Crops, Starfruit Seeds
// "Oasis: 400g" under Summer Crops, Beet Seeds "Oasis: 20g" under Fall Crops, Cactus Seeds
// "Oasis: 150g" under Special Crops (sold all year, so not part of this pack). Sandy herself:
// "Make sure to check out our seasonal seed selection" (https://stardewvalleywiki.com/Sandy,
// Saturday dialogue, revision 191345). The raw Data/Shops entries of her shop are not on these
// pages, so the season limit is taken from them. If she sold one of the three all year after all,
// AvoidRepeat keeps this pack's entry out (her own entries come first): nothing appears twice and
// her price stays. Pierre's Missing Stocklist only affects Pierre's store (Modding:Shops).

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

// Sandy's seasonal seeds (1.1), same format: name → [seasons she sells it in, her in-season price].
export const SANDY_SEEDS = {
  'Rhubarb Seeds': [['spring'], 100],
  'Starfruit Seeds': [['summer'], 400],
  'Beet Seeds': [['fall'], 20]
};

// Data/Shops key → seeds of that shop (one entry list per shop, the shop name only for the log).
export const SHOPS = {
  SeedShop: { who: "Pierre's", seeds: SEEDS },
  Sandy: { who: "Sandy's", seeds: SANDY_SEEDS }
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
  for (const { seeds } of Object.values(SHOPS)) {
    for (const [name, [seasons, price]] of Object.entries(seeds)) {
      if (!idOf[name]) throw new Error(`${name} is not in items.json`);
      if (!seasons.length || seasons.some(s => !SEASONS.includes(s)) || seasons.includes('winter')) throw new Error(`${name}: seasons ${seasons}`);
      if (!(Number.isInteger(price) && price > 0)) throw new Error(`${name}: price ${price}`);
    }
    if (new Set(Object.keys(seeds).map(n => idOf[n])).size !== Object.keys(seeds).length) throw new Error('two seeds share an item ID');
  }

  const changes = [];
  for (const [shop, { who, seeds }] of Object.entries(SHOPS)) {
    for (const surcharge of SURCHARGES) {
      const entries = {};
      for (const [name, [seasons, price, year2]] of Object.entries(seeds)) {
        const id = `{{ModId}}_${keyOf(name)}`;
        entries[id] = {
          Id: id,
          ItemId: idOf[name],
          Price: priceWith(price, surcharge),
          Condition: conditionOf(seasons, year2),
          AvoidRepeat: true
        };
      }
      changes.push({
        LogName: `Out-of-season seeds at ${who} (+${surcharge} %)`,
        Action: 'EditData',
        Target: 'Data/Shops',
        TargetField: [shop, 'Items'],
        Entries: entries,
        When: { Surcharge: surcharge }
      });
    }
  }
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: {
        Surcharge: {
          AllowValues: SURCHARGES.join(', '),
          Default: DEFAULT,
          Description: 'Extra cost in percent for seeds Pierre and Sandy sell outside their season. Seeds still only grow in their own season.'
        }
      },
      Changes: changes
    }
  };
}
