import { allFaces, faceRect, PARTS, SIDES } from './layout.js';
import { luminance } from './color.js';

// The checklists of the operator's skin skills as hard checks.
//   measure(skin)           → numbers (opacity, black/neon share, overlay transparency per part)
//   validate(skin, { style }) → { ok, errors, warnings, stats }
//   structure(skin)         → colour-independent signature; distinct(a, b) compares two of them

const OVERLAY_TARGETS = { // share of TRANSPARENT overlay pixels (whole overlay), from overlay-strategies.md
  minimal: [0.9, 1], hair: [0.85, 1], accent: [0.6, 0.92], clothing: [0.15, 0.7], glow: [0.3, 0.8]
};

function pixels(skin, rects) {
  const out = [];
  for (const r of rects) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) out.push(skin.getPx(r.x + x, r.y + y));
  return out;
}

const isBlack = c => c[3] > 0 && c[0] < 24 && c[1] < 24 && c[2] < 24;
const isNeon = c => c[3] > 0 && Math.max(c[0], c[1], c[2]) >= 190;

export function measure(skin) {
  const opts = { slim: skin.slim };
  const inner = pixels(skin, allFaces('inner', opts));
  const outer = pixels(skin, allFaces('outer', opts));
  const opaque = inner.filter(c => c[3] > 0);
  const perPart = {};
  for (const part of Object.keys(PARTS)) {
    const px = pixels(skin, ['top', 'bottom', ...SIDES].map(f => faceRect(part, f, 'outer', opts)));
    perPart[part] = px.filter(c => c[3] === 0).length / px.length;
  }
  return {
    innerOpaque: opaque.length / inner.length,
    innerSemi: inner.filter(c => c[3] > 0 && c[3] < 255).length,
    black: opaque.filter(isBlack).length / Math.max(1, opaque.length),
    neon: opaque.filter(isNeon).length / Math.max(1, opaque.length),
    overlayTransparent: outer.filter(c => c[3] === 0).length / outer.length,
    overlayPerPart: perPart,
    colours: new Set(opaque.concat(outer.filter(c => c[3] > 0)).map(c => c.join(','))).size
  };
}

// style: 'glow' | 'minimal' | 'hair' | 'accent' | 'clothing'
export function validate(skin, { style = 'accent' } = {}) {
  const m = measure(skin);
  const errors = [], warnings = [];
  if (m.innerOpaque < 1) errors.push(`inner layer has holes (${(100 - m.innerOpaque * 100).toFixed(1)} % transparent)`);
  if (m.innerSemi) errors.push(`inner layer has ${m.innerSemi} half-transparent pixels`);
  const [lo, hi] = OVERLAY_TARGETS[style] || OVERLAY_TARGETS.accent;
  if (m.overlayTransparent < lo || m.overlayTransparent > hi) {
    (style === 'glow' ? errors : warnings).push(`overlay ${(m.overlayTransparent * 100).toFixed(0)} % transparent, ${style} wants ${lo * 100}–${hi * 100} %`);
  }
  if (style === 'glow') {
    if (m.black < 0.6) errors.push(`only ${(m.black * 100).toFixed(0)} % black, glow skins need ≥ 70 %`);
    else if (m.black < 0.7) warnings.push(`${(m.black * 100).toFixed(0)} % black, glow skins aim for 70–80 %`);
    if (m.neon < 0.03) errors.push(`only ${(m.neon * 100).toFixed(1)} % neon, glow skins need 3–15 %`);
    if (m.neon > 0.2) errors.push(`${(m.neon * 100).toFixed(0)} % neon reads flat, keep it 4–15 %`);
  } else {
    if (m.colours < 8) warnings.push(`only ${m.colours} colours, classic skins look flat below ~10`);
  }
  return { ok: errors.length === 0, errors, warnings, stats: m };
}

// ── Structure signature (colour-independent) ──────────────────────────────────────────────
// For each region: the overlay opacity mask and the inner "edge map" (where a pixel differs clearly
// from its right/lower neighbour in brightness). A recolour keeps both; a new design changes them.
export const REGIONS = {
  hat: [['head', 'top', 'outer'], ['head', 'front', 'outer'], ['head', 'right', 'outer'], ['head', 'left', 'outer'], ['head', 'back', 'outer']],
  face: [['head', 'front', 'inner']],
  body: [['body', 'front', 'inner'], ['body', 'front', 'outer'], ['body', 'back', 'inner'], ['body', 'back', 'outer']],
  arms: [['rightArm', 'front', 'inner'], ['rightArm', 'front', 'outer'], ['rightArm', 'right', 'inner'], ['leftArm', 'front', 'inner']],
  legs: [['rightLeg', 'front', 'inner'], ['rightLeg', 'front', 'outer'], ['leftLeg', 'front', 'inner']]
};

export function structure(skin) {
  const sig = {};
  for (const [name, faces] of Object.entries(REGIONS)) {
    const bits = [];
    for (const [part, face, layer] of faces) {
      const r = faceRect(part, face, layer, { slim: skin.slim });
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const c = skin.getPx(r.x + x, r.y + y);
        if (layer === 'outer') { bits.push(c[3] > 0 ? 1 : 0); continue; }
        const right = x + 1 < r.w ? skin.getPx(r.x + x + 1, r.y + y) : c;
        const down = y + 1 < r.h ? skin.getPx(r.x + x, r.y + y + 1) : c;
        bits.push(Math.abs(luminance(c) - luminance(right)) > 28 || Math.abs(luminance(c) - luminance(down)) > 28 ? 1 : 0);
      }
    }
    sig[name] = bits;
  }
  // Colour: the 3 most used hues (12 buckets), ignoring black/grey.
  const hues = new Map();
  for (const f of allFaces('inner', { slim: skin.slim })) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const [r, g, b] = skin.getPx(f.x + x, f.y + y);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 40 || max - min < 30) continue;
    let h = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
    h = Math.floor((((h * 60) + 360) % 360) / 30);
    hues.set(h, (hues.get(h) || 0) + 1);
  }
  sig.colour = [...hues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h).sort((a, b) => a - b);
  return sig;
}

function similarity(a, b) {
  let same = 0, any = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] || b[i]) { any++; if (a[i] === b[i]) same++; } }
  return any === 0 ? 1 : same / any;
}

// → { differs: n of 6 dimensions, details } — the skill wants ≥ 3 of 5 (here: hat, face, body, arms, legs, colour)
export function distinct(sigA, sigB, threshold = 0.8) {
  const details = {};
  let differs = 0;
  for (const k of Object.keys(REGIONS)) {
    const s = similarity(sigA[k], sigB[k]);
    details[k] = Math.round(s * 100) / 100;
    if (s < threshold) differs++;
  }
  const colourSame = sigA.colour.length === sigB.colour.length && sigA.colour.every((h, i) => h === sigB.colour[i]);
  details.colour = colourSame ? 'same' : 'different';
  if (!colourSame) differs++;
  return { differs, details };
}
