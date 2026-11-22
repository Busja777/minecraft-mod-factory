// Shield Down Low: the shield held in first person sits lower and a bit further out to the side,
// idle and while blocking, so it covers less of the view. Third person, the inventory, item frames,
// shelves and the dropped item stay vanilla.
//
// How: the two shield item models (models/item/shield.json for the idle shield,
// models/item/shield_blocking.json for the raised one) are copied from the version's own vanilla
// files and only the translation of firstperson_righthand and firstperson_lefthand changes. Every
// other key (parent, overrides, gui_light, textures, rotation, scale, the other display contexts)
// stays byte-for-byte what that version ships.
//
// Which model the game picks for blocking, per version (vanilla files, checked below):
//   1.21.1–1.21.3  shield.json has the parent builtin/entity and an override with the predicate
//                  "blocking": 1 that switches to item/shield_blocking. Kept as it is.
//   1.21.4 on      items/shield.json is a condition on minecraft:using_item whose two branches are
//                  special "minecraft:shield" models with base item/shield and item/shield_blocking.
//                  The base model gives the display transforms (SpecialModelWrapper, 26.3 client
//                  jar), so the item definition itself is not overridden.
//
// Directions (ItemTransform.apply, 26.3 client jar): the translation is in 1/16 block, applied
// before rotation and scale, in view space (y up). For the left hand the game negates x, so a
// larger x moves the shield outward (away from the crosshair) in both hands: x += out, y -= down.
//
// The numbers (estimated from the vanilla 26.3 values and the first-person geometry, not yet seen
// in the game). The hand is always drawn with a fixed field of view of 70, whatever the FOV slider
// says, so these offsets look the same for everyone.
//   blocking  The raised shield in the off hand reaches just above the crosshair in vanilla.
//             4 down (1/4 block) puts its top edge about a third of the way from the crosshair to
//             the bottom of the screen, so the middle of the view is free while most of the shield
//             still shows; 2 out moves it a bit away from the crosshair column.
//   idle      Already low in vanilla (its upper part shows in the bottom corner, about a quarter of
//             the screen high in the off hand). 3 down still leaves roughly a tenth of the screen
//             height of shield visible in the off hand, so the player sees it is there.
//             Idle 1 less than blocking keeps the "raise" cue: the off-hand shield still goes up by
//             4 units when blocking (vanilla 5), the main-hand one keeps its vanilla sideways move.
// The rotation stays as is, so the shield keeps its familiar angle.
import fs from 'fs';
import path from 'path';

export const MODELS = { idle: 'item/shield', blocking: 'item/shield_blocking' };
// SHIFT is the one table to change for later variants (other heights).
export const SHIFT = {
  idle: { down: 3, out: 2 },
  blocking: { down: 4, out: 2 }
};
export const HANDS = ['firstperson_righthand', 'firstperson_lefthand'];
// The game clamps display translations to ±80.
const LIMIT = 80;
const round = v => Math.round(v * 10000) / 10000;
const strip = id => String(id).replace(/^minecraft:/, '');

// A vanilla shield model with both first-person transforms moved. Pure, the input stays unchanged.
export function lowered(model, { down, out }, name = 'model') {
  if (!(down > 0) || !(out >= 0)) throw new Error(`${name}: down must be > 0 and out ≥ 0`);
  const copy = structuredClone(model);
  for (const hand of HANDS) {
    const t = copy.display?.[hand]?.translation;
    if (!Array.isArray(t) || t.length !== 3 || t.some(v => typeof v !== 'number')) throw new Error(`${name}: vanilla has no ${hand} translation [x, y, z]`);
    const moved = [round(t[0] + out), round(t[1] - down), t[2]];
    if (moved.some(v => Math.abs(v) > LIMIT)) throw new Error(`${name}: ${hand} translation ${moved} lies outside ±${LIMIT}, the game would clamp it`);
    copy.display[hand].translation = moved;
  }
  return copy;
}

// Makes sure the two models are the ones this version uses for the idle and the raised shield.
export function checkWiring(idle, item) {
  if (item) {
    const m = item.model;
    const base = branch => m?.[branch]?.type && strip(m[branch].type) === 'special' && strip(m[branch].model?.type) === 'shield' ? strip(m[branch].base) : null;
    if (strip(m?.type) !== 'condition' || strip(m.property) !== 'using_item') throw new Error('items/shield.json is no longer a condition on using_item');
    if (base('on_false') !== MODELS.idle || base('on_true') !== MODELS.blocking) throw new Error(`items/shield.json uses ${base('on_false')} / ${base('on_true')}, expected ${MODELS.idle} / ${MODELS.blocking}`);
    if (idle.overrides) throw new Error('models/item/shield.json still has overrides next to items/shield.json');
  } else {
    const blocking = (idle.overrides || []).filter(o => o.predicate?.blocking === 1 && strip(o.model) === MODELS.blocking);
    if (blocking.length !== 1 || idle.overrides.length !== 1) throw new Error(`models/item/shield.json: expected one override "blocking": 1 → ${MODELS.blocking}`);
  }
}

export default async function ({ vanilla }) {
  const read = file => {
    const full = path.join(vanilla.assets, 'minecraft', file);
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, 'utf-8'));
  };
  const files = {};
  const models = {};
  for (const [state, model] of Object.entries(MODELS)) {
    const file = `models/${model}.json`;
    models[state] = read(file);
    if (!models[state]) throw new Error(`vanilla has no ${file}`);
    files[`assets/minecraft/${file}`] = lowered(models[state], SHIFT[state], file);
  }
  checkWiring(models.idle, read('items/shield.json'));
  return files;
}
