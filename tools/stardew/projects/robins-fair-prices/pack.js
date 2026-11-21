// Robin's Fair Prices: the farm buildings from the Carpenter's Shop cost less gold, need fewer
// materials and are finished sooner. The player picks the share of the vanilla cost in the Content
// Patcher config (75 %, 50 % = default, 25 %). The Wizard's buildings stay vanilla.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Buildings is a string → model lookup keyed by the building ID. Construction fields:
//   "BuildCost": "The gold cost to construct the building", "BuildMaterials": "The materials you
//   must provide to start construction, as a list of models" { Id (optional, "Defaults to the
//   ItemId"), ItemId ("qualified or unqualified"), Amount }, "BuildDays": "The number of days
//   needed to complete construction ... If set to 0, construction finishes instantly", "Builder":
//   Robin or Wizard. Upgrades are entries of their own ("BuildingToUpgrade": "For example, the Big
//   Coop sets this to "Coop"").
//   https://stardewvalleywiki.com/Modding:Buildings (revision 195467)
// - The patch changes only BuildCost, BuildMaterials and BuildDays of each building with EditData
//   "Fields" ("The key for each field is ... the field name for an object", Content Patcher docs,
//   action-editdata.md "Fields"). Texture, size, interior, animals, upgrades paths, skins and all
//   other fields are never written.
// - BuildMaterials is written as one whole field (the complete list of the building's materials
//   from the wiki, with the new amounts). The vanilla list entries' IDs are not published, so
//   editing single list entries by ID could add a second entry instead of replacing one; the whole
//   list is the safe form. ItemIds are qualified (tools/stardew/data/items.json).
// - BuildDays is only written when it changes; buildings that vanilla builds instantly (0 days:
//   Shipping Bin, Pet Bowl) stay instant, every other building needs at least 1 day.
// - The level is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default)
//   and selects one patch through "When" (author-guide.md#conditions).
//
// Vanilla values: https://stardewvalleywiki.com/Carpenter's_Shop (section "Farm Buildings", columns
// Cost and Construction Time, revision 195197), cross-checked with the building pages Barn
// (193419), Coop (193803), Shed (191908), Silo (190582), Mill (190535), Well (192669), Stable
// (192679), Slime Hutch (195363), Fish Pond (194160, 5,000g; the shop table's sort key says 6000
// but shows 5,000g), Shipping (193038) and Pet Bowl (192019). Barn and Coop "take three days to
// construct", their upgrades "two days" (Barn, Coop pages).
//
// Building IDs: the wiki documents "Coop" (Modding:Buildings, BuildingToUpgrade and
// ValidOccupantTypes ["Barn", "Coop"]), "Shipping Bin" (CreateInstanceFromId example), "Silo"
// (Modding:Migrate to Stardew Valley 1.6, getNumberBuildingsConstructed("Silo")) and "Deluxe Barn"
// (same page, Data/PaintData entry). The other IDs are the English building names, like the keys of
// the 1.5 Data/Blueprints that Data/Buildings replaced: an assumption of this pack. A wrong key
// would only make Content Patcher skip that building with a warning.
//
// Left out on purpose: Cabin (100g, no materials, instant since 1.6, styles are skins that may
// override the cost), farmhouse upgrades and community upgrades (not in Data/Buildings), and the
// Wizard's buildings.

// Materials used by the vanilla buildings → qualified item ID (items.json).
export const MATERIALS = {
  Wood: '(O)388',
  Stone: '(O)390',
  Hardwood: '(O)709',
  Clay: '(O)330',
  'Copper Bar': '(O)334',
  'Iron Bar': '(O)335',
  'Iridium Bar': '(O)337',
  'Refined Quartz': '(O)338',
  Cloth: '(O)428',
  Seaweed: '(O)152',
  'Green Algae': '(O)153'
};

