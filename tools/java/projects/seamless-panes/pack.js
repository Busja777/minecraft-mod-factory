// Seamless Panes: plain glass without its frame lines, so a wall or window of glass reads as one clear
// surface instead of a grid of framed squares. The pack replaces one texture, block/glass, with the
// version's own vanilla texture minus its one-pixel frame; the two small diagonal shine streaks stay,
// so the glass is still visible as glass.
//
// Vanilla Java has no connected textures, so this is the honest way: the frame goes on every face,
// a lone glass block loses it as well, and the streaks repeat on every block.
//
// The vanilla texture (16 × 16, cutout: every pixel fully opaque or fully clear, byte-identical in
// every release from 1.21.1 to 26.3, checked below for the version being built):
//   the outermost ring of pixels is opaque          → the frame, cleared by this pack
//   the ring just inside it is clear                → the frame is exactly one pixel wide
//   five opaque pixels inside, in two diagonal      → the shine, kept as it is
//   streaks (top left and bottom right)
//   every other inside pixel is clear, all in one colour (the cleared frame takes that colour)
//
// Who draws block/glass (vanilla models, checked below; parents are followed):
//   block/glass                       the glass block, and its item (1.21.1: item/glass has it as parent;
//                                     from 1.21.4: items/glass draws block/glass)
//   block/glass_pane_* (5 models)     the big faces of the glass pane ("pane"); the thin edge uses
//                                     block/glass_pane_top, which this pack leaves alone
//   item/glass_pane                   the glass pane item (item/generated, layer0)
//   block/beacon                      the glass shell of the beacon (block and item)
// Stained and tinted glass have their own textures and stay vanilla.
//
// From 1.21.11 on vanilla ships textures/block/glass.png.mcmeta ({"texture":{"mipmap_strategy":"mean"}}).
// The game reads a texture's .mcmeta only from the pack that provides the texture or a pack above it,
// never from vanilla below (FallbackResourceManager, checked in the 26.3 client jar), so the pack has
// to carry that file itself or distant glass would mipmap differently. Releases before 1.21.11 read the
// same "texture" section with only "blur" and "clamp" (both default false, checked in the 1.21.1 jar)
// and skip the unknown field, so one file serves every version.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const SIZE = 16;
export const TEXTURE = 'block/glass';
// The .mcmeta of every version that has one; the same file goes to every version.
export const MCMETA = { texture: { mipmap_strategy: 'mean' } };
// The models that may name block/glass, directly or through a parent, and the blockstates and item
// definitions that may draw them. Anything new fails the build, so the page stays true.
export const USERS = [
  'block/glass', 'block/beacon',
  'block/glass_pane_noside', 'block/glass_pane_noside_alt', 'block/glass_pane_post', 'block/glass_pane_side', 'block/glass_pane_side_alt',
  'item/glass', 'item/glass_pane', 'item/beacon'
];
export const DRAWERS = ['blockstates/glass', 'blockstates/glass_pane', 'blockstates/beacon', 'items/glass', 'items/glass_pane', 'items/beacon'];
// How many shine pixels the vanilla texture may have (it has 5).
export const SHINE = { min: 3, max: 8 };

const strip = id => String(id).replace(/^minecraft:/, '');
// A texture value is "block/glass" or, from 26.1 on, { sprite, force_translucent }.
const spriteOf = value => strip(typeof value === 'object' && value ? value.sprite : value);
const onRing = (x, y, n = 0) => x === n || y === n || x === SIZE - 1 - n || y === SIZE - 1 - n;

