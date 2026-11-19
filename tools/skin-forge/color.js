// Colours are [r, g, b, a] arrays. T = transparent (clears an overlay pixel).

export const T = [0, 0, 0, 0];
export const BLACK = [0, 0, 0, 255];
export const WHITE = [255, 255, 255, 255];

const clamp = v => Math.max(0, Math.min(255, Math.round(v)));

export function hex(h) {
  if (Array.isArray(h)) return h.length === 4 ? h : [...h, 255];
  const s = String(h).replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export const toHex = c => '#' + c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');

// f < 1 darkens towards black, f > 1 lightens towards white (2 = white).
export function shade(c, f) {
  const [r, g, b, a = 255] = hex(c);
  if (f <= 1) return [clamp(r * f), clamp(g * f), clamp(b * f), a];
  const t = Math.min(1, f - 1);
  return [clamp(r + (255 - r) * t), clamp(g + (255 - g) * t), clamp(b + (255 - b) * t), a];
}

export function mix(a, b, t) {
  const x = hex(a), y = hex(b);
  return [0, 1, 2].map(i => clamp(x[i] + (y[i] - x[i]) * t)).concat(255);
}

// Shading ramp darkest → brightest around a base colour (classic edge-darkening skins use 4–6 steps).
export function ramp(base, steps = 5, spread = 0.45) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1); // 0..1
    const f = 1 - spread + t * spread * 1.6;     // e.g. 0.55 .. 1.27
    out.push(shade(base, f));
  }
  return out;
}

// Neon ramp from the glow skill: R[0] = black … R[7] = full neon; f^1.35 falloff.
export function neonRamp(neon) {
  const [r, g, b] = hex(neon);
  const s = f => [clamp(r * f ** 1.35), clamp(g * f ** 1.35), clamp(b * f ** 1.35), 255];
  return [BLACK, s(0.03), s(0.12), s(0.28), s(0.5), s(0.75), s(0.92), [r, g, b, 255]];
}

export const luminance = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// Seeded random numbers (mulberry32), so a skin always comes out the same.
export function rng(seed = 1) {
  let a = typeof seed === 'number' ? seed : [...String(seed)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
