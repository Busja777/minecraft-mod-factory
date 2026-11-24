// Shield Down Low: the shield sits lower in first-person view, so it covers less of the screen,
// both while it is just held and while blocking. Only the first-person display transforms of the
// two vanilla shield models change (models/item/shield.json and shield_blocking.json): their
// "translation" is moved down. Rotation, scale, third person, GUI, item frame, ground and shelf
// stay exactly as in the vanilla file of each version, which is read from that version's own
// client assets and only changed in the first-person translations.
//
// Both poses move down by the same amount, so raising the shield to block still looks the same
// (it comes up and turns towards the middle as in vanilla), it just starts and ends lower.
//
// How the versions read the shield:
// - 1.21.1 to 1.21.3: models/item/shield.json (parent builtin/entity) with an override on the
//   "blocking" predicate to shield_blocking.json.
// - 1.21.4 and newer: items/shield.json picks the model ("minecraft:using_item") and draws the
//   special "minecraft:shield" model with the display transforms of models/item/shield.json or
//   shield_blocking.json as its base. That item definition stays vanilla; only the two models are
//   replaced, without a parent and without overrides, as the version's own files are written.
//   26.1 moved the right-hand vanilla values a little (1.75 instead of 2, 3.25 instead of 5) and
//   1.21.9 added the "on_shelf" transform; each version's files keep whatever it ships.
import fs from 'fs';
import path from 'path';

// How far (in model pixels, 1/16 of a block) each pose moves down in first person. One table for
// later updates (variants "lower" and "lowest").
export const DROP = { shield: 4, shield_blocking: 4 };
export const HANDS = ['firstperson_righthand', 'firstperson_lefthand'];
// The game clamps a display translation to ±80.
const LIMIT = 80;

// The vanilla model with its first-person translations lowered by `drop`; everything else as it is.
export function lowered(model, drop) {
  const out = structuredClone(model);
  for (const hand of HANDS) {
    const t = out.display?.[hand]?.translation;
    if (!Array.isArray(t) || t.length !== 3 || !t.every(Number.isFinite)) throw new Error(`the vanilla model has no ${hand} translation`);
    const y = t[1] - drop;
    if (Math.abs(y) > LIMIT) throw new Error(`${hand}: translation ${y} lies outside ±${LIMIT}`);
    out.display[hand].translation = [t[0], y, t[2]];
  }
  return out;
}

export default async function ({ vanilla }) {
  const files = {};
  for (const [name, drop] of Object.entries(DROP)) {
    const file = path.join(vanilla.assets, 'minecraft', 'models', 'item', `${name}.json`);
    if (!fs.existsSync(file)) throw new Error(`vanilla has no models/item/${name}.json`);
    files[`assets/minecraft/models/item/${name}.json`] = lowered(JSON.parse(fs.readFileSync(file, 'utf-8')), drop);
  }
  return files;
}
