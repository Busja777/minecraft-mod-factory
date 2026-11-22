// Fair Villager Trades: every villager profession asks about a third fewer emeralds for what it
// sells (rounded, never below 1). What villagers pay for your goods stays vanilla, so emerald
// farming gets no easier, and levels, experience, uses, price multipliers and the choose rules
// stay exactly as they are.
//
// Which files the game uses: entities/villager_v2.json (the villager that spawns) gives every
// profession a "minecraft:economy_trade_table" pointing to trading/economy_trades/<job>_trades.json.
// The old trading/<job>_trades.json only belong to the legacy entities/villager.json, whose
// "minecraft:trade_table" has "convert_trades_economy": true, so even those villagers end up on
// the economy tables. The list of tables is read from villager_v2.json, not typed in here.
// The wandering trader (its own entity and table) is left for a later update.
export const ENTITY = 'entities/villager_v2.json';
const EMERALD = 'minecraft:emerald';

// The rule, in one place: about a third off, rounded, never below 1.
export const fairPrice = q => Math.max(1, Math.round((q * 2) / 3));

const isInt = n => Number.isInteger(n) && n >= 1;
const isEmerald = e => e?.item === EMERALD;
const keysWithin = (o, allowed) => Object.keys(o).every(k => allowed.includes(k));

// A quantity as vanilla writes it: a whole number, or { min, max } (choice format).
// → the fair quantity in the same shape. Throws on anything else.
export function fairQuantity(q, where) {
  if (isInt(q)) return fairPrice(q);
  if (q && typeof q === 'object' && keysWithin(q, ['min', 'max']) && isInt(q.min) && isInt(q.max) && q.min <= q.max) {
    return { min: fairPrice(q.min), max: fairPrice(q.max) };
  }
  throw new Error(`${where}: emerald quantity ${JSON.stringify(q)} is not a vanilla shape this pack knows`);
}

// The emerald entries of one side of a trade (wants or gives), in both vanilla formats:
// { item, quantity, price_multiplier } and { choice: [{ item, quantity, functions, price_multiplier }] }.
function emeraldEntries(side, where) {
  const found = [];
  for (const entry of side || []) {
    if (entry.choice) {
      if (!Array.isArray(entry.choice)) throw new Error(`${where}: "choice" is not a list`);
      const emeralds = entry.choice.filter(isEmerald);
      if (emeralds.length && emeralds.length !== entry.choice.length) throw new Error(`${where}: a choice mixes emeralds with other items`);
      if (emeralds.length > 1) throw new Error(`${where}: a choice with several emerald options`);
      found.push(...emeralds.map(e => ({ entry: e, allowed: ['item', 'quantity', 'functions', 'price_multiplier'] })));
    } else if (isEmerald(entry)) {
      found.push({ entry, allowed: ['item', 'quantity', 'price_multiplier'] });
    }
  }
  return found;
}

// One trade → { before, after } of its emerald price when it changes, else null. Changes the
// trade in place. Only trades in which the villager SELLS something are touched: the emeralds the
// player pays. A trade that pays out emeralds (the villager buys) is never changed.
export function fairTrade(trade, where) {
  if (!Array.isArray(trade.wants) || !Array.isArray(trade.gives)) throw new Error(`${where}: a trade without wants/gives`);
  const pays = emeraldEntries(trade.wants, where);
  const paysOut = emeraldEntries(trade.gives, where);
  if (!pays.length) return null;
  if (paysOut.length) throw new Error(`${where}: a trade that takes and gives emeralds`);
  if (pays.length > 1) throw new Error(`${where}: more than one emerald price in a trade`);
  const { entry, allowed } = pays[0];
  if (!keysWithin(entry, allowed)) throw new Error(`${where}: emerald price with unexpected fields ${Object.keys(entry).join(', ')}`);
  if (entry.functions && !(Array.isArray(entry.functions) && entry.functions.length === 0)) throw new Error(`${where}: emerald price with functions`);
  // No quantity: the price is 1 (rabbit stew) or set by a function on what the villager gives
  // (enchanted books). 1 cannot go lower and the books are left for their own update.
  if (entry.quantity === undefined) return null;
  const before = entry.quantity;
  const after = fairQuantity(before, where);
  if (JSON.stringify(after) === JSON.stringify(before)) return null;
  entry.quantity = after;
  return { before, after };
}

