// Arrow Blocks: hoppers, droppers, dispensers and observers get an arrow on their texture that
// points where the block puts things out (items for hopper, dropper and dispenser, the redstone
// signal for the observer), so a builder sees the direction without opening F3.
//
// How the faces are oriented (vanilla block models and blockstates, the same files from 1.21.1 to
// 26.3; FaceBakery/FaceInfo in the client): on a full-cube face without "uv" the texture's top
// edge is +Y on the four sides (left = the viewer's left), north on the up face and SOUTH on the
// down face (the down face is flipped). The blockstates only rotate whole models (x/y, no uvlock),
// so an arrow painted in model space keeps pointing the same way relative to the block in every
// facing. Every model below is drawn for its unrotated state:
//   dropper / dispenser (facing=north): front north, back south. The vanilla model puts
//     furnace_side on east, west and south and furnace_top on up and down. Those textures are the
//     furnace's own, so the arrows go into new textures (namespace arrow_blocks) that the model
//     names per face: up = arrow up (north), down = arrow down (north, the face is flipped),
//     east = arrow right (north is on the right), west = arrow left. The back keeps furnace_side.
//   dropper_vertical / dispenser_vertical (facing=up, x 180 for down): front up, the four sides
//     get an arrow pointing up, the bottom (back) stays furnace_top.
//   hopper_side (facing=north, spout north): the floor of the bowl (the up face of the 16 × 1 × 16
//     plate at y 10–11, visible as 12 × 12 from above) gets an arrow pointing north. That face uses
//     #inside, which the hopper also uses below the plate and on the spout, so the model gives
//     only this face its own texture variable #floor.
//   hopper (facing=down): the same floor gets a small ring right above the spout instead of an arrow.
//   observer (facing=north: watches north, puts out the signal south): the vanilla top and bottom
//     already carry an arrow towards the back (the up face has uv 0,16,16,0). The sides share one
//     texture (#side), so a left/right arrow would point the wrong way on one of them; the model
//     names each side's texture: east = arrow left (south is on the left), west = arrow right.
// Each model is the version's own vanilla file with exactly these texture changes; blockstates
// and item definitions stay vanilla (the dropper, dispenser and observer items show the arrows too,
// they use the block model).
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const NS = 'arrow_blocks';

// Arrows pointing up; '#' = arrow. They are turned for the other directions.
export const SHAPES = {
  // Tops, bottoms, the sides of the vertical dropper/dispenser and the hopper floor.
  big: [
    '...##...',
    '..####..',
    '.######.',
    '########',
    '..####..',
    '..####..',
    '..####..'
  ],
  // Sides of dropper, dispenser and observer: it has to fit above the smooth band of furnace_side
  // (rows 9–13) and inside the dark band of observer_side (rows 4–11).
  small: [
    '..##..',
    '.####.',
    '######',
    '..##..',
    '..##..',
    '..##..'
  ],
  // The hopper that drops straight down: a ring right above its spout (x 6–9).
  ring: [
    '.##.',
    '#..#',
    '#..#',
    '.##.'
  ]
};

// Colours (RGBA) per look. The one place to change for later colour choices.
//   fill    the arrow
//   edge    its top and left edge inside the arrow (light from the top left, like vanilla)
//   rim     the pixels around it (optional)
//   shadow  the pixels below and right of it (optional, wins over rim)
export const LOOKS = {
  // Dark arrow with a light rim on the cobblestone of dropper and dispenser.
  stone: { fill: [52, 52, 52, 255], edge: [36, 36, 36, 255], rim: [176, 176, 176, 255], shadow: [150, 150, 150, 255] },
  // Iron-grey arrow on the dark floor of the hopper.
  iron: { fill: [120, 120, 120, 255], edge: [160, 160, 160, 255], shadow: [24, 24, 24, 255] },
  // The observer's own arrow colours (vanilla observer_top).
  observer: { fill: [143, 143, 143, 255], edge: [175, 175, 175, 255], shadow: [36, 36, 36, 255] }
};

