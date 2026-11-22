// Anglers Haul: more treasure and less junk on the fishing rod. Only the weights of the three
// sub-tables change; the sub-tables themselves (which fish, which junk, which treasure) stay vanilla.
// The fishing hook (entities/fishing_hook.json) rolls loot_tables/gameplay/fishing.json, and
// loot_tables/gameplay/jungle_fishing.json when it is cast in a jungle biome. Both pick one of
// junk / treasure / fish by weight; "quality" shifts the weight by quality × luck (Luck of the Sea
// level), which is how the enchantment works and stays as it is. The Bedrock tables have no
// condition (no open-water rule), so there is nothing else to keep.
//
// Weights (junk / treasure / fish):  vanilla 10 / 5 / 85  →  7 / 8 / 85
// Junk stays above zero even with Luck of the Sea III (7 − 2·3 = 1), so no weight ever turns
// negative. Odds per cast: see odds() and the report; the page quotes the unenchanted ones.
const ROOT = 'loot_tables/gameplay';
export const TABLES = {
  [`${ROOT}/fishing.json`]: { junk: `${ROOT}/fishing/junk.json`, treasure: `${ROOT}/fishing/treasure.json`, fish: `${ROOT}/fishing/fish.json` },
  [`${ROOT}/jungle_fishing.json`]: { junk: `${ROOT}/fishing/jungle_junk.json`, treasure: `${ROOT}/fishing/treasure.json`, fish: `${ROOT}/fishing/jungle_fish.json` }
};
// part: [vanilla weight, quality, our weight]
export const WEIGHTS = { junk: [10, -2, 7], treasure: [5, 2, 8], fish: [85, -1, 85] };

// Chance of each part per cast at a Luck of the Sea level, from the weights of a table:
// weight = max(0, floor(weight + quality × luck)), as loot tables do it. → { part: share 0..1 }
export function odds(entries, luck = 0) {
  const w = Object.fromEntries(Object.entries(entries).map(([part, [weight, quality]]) => [part, Math.max(0, Math.floor(weight + quality * luck))]));
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([part, x]) => [part, x / total]));
}

export function haul(table, rel) {
  const parts = TABLES[rel];
  const keys = o => Object.keys(o).sort().join(',');
  if (!table || keys(table) !== 'pools' || table.pools.length !== 1) throw new Error(`${rel}: expected one pool`);
  const pool = table.pools[0];
  if (keys(pool) !== 'entries,rolls' || pool.rolls !== 1) throw new Error(`${rel}: the pool is no longer one plain roll (${keys(pool)})`);
  if (pool.entries.length !== 3) throw new Error(`${rel}: expected three entries, found ${pool.entries.length}`);
  const out = structuredClone(table);
  for (const [part, sub] of Object.entries(parts)) {
    const i = pool.entries.findIndex(e => e.name === sub);
    const e = pool.entries[i];
    const [weight, quality, ours] = WEIGHTS[part];
    if (!e) throw new Error(`${rel}: no entry for ${sub}`);
    if (keys(e) !== 'name,quality,type,weight' || e.type !== 'loot_table') throw new Error(`${rel}: ${part} entry changed shape (${keys(e)})`);
    if (e.weight !== weight || e.quality !== quality) throw new Error(`${rel}: ${part} has weight ${e.weight} / quality ${e.quality}, expected ${weight} / ${quality}`);
    out.pools[0].entries[i].weight = ours;
  }
  return out;
}

export default async function ({ vanilla }) {
  const hook = vanilla('bp', 'entities/fishing_hook.json');
  const used = JSON.stringify(hook).match(/loot_tables\/gameplay\/[a-z_]+\.json/g)?.sort() || [];
  if (JSON.stringify([...new Set(used)]) !== JSON.stringify(Object.keys(TABLES).sort())) throw new Error(`the fishing hook uses ${used.join(', ')}, expected ${Object.keys(TABLES).join(', ')}`);
  const files = {};
  for (const rel of Object.keys(TABLES)) files[`bp/${rel}`] = haul(vanilla('bp', rel), rel);
  return files;
}