// building ID → vanilla { gold, days, materials, upgrades (BuildingToUpgrade) } (sources above)
export const BUILDINGS = {
  Coop: { gold: 4000, days: 3, materials: { Wood: 300, Stone: 100 } },
  'Big Coop': { gold: 10000, days: 2, materials: { Wood: 400, Stone: 150 }, upgrades: 'Coop' },
  'Deluxe Coop': { gold: 20000, days: 2, materials: { Wood: 500, Stone: 200 }, upgrades: 'Big Coop' },
  Barn: { gold: 6000, days: 3, materials: { Wood: 350, Stone: 150 } },
  'Big Barn': { gold: 12000, days: 2, materials: { Wood: 450, Stone: 200 }, upgrades: 'Barn' },
  'Deluxe Barn': { gold: 25000, days: 2, materials: { Wood: 550, Stone: 300 }, upgrades: 'Big Barn' },
  Shed: { gold: 15000, days: 2, materials: { Wood: 300 } },
  'Big Shed': { gold: 20000, days: 2, materials: { Wood: 550, Stone: 300 }, upgrades: 'Shed' },
  'Fish Pond': { gold: 5000, days: 2, materials: { Stone: 200, Seaweed: 5, 'Green Algae': 5 } },
  Mill: { gold: 2500, days: 2, materials: { Stone: 50, Wood: 150, Cloth: 4 } },
  Silo: { gold: 100, days: 2, materials: { Stone: 100, Clay: 10, 'Copper Bar': 5 } },
  'Slime Hutch': { gold: 10000, days: 2, materials: { Stone: 500, 'Refined Quartz': 10, 'Iridium Bar': 1 } },
  Stable: { gold: 10000, days: 2, materials: { Hardwood: 100, 'Iron Bar': 5 } },
  Well: { gold: 1000, days: 2, materials: { Stone: 75 } },
  'Shipping Bin': { gold: 250, days: 0, materials: { Wood: 150 } },
  'Pet Bowl': { gold: 5000, days: 0, materials: { Hardwood: 25 } }
};
// Never touched: the Wizard's buildings (https://stardewvalleywiki.com/Wizard's_Tower#Buildings)
// and the houses.
export const NOT_TOUCHED = ['Earth Obelisk', 'Water Obelisk', 'Desert Obelisk', 'Island Obelisk', 'Junimo Hut', 'Gold Clock', 'Cabin', 'Farmhouse', 'Greenhouse'];

// Config values (percent of the vanilla cost, compared as text) → share.
export const SHARES = { 75: 0.75, 50: 0.5, 25: 0.25 };
export const DEFAULT = '50';

// Gold and materials are rounded up (never cheaper than the share), days to the nearest whole day
// but at least 1; instant buildings stay instant.
export const goldOf = (gold, share) => Math.ceil(gold * share);
export const amountOf = (amount, share) => Math.max(1, Math.ceil(amount * share));
export const daysOf = (days, share) => (days === 0 ? 0 : Math.max(1, Math.round(days * share)));

export default async function ({ items }) {
  if (!(DEFAULT in SHARES)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  if (Object.keys(SHARES).sort((a, b) => b - a)[1] !== DEFAULT) throw new Error('the default must be the middle level');
  for (const [value, share] of Object.entries(SHARES)) {
    if (!(share >= 0.25 && share < 1) || Math.round(share * 100) !== Number(value)) throw new Error(`share ${value}: ${share}`);
  }
  for (const [name, id] of Object.entries(MATERIALS)) if (items.items[id] !== name) throw new Error(`${id} is not ${name} in items.json`);
  for (const [id, b] of Object.entries(BUILDINGS)) {
    if (NOT_TOUCHED.includes(id)) throw new Error(`${id} must stay vanilla`);
    if (!(Number.isInteger(b.gold) && b.gold > 0)) throw new Error(`${id}: gold ${b.gold}`);
    if (![0, 2, 3].includes(b.days)) throw new Error(`${id}: ${b.days} days is not a documented construction time`);
    if (b.upgrades && !BUILDINGS[b.upgrades]) throw new Error(`${id} upgrades ${b.upgrades}, which is not in the table`);
    if (b.upgrades && b.days !== 2) throw new Error(`${id}: upgrades take two days`);
    if (!Object.keys(b.materials).length) throw new Error(`${id}: no materials`);
    for (const [m, n] of Object.entries(b.materials)) {
      if (!MATERIALS[m]) throw new Error(`${id}: unknown material ${m}`);
      if (!(Number.isInteger(n) && n > 0)) throw new Error(`${id}: ${m} × ${n}`);
    }
  }

  const changes = Object.entries(SHARES).map(([value, share]) => {
    const fields = {};
    for (const [id, b] of Object.entries(BUILDINGS)) {
      const f = { BuildCost: goldOf(b.gold, share) };
      const days = daysOf(b.days, share);
      if (days > b.days || (b.days > 0 && days < 1)) throw new Error(`${id}: ${days} days`);
      if (days !== b.days) f.BuildDays = days;
      f.BuildMaterials = Object.entries(b.materials).map(([m, n]) => {
        const amount = amountOf(n, share);
        if (amount > n) throw new Error(`${id}: ${m} ${amount} is more than vanilla ${n}`);
        return { ItemId: MATERIALS[m], Amount: amount };
      });
      if (!(f.BuildCost < b.gold)) throw new Error(`${id}: ${f.BuildCost}g is not cheaper than ${b.gold}g`);
      fields[id] = f;
    }
    return {
      LogName: `Carpenter's buildings at ${value} % of the vanilla cost`,
      Action: 'EditData',
      Target: 'Data/Buildings',
      Fields: fields,
      When: { CostPercent: value }
    };
  });
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: {
        CostPercent: {
          AllowValues: Object.keys(SHARES).sort((a, b) => b - a).join(', '),
          Default: DEFAULT,
          Description: 'Share of the normal gold, materials and construction days for the farm buildings from the carpenter, in percent. Gold and materials are rounded up, construction takes at least one day. Magical buildings are not changed.'
        }
      },
      Changes: changes
    }
  };
}
