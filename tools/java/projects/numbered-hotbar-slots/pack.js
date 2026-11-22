// Numbered Hotbar Slots: small digits 1 to 9 in the top-left corner of the nine hotbar slots, so
// players see which number key picks which slot. The texture is the version's own vanilla hotbar
// sprite with the digits laid over it; nothing else changes (the selection frame stays vanilla).
//
// Layout (vanilla Gui code, checked in the 26.3 client jar, Hud.extractItemHotbar; the sprite is
// byte-identical in every release from 1.21.1 to 26.3):
//   the sprite is 182 × 22 and drawn at (centre − 91, bottom − 22)
//   slot i (0–8) has its 16 × 16 inside at x = 3 + 20 i, y = 3: exactly where the item icon goes
//   the selection frame (24 × 23, drawn one pixel up and left) is transparent over that inside
//   the stack count is drawn bottom-right, the durability bar along the bottom
// So the digit sits in the top-left corner of the inside, one pixel in from its dark edge. Items
// are drawn over the hotbar, so an icon that fills that corner hides the digit, never the other way round.
//
// Digits: a hand-made 3 × 5 pixel table. The vanilla font digits (textures/font/ascii.png) are
// 5 × 7 and would cover a third of the slot; 3 × 5 is the smallest size that keeps every digit
// readable. Each digit gets a one-pixel shadow down and right, like the game's own text.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const SPRITE = 'textures/gui/sprites/hud/hotbar.png';
export const SIZE = [182, 22];
export const SLOTS = 9;
export const PITCH = 20;
export const INSIDE = { x: 3, y: 3, size: 16 };
// Where the digit starts inside a slot (pixels from the inside's top-left corner).
export const OFFSET = { x: 1, y: 1 };
// RGBA. The colours are the one place to change for later colour choices.
export const INK = [224, 224, 224, 255];
export const SHADOW = [40, 40, 40, 255];

// 3 × 5 digits, '#' = ink.
export const DIGITS = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '..#', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.']
};

// The pixels of the overlay: [{ x, y, rgba }], shadow first so the ink of a digit always wins.
export function digitPixels() {
  const shadow = [];
  const ink = [];
  for (let i = 0; i < SLOTS; i++) {
    const rows = DIGITS[i + 1];
    if (rows.length !== 5 || rows.some(r => r.length !== 3)) throw new Error(`digit ${i + 1} is not 3 × 5`);
    const left = INSIDE.x + PITCH * i + OFFSET.x;
    const top = INSIDE.y + OFFSET.y;
    rows.forEach((row, dy) => [...row].forEach((c, dx) => {
      if (c !== '#') return;
      ink.push({ x: left + dx, y: top + dy, rgba: INK });
      shadow.push({ x: left + dx + 1, y: top + dy + 1, rgba: SHADOW });
    }));
  }
  const inked = new Set(ink.map(p => `${p.x},${p.y}`));
  return [...shadow.filter(p => !inked.has(`${p.x},${p.y}`)), ...ink];
}

// The vanilla sprite with the digits on it. → PNG buffer
export async function numberedHotbar(file) {
  const base = sharp(file).ensureAlpha();
  const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SIZE[0] || info.height !== SIZE[1]) throw new Error(`${file}: ${info.width} × ${info.height}, expected ${SIZE.join(' × ')} (the slot positions would be wrong)`);
  const overlay = Buffer.alloc(info.width * info.height * 4);
  for (const { x, y, rgba } of digitPixels()) {
    // Every digit and shadow pixel must land on the see-through inside of a slot, never on the frame.
    const slot = Math.floor((x - INSIDE.x) / PITCH);
    const inX = x - INSIDE.x - PITCH * slot;
    const inY = y - INSIDE.y;
    if (slot < 0 || slot >= SLOTS || inX < 1 || inX >= INSIDE.size - 1 || inY < 1 || inY >= INSIDE.size - 1) throw new Error(`pixel ${x},${y} lies outside a slot`);
    const at = (y * info.width + x) * 4;
    if (data[at + 3] === 255) throw new Error(`${file}: pixel ${x},${y} is opaque, the slots are not where they used to be`);
    overlay.set(rgba, at);
  }
  return base.composite([{ input: overlay, raw: { width: info.width, height: info.height, channels: 4 } }]).png().toBuffer();
}

export default async function ({ vanilla }) {
  const file = path.join(vanilla.assets, 'minecraft', SPRITE);
  if (!fs.existsSync(file)) throw new Error(`vanilla has no ${SPRITE}`);
  if (fs.existsSync(`${file}.mcmeta`)) throw new Error(`${SPRITE}.mcmeta exists in this version: check its scaling before overriding the sprite`);
  return { [`assets/minecraft/${SPRITE}`]: await numberedHotbar(file) };
}
