// Ripe Crop Marker: the last growth stage of wheat, carrots, potatoes, beetroots and nether wart gets
// a small sparkle near the top of the plant, so a field shows at a glance which plants are ready to
// harvest. Every earlier stage, the items and everything else stay vanilla.
//
// What the game draws for the last stage (vanilla blockstates and models, the same in every release
// from 1.21.1 to 26.3, checked below for the version being built):
//   wheat        age=7 → block/wheat_stage7      (ages 0–6 use stage0–stage6)
//   carrots      age=7 → block/carrots_stage3    (ages 4–6 share stage2, so only age 7 is marked)
//   potatoes     age=7 → block/potatoes_stage3   (same layout as carrots)
//   beetroots    age=3 → block/beetroots_stage3
//   nether_wart  age=3 → block/nether_wart_stage2 (ages 1–2 share stage1)
// Each of those models has the parent block/crop and the texture of the same name as its only
// texture, no other block or item model uses that texture, and no other blockstate or item
// definition draws that model (all checked below). So changing the five textures marks exactly the
// ripe plants. The textures are 16 × 16 cutout pictures (every pixel fully opaque or
// fully clear) without animation; the pixels are identical in 1.21.1 and 26.3 (only the PNG
// encoding differs), so both versions produce the same files.
//
// The marker: a five-pixel sparkle (a plus) with a warm white centre and four pale gold arms. It is
// the same on every crop, so once seen it reads as "ready" on any field, and it is lighter than any
// pixel of the five vanilla textures (checked), so it stands out against leaves, ears and soil. It
// sits in clear air right at the top of the plant and touches it, so it never paints over a leaf
// and never floats. The block/crop model shows the texture on four crossed planes, so a ripe plant
// twinkles from every side. Only the last texture changes, so no earlier stage ever shows it.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const SIZE = 16;
// The colours of every sparkle (RGBA), the one place to change for a later "subtle" variant.
export const CENTRE = [255, 253, 235, 255];
export const ARM = [255, 228, 120, 255];
// The plus: centre plus four arms, as offsets from the centre.
export const ARMS = [[0, -1], [-1, 0], [1, 0], [0, 1]];

// One row per crop. age: the last age; model: what the blockstate draws for it; at: the centre of the
// sparkle on the texture (x right, y down from the top-left), picked by hand at the top of the plant.
export const CROPS = {
  wheat: { age: 7, model: 'block/wheat_stage7', at: [13, 2] },
  carrots: { age: 7, model: 'block/carrots_stage3', at: [8, 2] },
  potatoes: { age: 7, model: 'block/potatoes_stage3', at: [13, 1] },
  beetroots: { age: 3, model: 'block/beetroots_stage3', at: [8, 5] },
  nether_wart: { age: 3, model: 'block/nether_wart_stage2', at: [13, 2] }
};

// Perceived lightness (Rec. 601), and how much lighter than the plant the sparkle has to be.
const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const LIFT = 20;
const strip = id => String(id).replace(/^minecraft:/, '');

// The sparkle of one crop: [{ x, y, rgba }].
export function sparkle({ at: [cx, cy] }) {
  return [{ x: cx, y: cy, rgba: CENTRE }, ...ARMS.map(([dx, dy]) => ({ x: cx + dx, y: cy + dy, rgba: ARM }))];
}

// Makes sure the last age of the block, and only that age, uses the crop's model, and that the model
// is a plain block/crop with one texture of its own. → the texture id (e.g. "block/wheat_stage7")
export function checkWiring(name, crop, blockstate, model) {
  const variants = blockstate?.variants;
  if (!variants) throw new Error(`blockstates/${name}.json has no variants`);
  const ages = Object.keys(variants).map(k => {
    const m = /^age=(\d+)$/.exec(k);
    if (!m) throw new Error(`blockstates/${name}.json: variant "${k}" is not an age`);
    return Number(m[1]);
  });
  if (Math.max(...ages) !== crop.age) throw new Error(`${name}: the last age is ${Math.max(...ages)}, expected ${crop.age}`);
  for (const [key, v] of Object.entries(variants)) {
    if (Array.isArray(v) || typeof v?.model !== 'string') throw new Error(`blockstates/${name}.json: "${key}" is not a single model`);
    const ripe = key === `age=${crop.age}`;
    if (ripe !== (strip(v.model) === crop.model)) throw new Error(`blockstates/${name}.json: "${key}" uses ${v.model}, but only age=${crop.age} may use ${crop.model}`);
  }
  if (strip(model?.parent) !== 'block/crop') throw new Error(`models/${crop.model}.json: parent is ${model?.parent}, expected block/crop`);
  const textures = Object.entries(model.textures || {});
  if (textures.length !== 1 || textures[0][0] !== 'crop') throw new Error(`models/${crop.model}.json: expected the one texture "crop"`);
  if (model.elements) throw new Error(`models/${crop.model}.json has its own elements`);
  return strip(textures[0][1]);
}

