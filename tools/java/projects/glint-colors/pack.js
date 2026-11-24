// Glint Colors: the enchantment glint becomes a soft rainbow of 8 colours that drift across
// enchanted items, armour, books, tridents and shields. A resource pack can hold only one glint
// picture, so V1.0 is this one look.
//
// How the game draws the glint (checked in the vanilla shaders of 1.21.1 and 26.3 and in the 26.3
// client jar):
// - The glint texture is not tinted: the shaders (rendertype_*glint*.fsh in 1.21.1, glint.fsh,
//   item.fsh and entity.fsh in 26.3) take texture × ColorModulator (white) × GlintAlpha × fog, and
//   the blend (BlendFunction.GLINT, "color.rgb += glint.rgb * glint.rgb" in 26.3's item.fsh) adds
//   the SQUARE of the texture colour to the item. Vanilla's purple comes from the texture alone.
//   So the light a texel adds is t², and this pack writes t = √(wanted light).
// - TextureTransform.setupGlintTexturing: the texture is scaled (items 8, entities 0.5, armour
//   0.16), turned by 10° and shifted by (−f, g): f runs through the width once per 110 s / 8 /
//   glint speed, g through the height once per 30 s / 8 / glint speed (default glint speed 0.5:
//   27.5 s and 7.5 s). The fast movement is along the texture's height (v), so the colour bands
//   change along v: they wander over an item as the glint scrolls, one full rainbow every 7.5 s
//   at the default speed (slower with the Glint Speed slider under Accessibility).
// - The texture is linearly filtered because of its .mcmeta ({"texture": {"blur": true}}, from
//   1.21.2 on; 1.21.1 sets blur in code). The game takes a texture's .mcmeta only from the pack
//   that supplies the texture or a pack above it (FallbackResourceManager.createStackMetadataFinder,
//   26.3), never vanilla's: so every replaced glint gets its .mcmeta, copied from vanilla.
//
// Which file each release reads (vanilla assets of every release from 1.21.1 to 26.3):
//   enchanted_glint_item.png     items: every release (the same picture in all of them)
//   enchanted_glint_entity.png   armour and other entity glints: 1.21.1 to 1.21.4
//   enchanted_glint_armor.png    the same picture under its new name: 1.21.5 on
// Every version gets all three names (the one it does not read is ignored), so a single file set
// serves every release from 1.21.1 to 26.3.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const MISC = 'textures/misc';
// Each glint picture and the names releases read it under. The first name the version's own
// vanilla assets have is the source of the brightness pattern.
export const GLINTS = [
  { glint: 'item', names: ['enchanted_glint_item.png'] },
  { glint: 'armour', names: ['enchanted_glint_entity.png', 'enchanted_glint_armor.png'] }
];
export const MCMETA = { texture: { blur: true } };

// The look; one table for later updates (more colours, a subtle variant).
//   bands     the colours of light the glint adds, in order along the texture's height, sRGB 0–255
//   plateau   share of each band that is its pure colour; the rest blends into the next band
//   strength  brightness against vanilla (1 = the same amount of light as the purple glint)
export const STYLE = {
  bands: [
    { name: 'red', rgb: [255, 60, 60] },
    { name: 'orange', rgb: [255, 140, 30] },
    { name: 'yellow', rgb: [255, 225, 40] },
    { name: 'green', rgb: [60, 235, 80] },
    { name: 'cyan', rgb: [40, 220, 255] },
    { name: 'blue', rgb: [50, 100, 255] },
    { name: 'violet', rgb: [150, 60, 255] },
    { name: 'pink', rgb: [255, 70, 180] }
  ],
  plateau: 0.5,
  strength: 1
};

// How bright a light looks: half luma (Rec. 709), half the plain mean of the channels. Luma alone
// would make yellow and green far dimmer than vanilla's purple, which the eye sees as bright.
export const WEIGHT = [0.2126, 0.7152, 0.0722].map(w => (w + 1 / 3) / 2);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smooth = x => x * x * (3 - 2 * x);

// The colour of light at row y of a texture `height` rows high: the bands repeat once over the
// height and the last blends into the first, so the texture still tiles. → [r, g, b] 0–1
export function bandColour(y, height, style = STYLE) {
  const n = style.bands.length;
  const p = ((y + 0.5) / height) * n;
  const i = Math.floor(p) % n;
  const f = p - Math.floor(p);
  const a = style.bands[i].rgb.map(c => c / 255);
  if (f <= style.plateau) return a;
  const b = style.bands[(i + 1) % n].rgb.map(c => c / 255);
  const s = smooth((f - style.plateau) / (1 - style.plateau));
  return a.map((c, k) => c + (b[k] - c) * s);
}

// Vanilla glint pixels (RGB or RGBA Buffer) recoloured: each texel adds as much light as the
// vanilla one (weighted as above), in the colour of its band. Pure. → RGB Buffer
export function recolour(raw, { width, height, channels }, style = STYLE) {
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    const colour = bandColour(y, height, style);
    const scale = style.strength / dot(WEIGHT, colour);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const light = dot(WEIGHT, [0, 1, 2].map(k => (raw[i + k] / 255) ** 2));
      for (let k = 0; k < 3; k++) out[(y * width + x) * 3 + k] = Math.round(Math.sqrt(Math.min(1, colour[k] * light * scale)) * 255);
    }
  }
  return out;
}

// The .mcmeta every replaced glint gets: the version's own vanilla glint .mcmeta, byte for byte.
// All of them must say the same thing (blur on); a version that changes that fails the build.
export function vanillaMcmeta(dir) {
  const metas = fs.readdirSync(dir).filter(f => /glint.*\.png\.mcmeta$/.test(f)).map(f => fs.readFileSync(path.join(dir, f)));
  if (!metas.length) throw new Error(`vanilla ${MISC} has no glint .mcmeta: check how the game filters the glint now`);
  if (metas.some(m => !m.equals(metas[0]))) throw new Error(`vanilla ${MISC}: the glint .mcmeta files differ`);
  if (JSON.stringify(JSON.parse(metas[0].toString('utf-8'))) !== JSON.stringify(MCMETA)) throw new Error(`vanilla glint .mcmeta is ${metas[0]}, expected ${JSON.stringify(MCMETA)}`);
  return metas[0];
}

export default async function ({ vanilla, style = STYLE }) {
  const dir = path.join(vanilla.assets, 'minecraft', MISC);
  const meta = vanillaMcmeta(dir);
  const files = {};
  for (const { glint, names } of GLINTS) {
    const source = names.find(n => fs.existsSync(path.join(dir, n)));
    if (!source) throw new Error(`vanilla has none of ${names.join(', ')}: the ${glint} glint was renamed`);
    const { data, info } = await sharp(path.join(dir, source)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const png = await sharp(recolour(data, info, style), { raw: { width: info.width, height: info.height, channels: 3 } })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    for (const name of names) {
      files[`assets/minecraft/${MISC}/${name}`] = png;
      files[`assets/minecraft/${MISC}/${name}.mcmeta`] = meta;
    }
  }
  return files;
}
