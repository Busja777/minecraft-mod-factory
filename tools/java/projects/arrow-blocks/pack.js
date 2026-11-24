// Arrow Blocks: small arrows on hoppers, dispensers, droppers and observers that show where the
// block sends things (items or the redstone signal), so redstone builds are easier to read.
//
// Every arrow points the way things leave the block:
//   hopper              → its output (the spout, the blockstate's "facing")
//   dispenser, dropper  → the front, where items come out ("facing")
//   observer            → the back with the red dot, where the signal goes out (the opposite of
//                         "facing"; the observer looks with its face towards "facing")
//
// How it works. A blockstate turns one model per variant with "x"/"y" and none of them uses
// "uvlock", so the textures turn together with the model: an arrow that points to the model's
// output in the model points to the block's output in the world, for every variant. But vanilla
// shares one texture between faces that would need different arrows (the dispenser's east, west
// and back side all use furnace_side; the hopper's whole body uses hopper_outside; both observer
// sides use observer_side), and furnace_side/furnace_top are the furnace's textures too. So the
// pack brings its own models (namespace arrow_blocks) that point single faces at own textures,
// and replaces the four vanilla blockstates with copies that use these models, with the same
// variants and the same x/y. Dispenser and dropper models are children of the vanilla models
// (only texture slots change); hopper and observer models are copies of the vanilla elements in
// which only the "texture" of the chosen faces differs. Each arrow texture is the version's own
// vanilla texture with the arrow drawn on top.
//
// `verify` proves this for every variant with the real model data of the version: it resolves
// both models (ours and vanilla's) through their parents, checks that the geometry is identical,
// that every face shows vanilla's texture or that very texture with an arrow, that the arrow lies
// inside the part of the texture the face shows, and turns the arrow's direction through the face
// mapping and the variant's rotation into the world, where it has to point to the output. It also
// checks the meaning of "facing" against the models (front texture, red dot, spout).
// Faces that look along the output or against it (the dispenser's front and back, the hopper's
// spout) cannot show a flat arrow along the output and stay vanilla. Items in the inventory stay
// vanilla too (the item models are not touched).
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const NS = 'arrow_blocks';

// The arrow, pointing up ("#" = drawn). 6 px wide, so it sits exactly in the middle of a 16 px face.
export const ARROW = ['..##..', '.####.', '######', '..##..', '..##..', '..##..'];
// The look; one table for later updates (colours).
//   fill     RGBA of the arrow
//   outline  RGBA of the 1 px edge around it (left, right, above, below), kept inside the shown part
export const STYLE = { fill: [236, 236, 236, 255], outline: [32, 32, 32, 255] };

// The part of a 16 × 16 texture a face shows: [x0, y0, x1, y1), x right, y down.
const FULL = [0, 0, 16, 16];
// The hopper bowl (element 4,4,4 to 12,10,12) shows columns 4–11, rows 6–11 of hopper_outside.
const BOWL = [4, 6, 12, 12];

// Own textures: vanilla texture `base` with the arrow pointing `dir` (on the texture: up = −v,
// right = +u), centred in `area` (the part of the texture the faces using it show).
export const TEXTURES = {
  furnace_side_arrow_left: { base: 'furnace_side', dir: 'left', area: FULL },
  furnace_side_arrow_right: { base: 'furnace_side', dir: 'right', area: FULL },
  furnace_top_arrow_up: { base: 'furnace_top', dir: 'up', area: FULL },
  furnace_top_arrow_down: { base: 'furnace_top', dir: 'down', area: FULL },
  observer_side_arrow_left: { base: 'observer_side', dir: 'left', area: FULL },
  observer_side_arrow_right: { base: 'observer_side', dir: 'right', area: FULL },
  hopper_inside_arrow_up: { base: 'hopper_inside', dir: 'up', area: FULL },
  hopper_outside_arrow_down: { base: 'hopper_outside', dir: 'down', area: BOWL },
  hopper_outside_arrow_left: { base: 'hopper_outside', dir: 'left', area: BOWL },
  hopper_outside_arrow_right: { base: 'hopper_outside', dir: 'right', area: BOWL }
};

