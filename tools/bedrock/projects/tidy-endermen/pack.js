// Tidy Endermen: endermen no longer pick up or place blocks. Everything else about them stays
// vanilla: health, attack, teleporting, anger when looked at, the carved pumpkin, loot, spawning.
//
// Built from the vanilla behavior pack's entities/enderman.json of the release. A behavior pack's
// entity file replaces vanilla's whole definition of that entity, so the pack ships the complete
// vanilla file and only drops the two behaviours that move blocks:
//   minecraft:behavior.take_block   (picks up a block from the list nearby)
//   minecraft:behavior.place_block  (puts the carried block down again)
// Both sit in the always-on "components" of vanilla's file. The build stops if they move, change
// their name, or if any other place of the file still mentions taking or placing blocks.
export const REMOVED = ['minecraft:behavior.take_block', 'minecraft:behavior.place_block'];
const FILE = 'entities/enderman.json';

export default async function ({ vanilla }) {
  const original = vanilla('bp', FILE);
  const entity = original?.['minecraft:entity'];
  if (entity?.description?.identifier !== 'minecraft:enderman') throw new Error(`${FILE} is not the enderman any more`);
  const copy = structuredClone(original);
  const components = copy['minecraft:entity'].components;
  for (const key of REMOVED) {
    if (!components?.[key]) throw new Error(`${FILE}: ${key} is no longer in the enderman's components`);
    delete components[key];
  }
  const left = JSON.stringify(copy).match(/[a-z_:.]*(take|place)_block[a-z_]*/g);
  if (left) throw new Error(`${FILE}: block moving still appears elsewhere (${[...new Set(left)].join(', ')})`);
  return { [`bp/${FILE}`]: copy };
}