// Every texture of the pack: vanilla base + one mark.
//   dir    where the arrow points on the texture (up, down, left, right)
//   at     top-left corner of the mark (its own pixels, without rim or shadow)
//   area   [x0, y0, x1, y1] every pixel drawn (rim and shadow too) must stay inside
const FURNACE_COBBLE = [1, 1, 14, 8];  // furnace_side above its smooth band
const FULL = [1, 1, 14, 14];           // inside the one-pixel frame of a cobblestone face
const FLOOR = [2, 2, 13, 13];          // the part of the hopper floor that is not under the rim
const OBSERVER_BAND = [1, 4, 14, 11];  // the dark middle band of observer_side
const furnaceTextures = block => ({
  [`${block}_top_up`]: { base: 'furnace_top', shape: 'big', dir: 'up', at: [4, 4], look: 'stone', area: FULL },
  [`${block}_top_down`]: { base: 'furnace_top', shape: 'big', dir: 'down', at: [4, 4], look: 'stone', area: FULL },
  [`${block}_side_left`]: { base: 'furnace_side', shape: 'small', dir: 'left', at: [5, 2], look: 'stone', area: FURNACE_COBBLE },
  [`${block}_side_right`]: { base: 'furnace_side', shape: 'small', dir: 'right', at: [5, 2], look: 'stone', area: FURNACE_COBBLE }
});
export const TEXTURES = {
  ...furnaceTextures('dropper'),
  ...furnaceTextures('dispenser'),
  hopper_floor_side: { base: 'hopper_inside', shape: 'big', dir: 'up', at: [4, 4], look: 'iron', area: FLOOR },
  hopper_floor_down: { base: 'hopper_inside', shape: 'ring', dir: 'up', at: [6, 6], look: 'iron', area: FLOOR },
  observer_side_left: { base: 'observer_side', shape: 'small', dir: 'left', at: [5, 5], look: 'observer', area: OBSERVER_BAND },
  observer_side_right: { base: 'observer_side', shape: 'small', dir: 'right', at: [5, 5], look: 'observer', area: OBSERVER_BAND }
};

// The shape turned to point in `dir`. → rows of '#'/'.'
export function turn(rows, dir) {
  const h = rows.length, w = rows[0].length;
  const at = (x, y) => rows[y][x];
  const make = (W, H, f) => Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => f(x, y)).join(''));
  if (dir === 'up') return rows.slice();
  if (dir === 'down') return make(w, h, (x, y) => at(x, h - 1 - y));
  if (dir === 'left') return make(h, w, (x, y) => at(y, x));                  // tip on the left
  if (dir === 'right') return make(h, w, (x, y) => at(y, h - 1 - x));         // tip on the right
  throw new Error(`unknown direction ${dir}`);
}

// The pixels of one mark: [{ x, y, rgba }].
export function markPixels({ shape, dir, at, look }) {
  const rows = turn(SHAPES[shape], dir);
  const colours = LOOKS[look];
  const inside = new Set();
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') inside.add(`${x + at[0]},${y + at[1]}`); }));
  const has = (x, y) => inside.has(`${x},${y}`);
  const out = new Map();
  for (const key of inside) {
    const [x, y] = key.split(',').map(Number);
    out.set(key, { x, y, rgba: !has(x, y - 1) || !has(x - 1, y) ? colours.edge : colours.fill });
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const [nx, ny] = [x + dx, y + dy];
      if (has(nx, ny)) continue;
      const below = dx > 0 || dy > 0;
      const rgba = below && colours.shadow ? colours.shadow : colours.rim;
      const old = out.get(`${nx},${ny}`);
      if (rgba && (!old || (rgba === colours.shadow && old.rgba !== colours.shadow))) out.set(`${nx},${ny}`, { x: nx, y: ny, rgba });
    }
  }
  return [...out.values()];
}

// One texture: the vanilla base with its mark on it. → PNG buffer
export async function markedTexture(file, spec) {
  const base = sharp(file).ensureAlpha();
  const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 16 || info.height !== 16) throw new Error(`${file}: ${info.width} × ${info.height}, expected 16 × 16`);
  const [x0, y0, x1, y1] = spec.area;
  const overlay = Buffer.alloc(16 * 16 * 4);
  for (const { x, y, rgba } of markPixels(spec)) {
    if (x < x0 || x > x1 || y < y0 || y > y1) throw new Error(`${file}: the ${spec.dir} ${spec.shape} mark reaches pixel ${x},${y}, outside ${spec.area.join(',')}`);
    if (data[(y * 16 + x) * 4 + 3] !== 255) throw new Error(`${file}: pixel ${x},${y} is not opaque`);
    overlay.set(rgba, (y * 16 + x) * 4);
  }
  return base.composite([{ input: overlay, raw: { width: 16, height: 16, channels: 4 } }]).png().toBuffer();
}

