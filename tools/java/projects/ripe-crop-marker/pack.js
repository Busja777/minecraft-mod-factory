// Ripe Crop Marker: a crop that is ready to harvest shows a small sparkle near its top, so a ripe
// field is clear at a glance. Only the texture of the last growth stage of each crop changes; every
// earlier stage stays vanilla, so the sparkle appears exactly when the crop can be harvested.
//
// The texture is the version's own vanilla file, read from that version's client assets. The
// sparkle is drawn into it in code: a 5-pixel plus (white centre, golden arms) placed only on
// pixels that are fully transparent in vanilla and kept one pixel away from the plant, so every
// pixel of the plant stays exactly as it is and the sparkle floats just above the leaves. The size of
// the image and a .mcmeta next to it (none of these crops has one up to 26.3) are kept.
//
// Each crop block model draws its texture on four crossed planes, so the sparkle is seen from every
// side. Block-breaking particles use the same texture and may show a gold speck now and then.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// One table for later updates (more plants, a subtle variant):
//   texture  the last growth stage under textures/block/ (the vanilla name of every version up to 26.3)
//   at       [x, y] centre of the sparkle on the 16 × 16 texture (0, 0 is the top left)
export const CROPS = [
  { crop: 'wheat', texture: 'wheat_stage7', at: [14, 1] },
  { crop: 'carrots', texture: 'carrots_stage3', at: [14, 1] },
  { crop: 'potatoes', texture: 'potatoes_stage3', at: [14, 1] },
  { crop: 'beetroots', texture: 'beetroots_stage3', at: [14, 4] },
  { crop: 'nether wart', texture: 'nether_wart_stage2', at: [14, 1] }
];

// The sparkle: offsets from its centre and the colour of each pixel (RGBA, fully opaque, because crops
// are drawn as cutout and only show pixels that are clearly opaque).
const CORE = [255, 255, 226, 255];
const ARM = [255, 206, 64, 255];
export const SPARKLE = [
  { dx: 0, dy: 0, rgba: CORE },
  { dx: 0, dy: -1, rgba: ARM }, { dx: -1, dy: 0, rgba: ARM }, { dx: 1, dy: 0, rgba: ARM }, { dx: 0, dy: 1, rgba: ARM }
];

// raw: RGBA pixels of the vanilla texture (width × height × 4). → a new buffer with the sparkle at
// `at`. Throws when a sparkle pixel would leave the image, cover a pixel of the plant or touch one
// (the 8 pixels around it must be transparent too, unless they are part of the sparkle).
export function marked(raw, width, height, [cx, cy]) {
  if (raw.length !== width * height * 4) throw new Error(`expected ${width}×${height} RGBA pixels`);
  const out = Buffer.from(raw);
  const mine = new Set(SPARKLE.map(({ dx, dy }) => `${cx + dx},${cy + dy}`));
  const alpha = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : raw[(y * width + x) * 4 + 3]);
  for (const { dx, dy, rgba } of SPARKLE) {
    const [x, y] = [cx + dx, cy + dy];
    if (x < 0 || y < 0 || x >= width || y >= height) throw new Error(`sparkle pixel ${x},${y} lies outside the ${width}×${height} texture`);
    for (let ny = y - 1; ny <= y + 1; ny++) for (let nx = x - 1; nx <= x + 1; nx++) {
      if (alpha(nx, ny) !== 0 && !mine.has(`${nx},${ny}`)) throw new Error(`sparkle pixel ${x},${y} would cover or touch the plant at ${nx},${ny}`);
    }
    out.set(rgba, (y * width + x) * 4);
  }
  return out;
}

const PNG = { compressionLevel: 9, palette: false };

export default async function ({ vanilla }) {
  const files = {};
  for (const { crop, texture, at } of CROPS) {
    const rel = path.join('minecraft', 'textures', 'block', `${texture}.png`);
    const file = path.join(vanilla.assets, rel);
    if (!fs.existsSync(file)) throw new Error(`${crop}: vanilla has no textures/block/${texture}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw new Error(`${crop}: expected RGBA pixels, got ${info.channels} channels`);
    let pixels;
    try { pixels = marked(data, info.width, info.height, at); } catch (e) { throw new Error(`${crop} (${texture}): ${e.message}`); }
    const out = `assets/minecraft/textures/block/${texture}.png`;
    files[out] = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).png(PNG).toBuffer();
    if (fs.existsSync(`${file}.mcmeta`)) files[`${out}.mcmeta`] = fs.readFileSync(`${file}.mcmeta`);
  }
  return files;
}