// Own models. `child`: a child of the vanilla model that only sets texture slots (the slot is the
// face name in block/cube). `copy`: the vanilla elements, with the faces in `faces` showing an own
// texture; an element is named by its from/to. `parent`: the vanilla model with the parent swapped
// for our copy (observer_on only changes the back texture of observer).
const BOWL_BOX = '4,4,4 12,10,12';
const FLOOR_BOX = '0,10,0 16,11,16';
const CUBE = '0,0,0 16,16,16';
const HORIZONTAL = { east: 'furnace_side_arrow_right', west: 'furnace_side_arrow_left', up: 'furnace_top_arrow_up', down: 'furnace_top_arrow_down' };
const VERTICAL = { north: 'furnace_top_arrow_up', east: 'furnace_top_arrow_up', south: 'furnace_top_arrow_up', west: 'furnace_top_arrow_up' };
export const MODELS = {
  dispenser: { child: HORIZONTAL },
  dispenser_vertical: { child: VERTICAL },
  dropper: { child: HORIZONTAL },
  dropper_vertical: { child: VERTICAL },
  hopper: { copy: { [BOWL_BOX]: { north: 'hopper_outside_arrow_down', east: 'hopper_outside_arrow_down', south: 'hopper_outside_arrow_down', west: 'hopper_outside_arrow_down' } } },
  hopper_side: { copy: { [BOWL_BOX]: { east: 'hopper_outside_arrow_right', west: 'hopper_outside_arrow_left' }, [FLOOR_BOX]: { up: 'hopper_inside_arrow_up' } } },
  observer: { copy: { [CUBE]: { east: 'observer_side_arrow_left', west: 'observer_side_arrow_right' } } },
  observer_on: { parent: 'observer' }
};

// The blocks and where their output lies for a value of "facing".
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };
export const BLOCKS = {
  hopper: facing => facing,
  dispenser: facing => facing,
  dropper: facing => facing,
  observer: facing => OPPOSITE[facing]
};