const id = name => `${NS}:block/${name}`;
const read = (vanilla, rel) => {
  const file = path.join(vanilla.assets, 'minecraft', rel);
  if (!fs.existsSync(file)) throw new Error(`vanilla has no ${rel}`);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (what, why) => { throw new Error(`${what}: ${why}; the arrows would point the wrong way, check the faces again`); };

// The blockstates must only turn the models the way the comment at the top assumes.
const ROTATIONS = {
  horizontal: { north: {}, east: { y: 90 }, south: { y: 180 }, west: { y: 270 } },
  vertical: { up: {}, down: { x: 180 } },
  observer: { north: {}, east: { y: 90 }, south: { y: 180 }, west: { y: 270 }, down: { x: 90 }, up: { x: 270 } }
};
function checkBlockstate(vanilla, block, models) {
  const variants = read(vanilla, `blockstates/${block}.json`).variants;
  if (!variants) fail(block, 'the blockstate has no variants');
  for (const [key, v] of Object.entries(variants)) {
    const facing = /facing=(\w+)/.exec(key)[1];
    const want = models(facing, key);
    if (!want || v.uvlock || strip(v.model) !== want.model || (v.x || 0) !== (want.x || 0) || (v.y || 0) !== (want.y || 0)) fail(`blockstates/${block}.json ${key}`, `unexpected ${JSON.stringify(v)}`);
  }
}
const strip = s => String(s).replace(/^minecraft:/, '');

// Dropper and dispenser: the vanilla models plus the textures of the arrow faces.
function furnaceModels(vanilla, block) {
  checkBlockstate(vanilla, block, facing => ROTATIONS.horizontal[facing] ? { model: `block/${block}`, ...ROTATIONS.horizontal[facing] }
    : ROTATIONS.vertical[facing] && { model: `block/${block}_vertical`, ...ROTATIONS.vertical[facing] });
  const flat = read(vanilla, `models/block/${block}.json`);
  const upright = read(vanilla, `models/block/${block}_vertical.json`);
  const cube = read(vanilla, 'models/block/cube.json').elements;
  if (cube.length !== 1 || !same(cube[0].from, [0, 0, 0]) || !same(cube[0].to, [16, 16, 16]) || Object.entries(cube[0].faces).some(([f, v]) => v.texture !== `#${f}` || v.uv || v.rotation)) fail('models/block/cube.json', 'not the plain cube');
  const orientable = read(vanilla, 'models/block/orientable_with_bottom.json');
  if (strip(read(vanilla, 'models/block/orientable.json').parent) !== 'block/orientable_with_bottom' || strip(orientable.parent) !== 'block/cube' ||
    !same({ ...orientable.textures, particle: undefined }, { down: '#bottom', up: '#top', north: '#front', east: '#side', south: '#side', west: '#side' })) fail('models/block/orientable_with_bottom.json', 'unexpected faces');
  const vertical = read(vanilla, 'models/block/orientable_vertical.json');
  if (strip(vertical.parent) !== 'block/cube' || vertical.textures.up !== '#front' || vertical.textures.down !== '#side') fail('models/block/orientable_vertical.json', 'unexpected faces');
  if (strip(flat.parent) !== 'block/orientable' || strip(flat.textures.side) !== 'block/furnace_side' || strip(flat.textures.top) !== 'block/furnace_top') fail(`models/block/${block}.json`, 'unexpected parent or textures');
  if (strip(upright.parent) !== 'block/orientable_vertical' || strip(upright.textures.side) !== 'block/furnace_top') fail(`models/block/${block}_vertical.json`, 'unexpected parent or textures');
  for (const f of ['up', 'down', 'north', 'south', 'east', 'west']) if (flat.textures[f] || upright.textures[f]) fail(block, `the vanilla model already sets "${f}"`);
  return {
    [`assets/minecraft/models/block/${block}.json`]: { ...flat, textures: { ...flat.textures,
      up: id(`${block}_top_up`), down: id(`${block}_top_down`), east: id(`${block}_side_right`), west: id(`${block}_side_left`) } },
    [`assets/minecraft/models/block/${block}_vertical.json`]: { ...upright, textures: { ...upright.textures,
      north: id(`${block}_top_up`), south: id(`${block}_top_up`), east: id(`${block}_top_up`), west: id(`${block}_top_up`) } }
  };
}

// Hopper: the plate's up face (the floor of the bowl) gets its own texture.
function hopperModels(vanilla) {
  checkBlockstate(vanilla, 'hopper', facing => facing === 'down' ? { model: 'block/hopper' } : ROTATIONS.horizontal[facing] && { model: 'block/hopper_side', ...ROTATIONS.horizontal[facing] });
  const out = {};
  for (const [name, floor, spout] of [['hopper', 'hopper_floor_down', { from: [6, 0, 6], to: [10, 4, 10] }], ['hopper_side', 'hopper_floor_side', { from: [6, 4, 0], to: [10, 8, 4] }]]) {
    const model = read(vanilla, `models/block/${name}.json`);
    const plates = model.elements.filter(e => same(e.from, [0, 10, 0]) && same(e.to, [16, 11, 16]));
    if (plates.length !== 1 || !same(plates[0].faces.up, { texture: '#inside', cullface: 'up' })) fail(`models/block/${name}.json`, 'the floor plate is not where it used to be');
    if (!model.elements.some(e => same(e.from, spout.from) && same(e.to, spout.to))) fail(`models/block/${name}.json`, `no spout at ${spout.from}–${spout.to}`);
    if (model.textures.floor) fail(`models/block/${name}.json`, 'already has a #floor');
    out[`assets/minecraft/models/block/${name}.json`] = {
      ...model,
      textures: { ...model.textures, floor: id(floor) },
      elements: model.elements.map(e => e === plates[0] ? { ...e, faces: { ...e.faces, up: { ...e.faces.up, texture: '#floor' } } } : e)
    };
  }
  return out;
}

// Observer: east and west get their own texture.
function observerModels(vanilla) {
  checkBlockstate(vanilla, 'observer', (facing, key) => ROTATIONS.observer[facing] && { model: key.includes('powered=true') ? 'block/observer_on' : 'block/observer', ...ROTATIONS.observer[facing] });
  const model = read(vanilla, 'models/block/observer.json');
  const on = read(vanilla, 'models/block/observer_on.json');
  if (strip(on.parent) !== 'block/observer' || on.elements || !same(Object.keys(on.textures), ['bottom'])) fail('models/block/observer_on.json', 'no longer just observer with another back');
  const faces = model.elements?.length === 1 && model.elements[0].faces;
  if (!faces || faces.north.texture !== '#front' || faces.south.texture !== '#bottom' || !same(faces.up.uv, [0, 16, 16, 0]) || faces.up.texture !== '#top' ||
    faces.down.texture !== '#top' || !same(faces.down.uv, [0, 0, 16, 16]) ||
    ['east', 'west'].some(f => faces[f].texture !== '#side' || !same(faces[f].uv, [0, 0, 16, 16]) || faces[f].rotation)) fail('models/block/observer.json', 'unexpected faces');
  if (model.textures.east || model.textures.west) fail('models/block/observer.json', 'already has #east or #west');
  return {
    'assets/minecraft/models/block/observer.json': {
      ...model,
      textures: { ...model.textures, east: id('observer_side_left'), west: id('observer_side_right') },
      elements: [{ ...model.elements[0], faces: { ...faces, east: { ...faces.east, texture: '#east' }, west: { ...faces.west, texture: '#west' } } }]
    }
  };
}

export default async function ({ vanilla }) {
  const files = { ...furnaceModels(vanilla, 'dropper'), ...furnaceModels(vanilla, 'dispenser'), ...hopperModels(vanilla), ...observerModels(vanilla) };
  for (const [name, spec] of Object.entries(TEXTURES)) {
    const file = path.join(vanilla.assets, 'minecraft', 'textures', 'block', `${spec.base}.png`);
    if (!fs.existsSync(file)) throw new Error(`vanilla has no textures/block/${spec.base}.png`);
    if (fs.existsSync(`${file}.mcmeta`)) throw new Error(`textures/block/${spec.base}.png is animated in this version`);
    files[`assets/${NS}/textures/block/${name}.png`] = await markedTexture(file, spec);
  }
  // Every texture a model names exists: vanilla or generated here.
  for (const [p, model] of Object.entries(files)) {
    if (!p.endsWith('.json')) continue;
    for (const t of Object.values(model.textures)) {
      if (t.startsWith('#')) continue;
      const [ns, rel] = t.includes(':') ? t.split(':') : ['minecraft', t];
      const exists = ns === NS ? files[`assets/${NS}/textures/${rel}.png`] : fs.existsSync(path.join(vanilla.assets, ns, 'textures', `${rel}.png`));
      if (!exists) throw new Error(`${p}: texture ${t} does not exist`);
    }
  }
  return files;
}
