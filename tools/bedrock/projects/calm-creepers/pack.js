// Calm Creepers: creeper explosions no longer destroy blocks. Everything else about the blast
// (power, fuse, damage and knockback to players and mobs, the mobGriefing rule) stays vanilla.
// Bedrock describes the blast in "minecraft:explode", one per component group: the normal and the
// charged creeper, each once for the usual fuse and once lit with flint and steel ("forced").
// The field that decides about blocks is "breaks_blocks" (default true, per Mojang's entity
// documentation in metadata/doc_modules/entities.json: "If true, the explosion will destroy blocks
// in the explosion radius."). Vanilla leaves it out; this pack sets it to false in all four groups
// and touches nothing else, so TNT, ghasts, withers and every other explosion stay as they are.
export const GROUPS = {
  'minecraft:exploding': 3,
  'minecraft:forced_exploding': 3,
  'minecraft:charged_exploding': 6,
  'minecraft:forced_charged_exploding': 6
};
const FILE = 'entities/creeper.json';

// Every place a key appears anywhere in a JSON value: [path strings]
export function findKey(value, key, at = '', found = []) {
  if (Array.isArray(value)) value.forEach((v, i) => findKey(v, key, `${at}[${i}]`, found));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === key) found.push(`${at}/${k}`);
      findKey(v, key, `${at}/${k}`, found);
    }
  }
  return found;
}

export function calm(creeper) {
  const entity = creeper?.['minecraft:entity'];
  if (entity?.description?.identifier !== 'minecraft:creeper') throw new Error(`${FILE}: not the vanilla creeper`);
  const groups = entity.component_groups || {};
  // Exactly the four explosions we expect, nowhere else (not in components, not in events).
  const where = findKey(creeper, 'minecraft:explode').sort();
  const expected = Object.keys(GROUPS).map(g => `/minecraft:entity/component_groups/${g}/minecraft:explode`).sort();
  if (JSON.stringify(where) !== JSON.stringify(expected)) throw new Error(`${FILE}: minecraft:explode found at ${where.join(', ')}, expected ${expected.join(', ')}`);
  const out = structuredClone(creeper);
  for (const [group, power] of Object.entries(GROUPS)) {
    const explode = groups[group]['minecraft:explode'];
    if (explode.power !== power) throw new Error(`${FILE}: ${group} has power ${explode.power}, expected ${power}`);
    if ('breaks_blocks' in explode && explode.breaks_blocks !== true) throw new Error(`${FILE}: ${group} already sets breaks_blocks = ${explode.breaks_blocks}`);
    if (explode.toggles_blocks) throw new Error(`${FILE}: ${group} toggles blocks now`);
    out['minecraft:entity'].component_groups[group]['minecraft:explode'] = { ...explode, breaks_blocks: false };
  }
  return out;
}

export default async function ({ vanilla }) {
  const creeper = vanilla('bp', FILE);
  if (!creeper) throw new Error(`${FILE} is missing in the samples`);
  return { [`bp/${FILE}`]: calm(creeper) };
}
