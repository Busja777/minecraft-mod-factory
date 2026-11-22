// Clear Overlays: the two full-screen overlays that hide the most of the world get lighter, so you
// still see where you walk. Wearing a carved pumpkin keeps its face shape, but the dark part is
// see-through; the frost of powder snow keeps its look at the edges, only fainter.
//
// How the game draws them (checked in the 26.3 client, Hud.extractCameraOverlays and
// extractTextureOverlay; 1.21.1 does the same in Gui.renderCameraOverlays): the texture is stretched
// over the whole screen with the GUI_TEXTURED pipeline, which blends by the texture's own alpha,
// multiplied by a vertex colour of white × strength. The pumpkin is drawn with strength 1, the frost
// with getPercentFrozen() (it fades in while you freeze). So scaling the alpha of the texture scales
// how much of the world it covers, and nothing else changes: colours, shape and fade-in stay.
// In 26.3 the pumpkin overlay comes from the carved pumpkin's equippable component
// ("camera_overlay": misc/pumpkinblur, the only item in vanilla with one); 1.21.1 checks for the
// carved pumpkin directly. Either way it is the same texture.
//
// The vanilla textures (256 × 256, checked below for the version being built):
//   misc/pumpkinblur          all pixels black, the face is only in the alpha (holes near 0, the
//                             rest up to 255); byte-identical from 1.21.1 to 26.3; it has a .mcmeta
//                             with blur on, which the pack must carry itself (the game reads a
//                             texture's .mcmeta only from the pack that provides the texture or one
//                             above it, see Seamless Panes)
//   misc/powder_snow_outline  frost crystals at the edges, the middle fully clear; redrawn in 1.21.6
//                             (the 26.3 file set, which 1.21.2 to 1.21.5 also read, carries the new
//                             drawing, lighter); no .mcmeta
// Each version's own texture is the source, so the shapes stay exactly vanilla.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const SIZE = 256;
// texture → how much of its alpha stays, and the .mcmeta vanilla has for it (null: none).
export const OVERLAYS = {
  'misc/pumpkinblur': { keep: 0.4, mcmeta: { texture: { blur: true } } },
  'misc/powder_snow_outline': { keep: 0.5, mcmeta: null }
};

// Checks the vanilla texture against what the comments above say. data: raw RGBA.
export function check(name, data) {
  const alpha = (x, y) => data[(y * SIZE + x) * 4 + 3];
  let max = 0;
  for (let i = 3; i < data.length; i += 4) max = Math.max(max, data[i]);
  if (max < 200) throw new Error(`${name}: strongest pixel has alpha ${max}, the overlay is already light`);
  if (name === 'misc/pumpkinblur') {
    for (let i = 0; i < data.length; i += 4) if (data[i] || data[i + 1] || data[i + 2]) throw new Error(`${name}: pixel ${(i / 4) % SIZE},${Math.floor(i / 4 / SIZE)} is not black, the shape is no longer only in the alpha`);
    // The corners are solid dark, the eyes let the world through.
    for (const [x, y] of [[0, 0], [255, 0], [0, 255], [255, 255]]) if (alpha(x, y) !== 255) throw new Error(`${name}: corner ${x},${y} is not solid`);
    const holes = data.filter((v, i) => i % 4 === 3 && v === 0).length;
    if (holes < 500) throw new Error(`${name}: only ${holes} fully clear pixels, the face holes moved or closed`);
  } else {
    // The middle of the screen is free of frost.
    for (let y = 96; y < 160; y++) for (let x = 96; x < 160; x++) if (alpha(x, y)) throw new Error(`${name}: pixel ${x},${y} in the middle is not clear, the frost reaches the middle now`);
  }
}

// The vanilla texture with its alpha scaled. → PNG buffer
export async function lighter(file, name, keep) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SIZE || info.height !== SIZE) throw new Error(`${name}: ${info.width} × ${info.height}, expected ${SIZE} × ${SIZE}`);
  check(name, data);
  const out = Buffer.from(data);
  for (let i = 3; i < out.length; i += 4) out[i] = Math.round(out[i] * keep);
  return sharp(out, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
}

export default async function ({ vanilla }) {
  const root = path.join(vanilla.assets, 'minecraft');
  const files = {};
  for (const [name, { keep, mcmeta }] of Object.entries(OVERLAYS)) {
    const file = `textures/${name}.png`;
    if (!fs.existsSync(path.join(root, file))) throw new Error(`vanilla has no ${file}`);
    const metaFile = path.join(root, `${file}.mcmeta`);
    const own = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf-8')) : null;
    if (JSON.stringify(own) !== JSON.stringify(mcmeta)) throw new Error(`${file}.mcmeta is ${JSON.stringify(own)} in this version, expected ${JSON.stringify(mcmeta)}`);
    files[`assets/minecraft/${file}`] = await lighter(path.join(root, file), name, keep);
    if (mcmeta) files[`assets/minecraft/${file}.mcmeta`] = Buffer.from(JSON.stringify(mcmeta, null, 2) + '\n');
  }
  return files;
}
