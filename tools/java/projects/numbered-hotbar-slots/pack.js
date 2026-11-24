// Numbered Hotbar Slots: a small digit 1 to 9 in the top-left corner of each hotbar slot, so you
// see which number key selects which slot. Only one file changes: the hotbar sprite
// (textures/gui/sprites/hud/hotbar.png). It is read from each version's own vanilla assets and
// only the digit pixels are drawn over it; every other pixel stays exactly as in vanilla.
//
// Where the digit sits (checked in the 26.3 client jar, Hud.extractItemHotbar, and the same in
// 1.21.1): the hotbar is drawn 182 × 22 at its own size; slot i (0 to 8) has a 16 × 16 see-through
// inner square at x = 3 + 20 i, y = 3, and the item of the slot is drawn exactly on that square
// (x = 3 + 20 i, y = 3). Around it lies the grey frame, at most 2 px wide on any side of one slot,
// too narrow for a digit; and the frame of the selected slot (hotbar_selection.png, 24 × 23) covers
// everything of the slot except that inner square. So the digit goes into the inner square, in its
// top-left corner, flush with its edge:
// - Tools, weapons and most flat items point from bottom left to top right and leave that corner
//   empty. A block is drawn as a cube (gui display: rotation 30/225, scale 0.625) whose upper
//   left edge runs from (8, 0) to (1, 3.7) of the inner square: it hides the digit's bottom-right
//   2 × 2 pixels, the top three rows and the left column stay visible.
// - The item count is drawn at the bottom right, the durability bar along the bottom.
// - The digit stays visible on the selected slot.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const SPRITE = 'textures/gui/sprites/hud/hotbar.png';
// The hotbar's size and slot layout the digits are placed for; a version whose sprite differs fails the build.
export const SIZE = { width: 182, height: 22 };
export const SLOTS = 9;
export const INNER = { x: 3, y: 3, size: 16, step: 20 };

// Our own 3 × 5 pixel digits ("#" = drawn), one row per string.
export const FONT = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.']
};

// The look; one table for later updates (colours, a subtle variant).
//   at      offset of the digit inside the slot's inner square
//   digit   RGBA of the digit pixels (light grey)
//   shadow  RGBA of the shadow, one pixel to the right and below, where no digit pixel is
export const STYLE = { at: [0, 0], digit: [214, 214, 214, 255], shadow: [28, 28, 28, 255] };

// The pixels to draw for slot `slot` (1 to 9): [{ x, y, rgba }], shadow first, then the digit on top.
export function digitPixels(slot, style = STYLE) {
  const rows = FONT[slot];
  if (!rows) throw new Error(`no digit for slot ${slot}`);
  const x0 = INNER.x + INNER.step * (slot - 1) + style.at[0];
  const y0 = INNER.y + style.at[1];
  const on = new Set();
  rows.forEach((row, dy) => [...row].forEach((c, dx) => { if (c === '#') on.add(`${dx},${dy}`); }));
  const out = [];
  for (const key of on) {
    const [dx, dy] = key.split(',').map(Number);
    if (!on.has(`${dx + 1},${dy + 1}`)) out.push({ x: x0 + dx + 1, y: y0 + dy + 1, rgba: style.shadow });
  }
  for (const key of on) {
    const [dx, dy] = key.split(',').map(Number);
    out.push({ x: x0 + dx, y: y0 + dy, rgba: style.digit });
  }
  for (const { x, y } of out) {
    const ix = x - INNER.x - INNER.step * (slot - 1);
    if (ix < 0 || ix >= INNER.size || y < INNER.y || y >= INNER.y + INNER.size) throw new Error(`slot ${slot}: pixel ${x},${y} lies outside the inner square`);
  }
  return out;
}

// RGBA pixels of the vanilla hotbar (Buffer, SIZE) with the digits 1 to 9 drawn in. Pure.
export function numbered(raw, style = STYLE) {
  const out = Buffer.from(raw);
  for (let slot = 1; slot <= SLOTS; slot++) {
    for (const { x, y, rgba } of digitPixels(slot, style)) out.set(rgba, (y * SIZE.width + x) * 4);
  }
  return out;
}

// The vanilla sprite as RGBA, after checking it is the layout the digits are placed for: the size,
// no .mcmeta (scaling) and a see-through inner square in every slot.
export async function vanillaHotbar(vanilla) {
  const file = path.join(vanilla.assets, 'minecraft', SPRITE);
  if (!fs.existsSync(file)) throw new Error(`vanilla has no ${SPRITE}`);
  if (fs.existsSync(`${file}.mcmeta`)) throw new Error(`vanilla has ${SPRITE}.mcmeta now: check how the game scales the hotbar`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SIZE.width || info.height !== SIZE.height || info.channels !== 4) throw new Error(`vanilla ${SPRITE} is ${info.width} × ${info.height}, expected ${SIZE.width} × ${SIZE.height}`);
  for (let slot = 0; slot < SLOTS; slot++) {
    for (let y = INNER.y; y < INNER.y + INNER.size; y++) {
      for (let x = INNER.x + INNER.step * slot; x < INNER.x + INNER.step * slot + INNER.size; x++) {
        if (data[(y * SIZE.width + x) * 4 + 3] === 255) throw new Error(`vanilla ${SPRITE}: slot ${slot + 1} is not where expected (pixel ${x},${y} is opaque)`);
      }
    }
  }
  return data;
}

export default async function ({ vanilla }) {
  const png = await sharp(numbered(await vanillaHotbar(vanilla)), { raw: { ...SIZE, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  return { [`assets/minecraft/${SPRITE}`]: png };
}