// ---------------------------------------------------------------------------------------------
// Directions and the face mapping of Minecraft's block models.
const DIR = { north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
const nameOf = v => Object.keys(DIR).find(k => DIR[k].every((c, i) => c === v[i]));
const neg = v => v.map(c => -c || 0);
// Per face: the world direction of +u and +v for the default uv, and that default uv
// (BlockElement's uvsByFace; FaceInfo puts (u0, v0) on the corner these formulas give).
const FACE = {
  down: { u: DIR.east, v: DIR.north, uv: (f, t) => [f[0], 16 - t[2], t[0], 16 - f[2]] },
  up: { u: DIR.east, v: DIR.south, uv: (f, t) => [f[0], f[2], t[0], t[2]] },
  north: { u: DIR.west, v: DIR.down, uv: (f, t) => [16 - t[0], 16 - t[1], 16 - f[0], 16 - f[1]] },
  south: { u: DIR.east, v: DIR.down, uv: (f, t) => [f[0], 16 - t[1], t[0], 16 - f[1]] },
  west: { u: DIR.south, v: DIR.down, uv: (f, t) => [f[2], 16 - t[1], t[2], 16 - f[1]] },
  east: { u: DIR.north, v: DIR.down, uv: (f, t) => [16 - t[2], 16 - t[1], 16 - f[2], 16 - f[1]] }
};
// A blockstate variant turns the model by x, then by y (BlockModelRotation: rotateYXZ(-y, -x, 0)):
// x 90 turns north to down, y 90 turns north to east.
export function turn(v, x = 0, y = 0) {
  let [a, b, c] = v;
  for (let i = 0; i < ((x / 90) % 4 + 4) % 4; i++) [b, c] = [c, -b];
  for (let i = 0; i < ((y / 90) % 4 + 4) % 4; i++) [a, c] = [-c, a];
  return [a, b, c].map(n => n || 0);
}
// The world direction (in the model) an arrow drawn pointing `dir` on the texture shows on `face`
// of an element. Explicit uv may flip u or v; a face "rotation" is not used by any face we change.
export function faceArrow(face, element, dir) {
  const spec = element.faces[face];
  if (spec.rotation) throw new Error(`face ${face} has a texture rotation, not supported`);
  const [u0, v0, u1, v1] = spec.uv || FACE[face].uv(element.from, element.to);
  const u = u1 < u0 ? neg(FACE[face].u) : FACE[face].u;
  const v = v1 < v0 ? neg(FACE[face].v) : FACE[face].v;
  return { up: neg(v), down: v, left: neg(u), right: u }[dir];
}
const shownPart = (face, element) => {
  const [u0, v0, u1, v1] = element.faces[face].uv || FACE[face].uv(element.from, element.to);
  return [Math.min(u0, u1), Math.min(v0, v1), Math.max(u0, u1), Math.max(v0, v1)];
};

// ---------------------------------------------------------------------------------------------
// The arrow's pixels.
// The arrow's pixels pointing `dir`, as a set of "x,y" in a 6 × 6 box.
function arrowCells(dir) {
  const cells = [];
  ARROW.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') cells.push([x, y]); }));
  const n = ARROW.length - 1;
  const map = { up: ([x, y]) => [x, y], down: ([x, y]) => [x, n - y], left: ([x, y]) => [y, x], right: ([x, y]) => [n - y, x] }[dir];
  return new Set(cells.map(c => map(c).join(',')));
}
// Where the arrow goes on a texture: { fill: [[x, y]], outline: [[x, y]], core: [x0, y0, x1, y1) }.
export function arrowPixels({ dir, area }) {
  const size = ARROW.length;
  if (ARROW.some(r => r.length !== size)) throw new Error('the arrow must be square');
  const [ax0, ay0, ax1, ay1] = area;
  if (ax1 - ax0 < size || ay1 - ay0 < size) throw new Error(`the arrow does not fit into ${area}`);
  const x0 = ax0 + Math.floor((ax1 - ax0 - size) / 2);
  const y0 = ay0 + Math.floor((ay1 - ay0 - size) / 2);
  const on = arrowCells(dir);
  const fill = [...on].map(k => k.split(',').map(Number)).map(([x, y]) => [x0 + x, y0 + y]);
  const taken = new Set(fill.map(p => p.join(',')));
  const outline = [];
  for (const [x, y] of fill) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p = [x + dx, y + dy];
      const k = p.join(',');
      if (taken.has(k) || p[0] < ax0 || p[0] >= ax1 || p[1] < ay0 || p[1] >= ay1) continue;
      taken.add(k);
      outline.push(p);
    }
  }
  return { fill, outline, core: [x0, y0, x0 + size, y0 + size] };
}
// RGBA of a 16 × 16 texture with the arrow drawn in. Pure.
export function withArrow(raw, spec, style = STYLE) {
  const out = Buffer.from(raw);
  const { fill, outline } = arrowPixels(spec);
  for (const [x, y] of outline) out.set(style.outline, (y * 16 + x) * 4);
  for (const [x, y] of fill) out.set(style.fill, (y * 16 + x) * 4);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Vanilla data and model resolution.
const full = id => (String(id).includes(':') ? String(id) : `minecraft:${id}`);
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf-8'));
const box = el => `${el.from.join(',')} ${el.to.join(',')}`;

// Loads the version's vanilla texture as RGBA 16 × 16, refusing animated or resized ones.
async function vanillaTexture(vanilla, name) {
  const file = path.join(vanilla.assets, 'minecraft', 'textures', 'block', `${name}.png`);
  if (!fs.existsSync(file)) throw new Error(`vanilla has no block texture ${name}`);
  if (fs.existsSync(`${file}.mcmeta`)) throw new Error(`vanilla ${name}.png has an .mcmeta now (animation?): check the arrow`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 16 || info.height !== 16) throw new Error(`vanilla ${name}.png is ${info.width} × ${info.height}, expected 16 × 16`);
  return data;
}

// A model resolved through its parents: { elements, textures (slot → "ns:path"), ambientocclusion }.
// own: { "ns:block/x": json } of our generated models; everything else is read from vanilla.
function resolveModel(id, vanilla, own) {
  const chain = [];
  for (let cur = full(id); cur;) {
    if (chain.length > 20) throw new Error(`${id}: parent loop`);
    let json = own[cur];
    if (!json) {
      const [ns, p] = cur.split(':');
      if (ns !== 'minecraft') throw new Error(`model ${cur} does not exist`);
      const file = path.join(vanilla.assets, 'minecraft', 'models', `${p}.json`);
      if (!fs.existsSync(file)) throw new Error(`vanilla has no model ${cur}`);
      json = readJson(file);
    }
    chain.push(json);
    cur = json.parent ? full(json.parent) : null;
  }
  const slots = {};
  for (const json of [...chain].reverse()) Object.assign(slots, json.textures || {});
  const texture = ref => {
    let r = ref;
    for (let i = 0; r.startsWith('#'); i++) {
      if (i > 20 || !(r.slice(1) in slots)) throw new Error(`${id}: texture ${ref} is not set`);
      r = slots[r.slice(1)];
    }
    return full(r);
  };
  const elements = chain.find(j => j.elements)?.elements;
  if (!elements) throw new Error(`${id}: no elements`);
  return {
    elements: elements.map(el => ({ ...el, faces: Object.fromEntries(Object.entries(el.faces).map(([f, s]) => [f, { ...s, resolved: texture(s.texture) }])) })),
    ambientocclusion: chain.find(j => 'ambientocclusion' in j)?.ambientocclusion ?? true
  };
}
// The geometry of resolved elements without the textures, to compare ours with vanilla's.
const shape = elements => JSON.stringify(elements.map(el => ({ ...el, faces: Object.fromEntries(Object.entries(el.faces).map(([f, s]) => {
  const { texture, resolved, ...rest } = s;
  return [f, rest];
})) })));

// ---------------------------------------------------------------------------------------------
// Building.
export function buildModels(vanilla) {
  const models = {};
  for (const [name, spec] of Object.entries(MODELS)) {
    const file = path.join(vanilla.assets, 'minecraft', 'models', 'block', `${name}.json`);
    if (!fs.existsSync(file)) throw new Error(`vanilla has no model block/${name}`);
    const original = readJson(file);
    let model;
    if (spec.child) {
      model = { parent: `minecraft:block/${name}`, textures: Object.fromEntries(Object.entries(spec.child).map(([slot, t]) => [slot, `${NS}:block/${t}`])) };
    } else if (spec.parent) {
      if (full(original.parent) !== `minecraft:block/${spec.parent}`) throw new Error(`vanilla block/${name} is no longer a child of block/${spec.parent}`);
      model = { ...original, parent: `${NS}:block/${spec.parent}` };
    } else {
      model = JSON.parse(JSON.stringify(original));
      if (!model.elements) throw new Error(`vanilla block/${name} has no elements of its own`);
      model.textures = { ...model.textures };
      for (const [where, faces] of Object.entries(spec.copy)) {
        const found = model.elements.filter(el => box(el) === where);
        if (found.length !== 1) throw new Error(`vanilla block/${name}: expected one element ${where}, found ${found.length}`);
        for (const [face, t] of Object.entries(faces)) {
          if (!found[0].faces[face]) throw new Error(`vanilla block/${name}: element ${where} has no ${face} face`);
          model.textures[t] = `${NS}:block/${t}`;
          found[0].faces[face] = { ...found[0].faces[face], texture: `#${t}` };
        }
      }
    }
    models[`${NS}:block/${name}`] = model;
  }
  return models;
}

// The vanilla blockstate with our models instead of vanilla's, everything else the same.
export function buildBlockstate(block, vanilla) {
  const original = readJson(path.join(vanilla.assets, 'minecraft', 'blockstates', `${block}.json`));
  if (!original.variants || original.multipart) throw new Error(`vanilla ${block} blockstate is not a plain variants file any more`);
  const variants = {};
  for (const [key, v] of Object.entries(original.variants)) {
    if (Array.isArray(v)) throw new Error(`${block} ${key}: random models are not expected`);
    if (v.uvlock) throw new Error(`${block} ${key}: uvlock would keep the textures still while the model turns`);
    const name = full(v.model).replace(/^minecraft:block\//, '');
    if (!MODELS[name]) throw new Error(`${block} ${key}: vanilla uses ${v.model}, which the pack has no copy of`);
    variants[key] = { ...v, model: `${NS}:block/${name}` };
  }
  return { variants };
}

// Proves every arrow of a block right, variant by variant (see the top). → [{ variant, output, arrows: [face] }]
export function verify(block, ours, vanilla, models) {
  const original = readJson(path.join(vanilla.assets, 'minecraft', 'blockstates', `${block}.json`));
  if (JSON.stringify(Object.keys(ours.variants)) !== JSON.stringify(Object.keys(original.variants))) throw new Error(`${block}: the variants differ from vanilla`);
  const report = [];
  for (const [key, v] of Object.entries(ours.variants)) {
    const van = original.variants[key];
    const where = `${block} ${key}`;
    if ((v.x || 0) !== (van.x || 0) || (v.y || 0) !== (van.y || 0) || !!v.uvlock !== !!van.uvlock || v.uvlock) throw new Error(`${where}: rotation or uvlock differs from vanilla`);
    const facing = /(?:^|,)facing=(\w+)/.exec(key)?.[1];
    if (!DIR[facing]) throw new Error(`${where}: no facing`);
    const output = BLOCKS[block](facing);
    const mine = resolveModel(v.model, vanilla, models);
    const theirs = resolveModel(van.model, vanilla, models);
    if (shape(mine.elements) !== shape(theirs.elements) || mine.ambientocclusion !== theirs.ambientocclusion) throw new Error(`${where}: the geometry differs from vanilla`);
    const world = d => nameOf(turn(d, v.x, v.y));
    const arrows = [];
    mine.elements.forEach((el, i) => {
      for (const [face, s] of Object.entries(el.faces)) {
        const vanillaTexture = theirs.elements[i].faces[face].resolved;
        const own = s.resolved.startsWith(`${NS}:block/`) ? TEXTURES[s.resolved.slice(NS.length + 7)] : null;
        if (!own) {
          if (s.resolved !== vanillaTexture) throw new Error(`${where}: ${face} face of ${box(el)} shows ${s.resolved} instead of ${vanillaTexture}`);
          continue;
        }
        if (`minecraft:block/${own.base}` !== vanillaTexture) throw new Error(`${where}: ${face} face of ${box(el)} shows an arrow on ${own.base}, vanilla shows ${vanillaTexture}`);
        const points = world(faceArrow(face, el, own.dir));
        if (points !== output) throw new Error(`${where}: the arrow on the ${world(DIR[face])} face of ${box(el)} points ${points}, the output is ${output}`);
        const [cx0, cy0, cx1, cy1] = arrowPixels(own).core;
        const [sx0, sy0, sx1, sy1] = shownPart(face, el);
        if (cx0 < sx0 || cy0 < sy0 || cx1 > sx1 || cy1 > sy1) throw new Error(`${where}: the arrow on the ${face} face of ${box(el)} lies outside the part of the texture the face shows`);
        arrows.push(`${world(DIR[face])}${el.from.join() === '0,0,0' && el.to.join() === '16,16,16' ? '' : ` (${box(el)})`}`);
      }
    });
    // What "facing" means, read from the models themselves.
    const faceWith = re => mine.elements.flatMap(el => Object.entries(el.faces).filter(([, s]) => re.test(s.resolved)).map(([f]) => world(DIR[f])));
    if (block === 'dispenser' || block === 'dropper') {
      if (JSON.stringify(faceWith(new RegExp(`:block/${block}_front`))) !== JSON.stringify([facing])) throw new Error(`${where}: the front texture is not on the ${facing} face`);
    } else if (block === 'observer') {
      if (JSON.stringify(faceWith(/:block\/observer_back/)) !== JSON.stringify([output])) throw new Error(`${where}: the red dot is not on the ${output} face`);
      if (JSON.stringify(faceWith(/:block\/observer_front$/)) !== JSON.stringify([facing])) throw new Error(`${where}: the observer's face is not on the ${facing} side`);
    } else if (block === 'hopper') {
      // The spout: the only element at most 4 px wide across that touches the block's edge.
      const spouts = mine.elements.flatMap(el => [0, 1, 2].flatMap(axis => {
        const across = [0, 1, 2].filter(a => a !== axis);
        if (across.some(a => el.to[a] - el.from[a] > 4)) return [];
        const d = [0, 0, 0];
        if (el.from[axis] === 0) d[axis] = -1; else if (el.to[axis] === 16) d[axis] = 1; else return [];
        return [world(d)];
      }));
      if (JSON.stringify(spouts) !== JSON.stringify([facing])) throw new Error(`${where}: the spout points ${spouts.join(', ')}, not ${facing}`);
    }
    if (!arrows.length) throw new Error(`${where}: no arrow at all`);
    report.push({ variant: key, output, arrows });
  }
  return report;
}

export async function build(vanilla) {
  const files = {};
  const models = buildModels(vanilla);
  for (const [id, json] of Object.entries(models)) files[`assets/${NS}/models/${id.split(':')[1]}.json`] = json;
  const used = new Set();
  const reports = {};
  for (const block of Object.keys(BLOCKS)) {
    const state = buildBlockstate(block, vanilla);
    reports[block] = verify(block, state, vanilla, models);
    for (const v of Object.values(state.variants)) {
      for (const el of resolveModel(v.model, vanilla, models).elements) for (const s of Object.values(el.faces)) if (s.resolved.startsWith(`${NS}:`)) used.add(s.resolved.slice(NS.length + 7));
    }
    files[`assets/minecraft/blockstates/${block}.json`] = state;
  }
  for (const [name, spec] of Object.entries(TEXTURES)) {
    if (!used.has(name)) throw new Error(`texture ${name} is not shown anywhere`);
    const raw = withArrow(await vanillaTexture(vanilla, spec.base), spec);
    files[`assets/${NS}/textures/block/${name}.png`] = await sharp(raw, { raw: { width: 16, height: 16, channels: 4 } }).png({ compressionLevel: 9, palette: false }).toBuffer();
  }
  return { files, reports };
}

export default async function ({ vanilla }) {
  return (await build(vanilla)).files;
}