// Sorts the pixels of the vanilla texture into frame, shine and clear, and checks every assumption
// above. data: raw RGBA. → { shine: [[x, y]], clear: [r, g, b] }
export function analyse(data, name = TEXTURE) {
  const at = (x, y) => (y * SIZE + x) * 4;
  const shine = [];
  const clearColours = new Set();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = at(x, y);
    const a = data[i + 3];
    if (a !== 0 && a !== 255) throw new Error(`${name}: pixel ${x},${y} is half see-through, the texture is no longer cutout`);
    if (onRing(x, y)) {
      if (a !== 255) throw new Error(`${name}: pixel ${x},${y} of the outer ring is clear, the frame is not where it used to be`);
    } else if (onRing(x, y, 1)) {
      if (a !== 0) throw new Error(`${name}: pixel ${x},${y} just inside the frame is opaque, the frame is wider than one pixel now`);
      clearColours.add(data.subarray(i, i + 3).join(','));
    } else if (a === 255) shine.push([x, y]);
    else clearColours.add(data.subarray(i, i + 3).join(','));
  }
  if (shine.length < SHINE.min || shine.length > SHINE.max) throw new Error(`${name}: ${shine.length} opaque pixels inside the frame, expected ${SHINE.min}–${SHINE.max} shine pixels`);
  // The shine is thin diagonal streaks: every pixel touches another one corner to corner, none side by side.
  const has = (x, y) => shine.some(([sx, sy]) => sx === x && sy === y);
  for (const [x, y] of shine) {
    if (has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1)) throw new Error(`${name}: shine pixel ${x},${y} has a side neighbour, the inside is no longer two thin streaks`);
    if (![[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([dx, dy]) => has(x + dx, y + dy))) throw new Error(`${name}: shine pixel ${x},${y} stands alone, the inside is no longer two streaks`);
  }
  if (clearColours.size !== 1) throw new Error(`${name}: the clear pixels have ${clearColours.size} colours, expected one`);
  return { shine, clear: [...clearColours][0].split(',').map(Number) };
}

// The vanilla texture without its frame. → PNG buffer
export async function frameless(file, name = TEXTURE) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SIZE || info.height !== SIZE) throw new Error(`${name}: ${info.width} × ${info.height}, expected ${SIZE} × ${SIZE}`);
  const { clear } = analyse(data, name);
  const out = Buffer.from(data);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (onRing(x, y)) out.set([...clear, 0], (y * SIZE + x) * 4);
  return sharp(out, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
}

// Which models name the texture (directly or through a parent), and what draws those models.
export function users(root, texture = TEXTURE) {
  const models = {};
  for (const dir of ['block', 'item']) {
    const full = path.join(root, 'models', dir);
    for (const f of fs.readdirSync(full)) if (f.endsWith('.json')) models[`${dir}/${f.replace(/\.json$/, '')}`] = JSON.parse(fs.readFileSync(path.join(full, f), 'utf-8'));
  }
  const names = id => {
    const m = models[id];
    return m ? Object.values(m.textures || {}).some(v => spriteOf(v) === texture) || (m.parent && names(strip(m.parent))) : false;
  };
  const using = new Set(Object.keys(models).filter(names));
  const drawers = new Set();
  const walk = (value, fn) => {
    if (Array.isArray(value)) value.forEach(v => walk(v, fn));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) k === 'model' && typeof v === 'string' ? fn(strip(v)) : walk(v, fn);
  };
  for (const dir of ['blockstates', 'items']) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) if (f.endsWith('.json')) walk(JSON.parse(fs.readFileSync(path.join(full, f), 'utf-8')), m => { if (using.has(m)) drawers.add(`${dir}/${f.replace(/\.json$/, '')}`); });
  }
  return { models: [...using].sort(), drawers: [...drawers].sort() };
}

export default async function ({ vanilla }) {
  const root = path.join(vanilla.assets, 'minecraft');
  const { models, drawers } = users(root);
  const odd = [...models.filter(m => !USERS.includes(m)), ...drawers.filter(d => !DRAWERS.includes(d))];
  if (odd.length) throw new Error(`${TEXTURE} is also drawn by ${odd.join(', ')}: check what the pack changes there`);
  for (const must of ['block/glass', 'block/glass_pane_side', 'blockstates/glass', 'blockstates/glass_pane']) {
    if (!models.includes(must) && !drawers.includes(must)) throw new Error(`${must} no longer uses ${TEXTURE}`);
  }
  const file = `textures/${TEXTURE}.png`;
  if (!fs.existsSync(path.join(root, file))) throw new Error(`vanilla has no ${file}`);
  const meta = path.join(root, `${file}.mcmeta`);
  if (fs.existsSync(meta)) {
    const own = JSON.parse(fs.readFileSync(meta, 'utf-8'));
    if (JSON.stringify(own) !== JSON.stringify(MCMETA)) throw new Error(`${file}.mcmeta is ${JSON.stringify(own)} in this version, expected ${JSON.stringify(MCMETA)}`);
  }
  return {
    [`assets/minecraft/${file}`]: await frameless(path.join(root, file), file),
    [`assets/minecraft/${file}.mcmeta`]: Buffer.from(JSON.stringify(MCMETA, null, 2) + '\n')
  };
}