// The vanilla texture with the sparkle on it. → PNG buffer
export async function marked(file, crop, name = file) {
  const base = sharp(file).ensureAlpha();
  const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SIZE || info.height !== SIZE) throw new Error(`${name}: ${info.width} × ${info.height}, expected ${SIZE} × ${SIZE}`);
  let brightest = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 0 && data[i + 3] !== 255) throw new Error(`${name}: pixel ${(i / 4) % SIZE},${Math.floor(i / 4 / SIZE)} is half see-through, the texture is no longer cutout`);
    if (data[i + 3] === 255) brightest = Math.max(brightest, luma(data.subarray(i, i + 3)));
  }
  // The sparkle has to be the lightest spot of the plant, or it would not stand out.
  if (luma(ARM) <= brightest + LIFT) throw new Error(`${name}: the sparkle (${Math.round(luma(ARM))}) is not clearly lighter than the plant (${Math.round(brightest)})`);
  const overlay = Buffer.alloc(data.length);
  let near = false;
  for (const { x, y, rgba } of sparkle(crop)) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) throw new Error(`${name}: sparkle pixel ${x},${y} lies outside the texture`);
    const at = (y * SIZE + x) * 4;
    if (data[at + 3] !== 0) throw new Error(`${name}: sparkle pixel ${x},${y} would paint over the plant`);
    overlay.set(rgba, at);
    // The sparkle has to sit on the plant, not float in the air: a plant pixel next to it (8 neighbours).
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && data[(ny * SIZE + nx) * 4 + 3] === 255) near = true;
    }
  }
  if (!near) throw new Error(`${name}: the sparkle at ${crop.at} does not touch the plant`);
  return base.composite([{ input: overlay, raw: { width: SIZE, height: SIZE, channels: 4 } }]).png().toBuffer();
}

// Who uses what in this version: texture → models that name it, model → blockstates and item
// definitions (items/, 1.21.4 on) that draw it. Read once per build.
function usage(root) {
  const textures = new Map();
  const models = new Map();
  const add = (map, key, user) => map.set(key, [...(map.get(key) || []), user]);
  const each = (dir, fn) => {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) return;
    for (const f of fs.readdirSync(full)) if (f.endsWith('.json')) fn(JSON.parse(fs.readFileSync(path.join(full, f), 'utf-8')), `${dir}/${f.replace(/\.json$/, '')}`);
  };
  const walk = (value, fn) => {
    if (Array.isArray(value)) value.forEach(v => walk(v, fn));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) k === 'model' && typeof v === 'string' ? fn(strip(v)) : walk(v, fn);
  };
  for (const dir of ['models/block', 'models/item']) each(dir, (json, id) => {
    for (const t of new Set(Object.values(json.textures || {}).map(strip))) add(textures, t, id.replace(/^models\//, ''));
  });
  for (const dir of ['blockstates', 'items']) each(dir, (json, id) => {
    const seen = new Set();
    walk(json, m => { if (!seen.has(m)) { seen.add(m); add(models, m, id); } });
  });
  return { textures, models };
}

export default async function ({ vanilla }) {
  const root = path.join(vanilla.assets, 'minecraft');
  const read = file => {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) throw new Error(`vanilla has no ${file}`);
    return JSON.parse(fs.readFileSync(full, 'utf-8'));
  };
  const used = usage(root);
  const files = {};
  for (const [name, crop] of Object.entries(CROPS)) {
    const texture = checkWiring(name, crop, read(`blockstates/${name}.json`), read(`models/${crop.model}.json`));
    // The texture belongs to the ripe model alone, and only the crop's own blockstate draws that model.
    const models = used.textures.get(texture) || [];
    if (models.length !== 1 || models[0] !== crop.model) throw new Error(`${texture} is used by ${models.join(', ')}, expected only ${crop.model}`);
    const drawers = used.models.get(crop.model) || [];
    if (drawers.length !== 1 || drawers[0] !== `blockstates/${name}`) throw new Error(`${crop.model} is drawn by ${drawers.join(', ')}, expected only blockstates/${name}`);
    const file = `textures/${texture}.png`;
    if (!fs.existsSync(path.join(root, file))) throw new Error(`vanilla has no ${file}`);
    if (fs.existsSync(path.join(root, `${file}.mcmeta`))) throw new Error(`${file}.mcmeta exists in this version: the texture is animated or scaled now`);
    files[`assets/minecraft/${file}`] = await marked(path.join(root, file), crop, file);
  }
  return files;
}
