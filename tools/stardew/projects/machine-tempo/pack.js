// Machine Tempo: kegs, preserves jars, cheese presses (since 1.1) and looms (since 1.1) finish their
// goods faster. The player picks the factor in the Content Patcher config (1.0 = vanilla, 1.25,
// 1.5 = default, 2.0); one factor for all four machines.
//
// How the speed-up works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/Machines is keyed by the qualified ID of the machine. Each machine has OutputRules with
//   MinutesUntilReady/DaysUntilReady per rule, and on the machine itself the optional
//   "ReadyTimeModifiers" field: "Quantity modifiers applied to the produced item's processing
//   time", combined by "ReadyTimeModifierMode" (default Stack).
//   https://stardewvalleywiki.com/Modding:Machines#Item_processing_rules
// - A quantity modifier is { Id, Modification, Amount, Condition }, Modification can be Add,
//   Subtract, Multiply, Divide or Set.
//   https://stardewvalleywiki.com/Modding:Common_data_field_types#Quantity_modifiers
//   So one modifier "Divide <factor>" per machine expresses the factor exactly, for every output
//   rule at once, without copying or touching the rules themselves (inputs, outputs, prices and
//   the minutes per rule stay vanilla, and rules other mods add are sped up too).
// - The patch sets the ReadyTimeModifiers field of the machines with EditData "Fields"
//   (Content Patcher docs, action-editdata.md "Fields"); nothing else in Data/Machines changes.
//   Assumption: vanilla 1.6 has no ReadyTimeModifiers of its own on these machines (the wiki
//   does not list the raw Data/Machines entries); if it had, this patch would replace them.
// - The factor is a config option (author-guide/config.md: ConfigSchema with AllowValues/Default)
//   and selects one patch through "When" (author-guide.md#conditions). At 1.0 no patch applies, so
//   the game data stays exactly vanilla. {{ModId}} keeps the modifier ID unique (tokens.md#ModId).
//
// Machine IDs (big craftables, Data/BigCraftables): Keg = (BC)12, Preserves Jar = (BC)15,
// Cheese Press = (BC)16, Loom = (BC)17. Source: the raw Data/CraftingRecipes "as of 1.6.15" on
// https://stardewvalleywiki.com/Modding:Recipe_data (revision 193377). Each machine's recipe yields
// its own ID with the "big craftable" field true: "Keg": ".../Home/12/true/...", "Preserves Jar":
// ".../Home/15/true/...", "Cheese Press": ".../Home/16/true/...", "Loom": ".../Home/17/true/...".
//
// Vanilla processing minutes per output (only for the page and the changelog, the pack itself
// does not depend on them): https://stardewvalleywiki.com/Keg#Products,
// https://stardewvalleywiki.com/Preserves_Jar, https://stardewvalleywiki.com/Cheese_Press#Products
// and https://stardewvalleywiki.com/Loom#Products (product tables, revisions 195253, 195389,
// 183811, 190254; the loom's "4 Hours" = 240 minutes).

export const MACHINES = {
  '(BC)12': {
    name: 'Keg',
    minutes: { Beer: 1750, Vinegar: 600, Coffee: 120, 'Green Tea': 180, Mead: 600, 'Pale Ale': 2250, Juice: 6000, Wine: 10000 }
  },
  '(BC)15': {
    name: 'Preserves Jar',
    minutes: { Pickles: 4000, Jelly: 4000, Caviar: 6000, 'Aged Roe': 4000 }
  },
  '(BC)16': {
    name: 'Cheese Press',
    since: '1.1',
    minutes: { Cheese: 200, 'Goat Cheese': 200 }
  },
  '(BC)17': {
    name: 'Loom',
    since: '1.1',
    minutes: { Cloth: 240 }
  }
};

// Config values (strings, as Content Patcher compares them) → speed factor.
export const FACTORS = { '1.0': 1, '1.25': 1.25, '1.5': 1.5, '2.0': 2 };
export const DEFAULT = '1.5';

// Processing time at a given factor (rounded down like an int conversion; the exact rounding of
// the game is not documented).
export const readyMinutes = (minutes, factor) => Math.floor(minutes / factor);

export default async function () {
  if (!(DEFAULT in FACTORS)) throw new Error(`default ${DEFAULT} is not an allowed value`);
  for (const [id, { name }] of Object.entries(MACHINES)) {
    if (!/^\(BC\)\d+$/.test(id)) throw new Error(`${name}: ${id} is not a qualified big craftable ID`);
  }
  for (const [value, factor] of Object.entries(FACTORS)) {
    if (!(factor >= 1 && factor <= 2)) throw new Error(`factor ${value} is outside 1 to 2 (fair values)`);
  }
  const changes = [];
  for (const [value, factor] of Object.entries(FACTORS)) {
    if (factor === 1) continue; // 1.0 = vanilla: no patch at all
    const fields = {};
    for (const id of Object.keys(MACHINES)) {
      fields[id] = {
        ReadyTimeModifiers: [{ Id: '{{ModId}}_Tempo', Modification: 'Divide', Amount: factor }]
      };
    }
    changes.push({
      LogName: `Kegs, preserves jars, cheese presses and looms ${value}x faster`,
      Action: 'EditData',
      Target: 'Data/Machines',
      Fields: fields,
      When: { Speed: value }
    });
  }
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: {
        Speed: {
          AllowValues: Object.keys(FACTORS).join(', '),
          Default: DEFAULT,
          Description: 'How much faster kegs, preserves jars, cheese presses and looms work. 1.0 is the normal speed, 2.0 halves the time.'
        }
      },
      Changes: changes
    }
  };
}
