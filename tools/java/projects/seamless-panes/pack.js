// Seamless Panes: plain glass without the frame lines, so a window of several glass blocks reads as
// one clear surface instead of a grid. The texture is not drawn by hand: each Minecraft version's
// own vanilla textures/block/glass.png is read and only its outer ring of pixels (the frame) is
// made transparent, exactly like the transparent pixels inside it. The small diagonal highlight
// streaks stay as they are, so glass is still visible and the player does not walk into "nothing".
//
// Why only fully transparent or fully opaque pixels (no faint half-transparent edge):
// - 1.21.1 draws the glass block in the cutout layer (ItemBlockRenderTypes: GLASS → RenderType
//   cutout, the glass pane → cutout_mipped, stained and tinted glass → translucent; read from the
//   1.21.1 client jar). Cutout has no blending: a pixel with alpha below 0.1 is dropped, every
//   other one is drawn fully opaque. A faint edge would become a solid line again.
// - From 26.1 on the layer follows the texture (ChunkSectionLayer.byTransparency over the sprite
//   area of each face), and the vanilla glass and glass pane models force theirs to translucent
//   ("force_translucent": true, 26.3 assets; the beacon's glass shell is not forced). There a faint
//   edge would blend, in 1.21.1 it would not, so the two versions would look different.
// So the texture keeps the vanilla rule of glass.png: alpha 0 or 255 only. The build checks it.
//
// What else reads block/glass (checked against every version's own models, see READERS): the
// glass pane faces (the pane edge is glass_pane_top.png, which stays vanilla), the glass item and
// the glass pane item icon, the glass shell of the beacon and the glass breaking particles.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// The textures this pack clears. One table for later updates (stained glass, pane edges).
export const TEXTURES = ['block/glass'];

// Vanilla block models that use block/glass. If a version adds or drops one, the build stops, so
// the page never claims less (or more) than the pack changes.
export const READERS = {
  'block/glass': ['beacon', 'glass', 'glass_pane_noside', 'glass_pane_noside_alt', 'glass_pane_post', 'glass_pane_side', 'glass_pane_side_alt']
};

const isRing = (x, y, w, h) => x === 0 || y === 0 || x === w - 1 || y === h - 1;

// A vanilla glass texture without its frame. png: Buffer of the vanilla file.
// → { png: Buffer, changed: [{ x, y, from: [r, g, b, a], to: [r, g, b, a] }] }
export async function withoutFrame(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  if (w !== h) throw new Error(`glass texture is ${w}×${h}; an animated or non-square texture needs a new design`);
  const at = (x, y) => [...data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)];
  const clear = new Set();
  let highlights = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = at(x, y);
      if (px[3] !== 0 && px[3] !== 255) throw new Error(`pixel ${x},${y} has alpha ${px[3]}: vanilla glass is cutout (0 or 255 only), the design assumes that`);
      if (isRing(x, y, w, h)) { if (px[3] !== 255) throw new Error(`pixel ${x},${y} of the frame is not opaque: the vanilla frame is not where it was`); continue; }
      if (px[3] === 0) clear.add(px.join(','));
      else highlights++;
    }
  }
  // The frame becomes exactly what the transparent inside of the texture is (colour included, it
  // matters for mipmaps and texture filtering).
  if (clear.size !== 1) throw new Error(`the transparent inside of glass has ${clear.size} different values, expected one`);
  if (!highlights) throw new Error('glass has no highlight pixels inside the frame; without the frame it would be invisible');
  const to = [...clear][0].split(',').map(Number);
  const out = Buffer.from(data);
  const changed = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isRing(x, y, w, h)) continue;
      changed.push({ x, y, from: at(x, y), to });
      out.set(to, (y * w + x) * 4);
    }
  }
  const result = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  // The encoder must keep every pixel, the colour of transparent ones too.
  const back = await sharp(result).ensureAlpha().raw().toBuffer();
  if (!back.equals(out)) throw new Error('the PNG encoder changed pixels');
  return { png: result, changed };
}

// The vanilla block models of a version whose textures point at `texture` (e.g. 'block/glass').
export function readersOf(assets, texture) {
  const dir = path.join(assets, 'minecraft', 'models', 'block');
  const wanted = new Set([texture, `minecraft:${texture}`]);
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).filter(f => {
    const model = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    // 1.21.1: "all": "minecraft:block/glass"; 26.1 on: "all": { "sprite": "minecraft:block/glass", "force_translucent": true }
    return Object.values(model.textures || {}).some(t => wanted.has(typeof t === 'string' ? t : t?.sprite));
  }).map(f => f.replace(/\.json$/, '')).sort();
}

export default async function ({ vanilla, version }) {
  const files = {};
  for (const texture of TEXTURES) {
    const readers = readersOf(vanilla.assets, texture);
    if (readers.join() !== READERS[texture].join()) throw new Error(`Minecraft ${version}: ${texture} is used by ${readers.join(', ')}, expected ${READERS[texture].join(', ')}`);
    const file = path.join(vanilla.assets, 'minecraft', 'textures', `${texture}.png`);
    if (!fs.existsSync(file)) throw new Error(`Minecraft ${version} has no textures/${texture}.png`);
    files[`assets/minecraft/textures/${texture}.png`] = (await withoutFrame(fs.readFileSync(file))).png;
  }
  return files;
}
