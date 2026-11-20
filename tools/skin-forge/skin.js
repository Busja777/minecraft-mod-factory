import sharp from 'sharp';
import { PARTS, FACES, SIDES, faceRect } from './layout.js';
import { hex, T, rng, shade } from './color.js';

// A 64x64 skin you paint face by face:
//   const s = new Skin({ slim });
//   s.face('head', 'front').paint(['........', 'kWPkkPWk', …], { k: skin, W: white, P: pupil });
//   s.face('head', 'top', 'outer').fill(hair);
//   s.band('body', 6, belt)            // a ring around all four sides of a part
//   await s.png()

export class Face {
  constructor(skin, part, face, layer, rect) { Object.assign(this, { skin, part, face, layer, ...rect }); }
  inside(fx, fy) { return fx >= 0 && fy >= 0 && fx < this.w && fy < this.h; }
  set(fx, fy, c) { if (this.inside(fx, fy)) this.skin.setPx(this.x + fx, this.y + fy, c); return this; }
  get(fx, fy) { return this.skin.getPx(this.x + fx, this.y + fy); }
  fill(c) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c); return this; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  row(y, c, x0 = 0, x1 = this.w - 1) { for (let x = x0; x <= x1; x++) this.set(x, y, c); return this; }
  col(x, c, y0 = 0, y1 = this.h - 1) { for (let y = y0; y <= y1; y++) this.set(x, y, c); return this; }
  clear() { return this.fill(T); }

  // rows: strings, one char per pixel. map: { char: colour }. '.' leaves the pixel, ' ' clears it.
  // Rows shorter than the face are left-aligned; extra chars are ignored.
  paint(rows, map = {}, { x = 0, y = 0 } = {}) {
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch === '.') return;
      if (ch === ' ') return this.set(x + i, y + j, T);
      const c = map[ch];
      if (c === undefined) throw new Error(`paint: no colour for "${ch}" on ${this.part}.${this.face}`);
      this.set(x + i, y + j, c);
    }));
    return this;
  }

  // Classic edge-darkening: border one step darker, corners two (ramp: darkest … brightest).
  shaded(ramp, { light = 'top' } = {}) {
    const n = ramp.length, mid = Math.max(1, n - 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const edge = (x === 0 || x === this.w - 1) + (y === 0 || y === this.h - 1);
      let i = mid - edge;
      if (light === 'top' && y === 0 && edge === 1) i = Math.min(n - 1, mid + 1);
      this.set(x, y, ramp[Math.max(0, i)]);
    }
    return this;
  }

  // Pixel texture: picks per pixel from weighted colours ([[colour, weight], …]).
  texture(choices, seed = 1, { only } = {}) {
    const r = rng(`${seed}:${this.part}:${this.face}:${this.layer}`);
    const total = choices.reduce((s, [, w]) => s + w, 0);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (only && !only(x, y)) continue;
      let p = r() * total;
      for (const [c, w] of choices) { if ((p -= w) <= 0) { this.set(x, y, c); break; } }
    }
    return this;
  }

  // Darken/lighten every opaque pixel slightly at random (breaks up flat areas).
  noise(amount = 0.08, seed = 1) {
    const r = rng(`n${seed}:${this.part}:${this.face}:${this.layer}`);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.get(x, y);
      if (c[3] === 0) continue;
      this.set(x, y, shade(c, 1 + (r() * 2 - 1) * amount));
    }
    return this;
  }

  flipX() {
    const rows = [];
    for (let y = 0; y < this.h; y++) { const row = []; for (let x = 0; x < this.w; x++) row.push(this.get(x, y)); rows.push(row); }
    rows.forEach((row, y) => row.reverse().forEach((c, x) => this.set(x, y, c)));
    return this;
  }
}

export class Skin {
  constructor({ slim = false } = {}) {
    this.slim = slim;
    this.data = new Uint8Array(64 * 64 * 4);
  }
  static async fromPng(buf, { slim = false } = {}) {
    const s = new Skin({ slim });
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 64 || info.height !== 64) throw new Error(`Skin must be 64x64, got ${info.width}x${info.height}`);
    s.data.set(data);
    return s;
  }
  clone() { const s = new Skin({ slim: this.slim }); s.data.set(this.data); return s; }
  setPx(x, y, c) { const i = (y * 64 + x) * 4; const v = hex(c); this.data[i] = v[0]; this.data[i + 1] = v[1]; this.data[i + 2] = v[2]; this.data[i + 3] = v[3] ?? 255; }
  getPx(x, y) { const i = (y * 64 + x) * 4; return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]; }

  face(part, face, layer = 'inner') { return new Face(this, part, face, layer, faceRect(part, face, layer, { slim: this.slim })); }
  faces(part, layer = 'inner', names = FACES) { return names.map(f => this.face(part, f, layer)); }
  sides(part, layer = 'inner') { return this.faces(part, layer, SIDES); }

  // Fill a whole part (all six faces).
  fillPart(part, c, layer = 'inner') { this.faces(part, layer).forEach(f => f.fill(c)); return this; }
  shadePart(part, ramp, layer = 'inner') { this.faces(part, layer).forEach(f => f.shaded(ramp)); return this; }

  // A horizontal ring around the four side faces at row y (belts, cuffs, bands).
  band(part, y, c, layer = 'inner') { this.sides(part, layer).forEach(f => f.row(y, c)); return this; }

  // Copies a right limb onto the left one, mirrored the way the model mirrors it.
  mirrorLimb(from = 'rightArm', to = from === 'rightArm' ? 'leftArm' : 'leftLeg', layers = ['inner', 'outer']) {
    const swap = { right: 'left', left: 'right' };
    for (const layer of layers) for (const f of FACES) {
      const src = this.face(from, f, layer), dst = this.face(to, swap[f] || f, layer);
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) dst.set(src.w - 1 - x, y, src.get(x, y));
    }
    return this;
  }
  mirrorLimbs(layers) { this.mirrorLimb('rightArm', 'leftArm', layers); this.mirrorLimb('rightLeg', 'leftLeg', layers); return this; }

  // Clears overlay pixels that would cover bright inner pixels (glow skins: neon must stay visible).
  revealBright(minLum = 70) {
    for (const part of Object.keys(PARTS)) for (const f of FACES) {
      const a = this.face(part, f, 'inner'), b = this.face(part, f, 'outer');
      for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
        const c = a.get(x, y), o = b.get(x, y);
        if (o[3] > 0 && o[0] + o[1] + o[2] < 60 && 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] >= minLum) b.set(x, y, T);
      }
    }
    return this;
  }

  clearLayer(layer = 'outer') { for (const part of Object.keys(PARTS)) this.faces(part, layer).forEach(f => f.clear()); return this; }

  async png() { return sharp(Buffer.from(this.data), { raw: { width: 64, height: 64, channels: 4 } }).png().toBuffer(); }
}