const tradesOf = table => table.tiers.flatMap((tier, t) => {
  if (!Array.isArray(tier.groups)) throw new Error(`tier ${t}: no groups (a trade table shape this pack does not know)`);
  return tier.groups.flatMap((g, gi) => g.trades.map((trade, i) => ({ trade, where: `tier ${t} group ${gi} trade ${i}` })));
});

// The economy tables villager_v2.json uses, in file order. → ['trading/economy_trades/…', …]
export function tablesOf(entity) {
  const groups = entity?.['minecraft:entity']?.component_groups;
  if (!groups) throw new Error(`${ENTITY}: no component groups`);
  const tables = Object.values(groups).map(g => g['minecraft:economy_trade_table']?.table).filter(Boolean);
  if (tables.length < 13) throw new Error(`${ENTITY}: only ${tables.length} economy trade tables (vanilla 1.26.60 has 13 professions)`);
  for (const t of tables) if (!/^trading\/economy_trades\/[a-z_]+_trades\.json$/.test(t)) throw new Error(`${ENTITY}: unexpected trade table ${t}`);
  return [...new Set(tables)];
}

// What one emerald buys or fetches, per item, across all tables: a villager must never pay more
// for an item than another villager sells it for (else trading in a circle makes emeralds).
function loops(tables) {
  const sells = new Map(); // item → most units per emerald a player can buy
  const buys = new Map();  // item → fewest units a villager wants for one emerald
  const qmin = q => (typeof q === 'object' ? q.min : q ?? 1);
  const qmax = q => (typeof q === 'object' ? q.max : q ?? 1);
  const flat = side => side.flatMap(e => (e.choice ? e.choice : [e]));
  for (const table of tables) {
    for (const { trade } of tradesOf(table)) {
      const wants = flat(trade.wants), gives = flat(trade.gives);
      if (wants.length === 1 && isEmerald(wants[0])) {
        for (const g of gives) if (!isEmerald(g)) sells.set(g.item, Math.max(sells.get(g.item) ?? 0, qmax(g.quantity) / qmin(wants[0].quantity)));
      }
      if (gives.length === 1 && isEmerald(gives[0])) {
        for (const w of wants) if (!isEmerald(w)) buys.set(w.item, Math.min(buys.get(w.item) ?? Infinity, qmin(w.quantity) / qmax(gives[0].quantity)));
      }
    }
  }
  return [...sells].filter(([item, perEmerald]) => buys.has(item) && perEmerald > buys.get(item)).map(([item]) => item);
}

export default async function ({ vanilla, vanillaFiles }) {
  const tables = tablesOf(vanilla('bp', ENTITY));
  const files = {};
  const changed = [];
  // Tables that stay vanilla: the wandering trader's and any profession without a price to lower.
  const others = vanillaFiles('bp', 'trading/economy_trades').filter(f => !tables.includes(f.rel)).map(f => f.json);
  for (const rel of tables) {
    const original = vanilla('bp', rel);
    if (!original?.tiers?.length) throw new Error(`${rel}: missing or without tiers`);
    const table = structuredClone(original);
    let count = 0;
    for (const { trade, where } of tradesOf(table)) {
      const change = fairTrade(trade, `${rel} ${where}`);
      if (change) count++;
    }
    // Butcher and stone mason sell everything for 1 emerald in 1.26.60: nothing to lower, so
    // their vanilla tables are not replaced at all (fewer clashes with other packs).
    if (!count) { others.push(original); continue; }
    changed.push(table);
    files[`bp/${rel}`] = table;
  }
  if (changed.length < 10) throw new Error(`only ${changed.length} professions got fairer prices; the vanilla tables look different from 1.26.60`);
  // The unchanged tables are part of the circle check too.
  const circle = loops([...changed, ...others]);
  if (circle.length) throw new Error(`buying and selling ${circle.join(', ')} in a circle would make emeralds`);
  return files;
}
