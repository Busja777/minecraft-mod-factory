import { Skin } from './skin.js';
import { BLACK, T, hex, neonRamp, rng } from './color.js';

// Glow / neon skins after "New updated mc skin/SKILL.md": inner layer 70–80 % black with neon details,
// the overlay is BLACK structure (panels, wings, ears, joints) that defines the character.
//
// glow({ neon: '#00ffc8', neon2, archetype, eyes, body, arms, legs, back, seed, slim })
//   archetype: armor | kabuto | creature | cracked | marionette | headband   (overlay concept, decide first)
//   eyes:      slit | wide | visor | fox | asym | hollow | bar
//   body:      plates | diagonal | constellation | threads | circles | zigzag | emblem
//   arms:      rings | joints | diagonal | edge         legs: plates | joints | stripes | edge
//   back:      spine | sigil | banner | same            (the back tells its own story)
// Returns the Skin; finish details with skin.face(...).paint(...).

const K = BLACK;

// Overlay templates (K = black, ' ' = transparent), transcribed from the skill.
const HAT = {
  armor: {
    front: ['KKKKKKKK', '        ', 'K  KK  K', 'K      K', 'K      K', '        ', 'KKKKKKKK', 'K  KK  K'],
    side: ['        ', 'KKKKKKKK', '        ', 'K      K', '        ', '        ', '        ', 'K      K'],
    back: ['        ', 'KKKKKKKK', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK'],
    top: ['        ', ' KKKKKK ', '        ', '        ', '        ', '        ', ' KKKKKK ', '        ']
  },
  kabuto: {
    front: ['KKKKKKKK', '        ', 'KK    KK', 'K      K', 'K      K', '        ', 'KKKKKKKK', 'K  KK  K'],
    right: ['      KK', 'KKKKKKKK', 'K      K', 'KKKKKKKK', 'K     KK', 'KKKKKKKK', '  K     ', '        '],
    left: ['KK      ', 'KKKKKKKK', 'K      K', 'KKKKKKKK', 'KKK    K', 'KKKKKKKK', '     K  ', '        '],
    back: ['KKKKKKKK', 'K      K', 'KKKKKKKK', '        ', '        ', '        ', 'KKKKKKKK', '        '],
    top: ['   KK   ', '  KKKK  ', ' KK  KK ', '        ', '        ', '        ', '        ', '        ']
  },
  creature: {
    front: [' KKKKKK ', 'K      K', '        ', 'K      K', '        ', '        ', ' K    K ', '  KKKK  '],
    side: ['        ', ' KKKKKK ', '        ', '        ', 'K      K', '        ', '        ', '        '],
    back: ['        ', 'KKKKKKKK', '        ', '  K  K  ', '        ', '        ', '        ', ' KKKKKK '],
    top: [' K    K ', ' K    K ', ' K    K ', '        ', '        ', '        ', '        ', '        ']
  },
  cracked: {
    front: ['K KK KKK', '        ', 'K  K   K', 'K      K', '       K', '        ', 'KK KK KK', 'K     K '],
    side: ['        ', 'KK KK KK', '        ', 'K      K', '        ', '   K    ', '        ', 'K     K '],
    back: ['        ', 'K KKK KK', '        ', '   K    ', '        ', '  K     ', '        ', 'KK  KKKK'],
    top: ['        ', '  K  K  ', '        ', '   K    ', '        ', '        ', '  K  K  ', '        ']
  },
  marionette: {
    front: ['KKKKKKKK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K KKKK K', 'KKKKKKKK'],
    side: ['        ', 'KKKKKKKK', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK'],
    back: ['        ', 'KKKKKKKK', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK'],
    top: ['   KK   ', '  KKKK  ', '   KK   ', '        ', '        ', '        ', '        ', '        ']
  },
  headband: {
    front: ['KKKKKKKK', '        ', 'KKKKKKKK', '        ', '        ', '        ', '        ', 'K  KK  K'],
    side: ['KKKKKKKK', '        ', 'KKKKKKKK', '        ', '        ', '        ', '        ', '        '],
    back: ['KKKKKKKK', '   KK   ', 'KKKKKKKK', '   K    ', '    K   ', '        ', '        ', '        '],
    top: ['        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ']
  }
};

const BODY = {
  armor: ['        ', ' K    K ', '        ', 'KKKKKKKK', 'K      K', 'K      K', 'KKKKKKKK', '        ', ' K    K ', ' K KK K ', ' KKKKKK ', ' K    K '],
  kabuto: ['KKKKKKKK', 'K K  K K', 'KKKKKKKK', 'K  KK  K', 'K      K', 'K      K', 'KKKKKKKK', '        ', ' K KK K ', ' K    K ', ' KKKKKK ', ' K    K '],
  creature: ['K      K', ' K    K ', '  K     ', '   K    ', '    K   ', 'KKKKKKKK', '        ', '     K  ', '    K   ', '   K    ', ' KKKKKK ', ' K    K '],
  cracked: [' K KK K ', ' K    K ', '        ', 'K KKKK K', 'K      K', 'K KKKK K', '        ', ' K    K ', ' K    K ', ' K KK K ', ' KK  KK ', ' K    K '],
  marionette: [' KK  KK ', 'K  KK  K', ' KK  KK ', '   KK   ', '  K  K  ', '   KK   ', 'KKKKKKKK', '        ', ' K    K ', ' K    K ', ' KKKKKK ', '        '],
  headband: [' KKKKKK ', '        ', '        ', 'K      K', '        ', '        ', 'KKKKKKKK', '        ', ' K    K ', '        ', ' K    K ', ' KKKKKK ']
};

const ARM = {
  rings: ['K   ', 'KKKK', '   K', '   K', ' K  ', 'KKKK', 'K   ', '  KK', ' KKK', ' KKK', ' KKK', 'KKKK'],
  joints: ['K   ', 'KKKK', 'K   ', '    ', '    ', 'KKKK', '   K', '    ', '   K', '    ', '    ', 'KKKK'],
  diagonal: ['K   ', ' K  ', '  K ', '   K', 'K   ', ' K  ', '  K ', '   K', 'K   ', ' K  ', 'KKKK', '    '],
  edge: ['KKKK', '    ', '    ', 'K   ', 'K   ', 'KKKK', '    ', '    ', 'K   ', 'K   ', '    ', 'KKKK']
};
const ARM_SIDE = ['    ', 'KKKK', '    ', '    ', '    ', 'KKKK', '    ', '    ', '    ', '    ', '    ', 'KKKK'];
const LEG = {
  plates: ['KKKK', '    ', 'KKKK', 'K  K', 'K  K', 'KKKK', '    ', ' KK ', '    ', 'KKKK', '    ', 'KKKK'],
  joints: ['KKKK', '    ', '    ', '    ', ' KK ', 'K  K', ' KK ', '    ', '    ', 'KKKK', '    ', 'KKKK'],
  stripes: ['KKKK', 'K   ', 'K   ', 'K   ', 'KKKK', '    ', '   K', '   K', '   K', 'KKKK', '    ', 'KKKK'],
  edge: ['KKKK', '    ', '    ', '    ', '    ', 'KKKK', '    ', '    ', '    ', 'KKKK', '    ', 'KKKK']
};
const LEG_SIDE = ['KKKK', '    ', '    ', '    ', '    ', 'KKKK', '    ', '    ', '    ', 'KKKK', '    ', 'KKKK'];

// Inner face: 0 = black, 1–7 = neon ramp steps (7 = full neon), A/B = second colour ramp (5 / 7).
const EYES = {
  slit: ['00000000', '00000000', '00000000', '11000011', '27700772', '00000000', '70777707', '00000000'],
  wide: ['00000000', '11100111', '00000000', '00000000', '33300333', '17700771', '01100110', '70077007'],
  visor: ['00000000', '00000000', '00000000', '77000077', '07700770', '00000000', '00000000', '00000000'],
  fox: ['00000000', '00000000', '70000007', '07000070', '00700700', '00000000', '00077000', '00000000'],
  asym: ['00000000', '00000000', '07700000', '00000000', '00000770', '00000000', '00700000', '00070000'],
  hollow: ['00000000', '07700770', '70077007', '07700770', '00000000', '00700700', '00077000', '00700700'],
  bar: ['00000000', '00000000', '00000000', '33333333', '77777777', '33333333', '00000000', '00000000']
};

const BODY_IN = {
  plates: ['00000000', '00000000', '00000000', '11111111', '10000001', '22222222', '00000000', '03000030', '07077070', '07077070', '07000070', '07777770'],
  diagonal: ['00000000', '00000007', '00000070', '00000700', '00007000', '0007A000', '00700000', '07000000', '70000000', '00000000', '22222222', '00000000'],
  constellation: ['00000000', '07000000', '00000700', '00000000', '00700000', '00000070', '00000000', '70000000', '00007000', '00000000', '00700007', '00000000'],
  threads: ['07000070', '07000070', '07000070', '07077070', '07700770', '07077070', '07000070', '07000070', '07000070', '07000070', '22222222', '00000000'],
  circles: ['00000000', '00777700', '07000070', '07000070', '00777700', '00000000', '22222222', '00000000', '00077000', '00700700', '00077000', '00000000'],
  zigzag: ['00000000', '00000700', '00007000', '00070000', '00700000', '00070000', '00007000', '00000700', '00007000', '00070000', '22222222', '00000000'],
  emblem: ['00000000', '00000000', '00000000', '00011000', '00177100', '01777710', '00177100', '00011000', '22222222', '00000000', '07000070', '07777770']
};

const ARM_IN = {
  rings: ['0000', '1117', '0007', '0207', '0000', '3337', '7000', '0077', '7077', '7077', '7077', '7777'],
  joints: ['0000', '0770', '7007', '0770', '0000', '0770', '7007', '0770', '0000', '0000', '0770', '7777'],
  diagonal: ['0000', '7000', '0700', '0070', '0007', '0000', '7000', '0700', '0070', '0007', '0000', '7777'],
  edge: ['0000', '0007', '0007', '0007', '0000', '0007', '0007', '0000', '0007', '0007', '0007', '7777']
};
const LEG_IN = {
  plates: ['0000', '0000', '0000', '0000', '0000', '2222', '0000', '0000', '7007', '7007', '0000', '7777'],
  joints: ['0000', '0000', '0000', '0000', '0770', '7007', '0770', '0000', '0000', '0000', '0000', '7777'],
  stripes: ['7000', '7000', '0000', '0000', '0000', '0000', '0007', '0007', '0007', '0000', '0000', '7777'],
  edge: ['0000', '0000', '0000', '0000', '0000', '3333', '0000', '0000', '0000', '0000', '0000', '7777']
};

const BACK_IN = {
  spine: ['00077000', '00011000', '00077000', '00011000', '00077000', '00011000', '00077000', '00011000', '00077000', '22222222', '00000000', '00000000'],
  sigil: ['00000000', '00000000', '00700700', '00077000', '00777700', '00077000', '00700700', '00000000', '22222222', '00000000', '00000000', '00000000'],
  banner: ['07777770', '07000070', '07077070', '07000070', '07777770', '00700700', '00700700', '00000000', '22222222', '00000000', '00000000', '00000000']
};

function inner(face, rows, R, R2) {
  const map = {};
  for (let i = 0; i <= 7; i++) map[String(i)] = R[i];
  map.A = R2[5]; map.B = R2[7];
  face.paint(rows, map);
}
const over = (face, rows) => face.paint(rows, { K });

// Soft glow like the hand-made packs: black pixels next to full neon pick up a dim transition shade
// (bleed = share of such neighbours), plus a few scattered sparks (sparkle = share of black pixels).
export function glowBleed(s, R, { bleed = 0.55, sparkle = 0.025, seed = 1 } = {}) {
  const r = rng(`bleed${seed}`);
  const bright = c => Math.max(c[0], c[1], c[2]) >= 190;
  for (const part of ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']) for (const f of s.faces(part)) {
    const snap = [];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) snap.push(f.get(x, y));
    const at = (x, y) => (x < 0 || y < 0 || x >= f.w || y >= f.h ? null : snap[y * f.w + x]);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const c = at(x, y);
      if (c[0] + c[1] + c[2] > 0) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = at(x + dx, y + dy); return n && bright(n); });
      if (near && r() < bleed) f.set(x, y, R[r() < 0.6 ? 2 : 3]);
      else if (!near && r() < sparkle) f.set(x, y, R[r() < 0.7 ? 1 : 4]);
    }
  }
}

export function glow({ neon = '#00ffc8', neon2, archetype = 'armor', eyes = 'slit', body = 'plates', arms = 'rings', legs = 'plates', back = 'same', seed = 1, slim = false, bleed = 0.55, sparkle = 0.025 } = {}) {
  const s = new Skin({ slim });
  const R = neonRamp(neon), R2 = neonRamp(neon2 || neon);
  const r = rng(seed);
  for (const part of ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']) s.fillPart(part, K);

  // ── Inner: head ──
  inner(s.face('head', 'front'), EYES[eyes] || EYES.slit, R, R2);
  const hs = ['00000000', '00000000', '00000000', '10000000', '20000000', '00000000', '00000000', '00000000'];
  inner(s.face('head', 'right'), hs.map(x => [...x].reverse().join('')), R, R2);
  inner(s.face('head', 'left'), hs, R, R2);
  inner(s.face('head', 'back'), ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00011000', '00000000'], R, R2);

  // ── Inner: body ──
  const bodyRows = BODY_IN[body] || BODY_IN.plates;
  inner(s.face('body', 'front'), bodyRows, R, R2);
  inner(s.face('body', 'back'), back === 'same' ? bodyRows.map(x => [...x].reverse().join('')) : (BACK_IN[back] || BACK_IN.spine), R, R2);
  for (const side of ['right', 'left']) inner(s.face('body', side), ['0000', '0000', '0000', '1111', '0000', '2222', '0000', '0000', '0110', '0000', '0000', '0770'], R, R2);

  // ── Inner: arms and legs (right side, then mirrored) ──
  const armRows = ARM_IN[arms] || ARM_IN.rings;
  inner(s.face('rightArm', 'front'), slim ? armRows.map(x => x.slice(1)) : armRows, R, R2);
  inner(s.face('rightArm', 'right'), ['0000', '0000', '0000', '0000', '0000', '1111', '0000', '0000', '0000', '0000', '0000', '7777'], R, R2);
  inner(s.face('rightArm', 'back'), (slim ? armRows.map(x => x.slice(1)) : armRows).map(x => [...x].reverse().join('').replace(/7/g, (m, i) => (i % 2 ? '3' : '7'))), R, R2);
  inner(s.face('rightArm', 'bottom'), ['7777', '7777', '7777', '7777'], R, R2);
  inner(s.face('rightLeg', 'front'), LEG_IN[legs] || LEG_IN.plates, R, R2);
  inner(s.face('rightLeg', 'right'), ['0000', '0000', '0000', '0000', '0000', '1111', '0000', '0000', '0000', '0000', '0000', '7777'], R, R2);
  inner(s.face('rightLeg', 'back'), ['0000', '0000', '0000', '0000', '0000', '1111', '0000', '0000', '0000', '0000', '0000', '3333'], R, R2);

  // ── Overlay: the concept ──
  const hat = HAT[archetype] || HAT.armor;
  over(s.face('head', 'front', 'outer'), hat.front);
  over(s.face('head', 'right', 'outer'), hat.right || hat.side);
  over(s.face('head', 'left', 'outer'), hat.left || hat.side);
  over(s.face('head', 'back', 'outer'), hat.back);
  over(s.face('head', 'top', 'outer'), hat.top);
  const bodyOl = BODY[archetype] || BODY.armor;
  over(s.face('body', 'front', 'outer'), bodyOl);
  over(s.face('body', 'back', 'outer'), bodyOl.map(x => [...x].reverse().join('')));
  for (const side of ['right', 'left']) over(s.face('body', side, 'outer'), [' KK ', '    ', '    ', 'KKKK', '    ', '    ', 'KKKK', '    ', '    ', '    ', '    ', 'KKKK']);
  over(s.face('body', 'top', 'outer'), ['KKKKKKKK', '        ', '        ', '        ']);

  const armOl = ARM[arms] || ARM.rings;
  const fit = rows => (slim ? rows.map(x => x.slice(1)) : rows);
  over(s.face('rightArm', 'front', 'outer'), fit(armOl));
  over(s.face('rightArm', 'right', 'outer'), ARM_SIDE);
  over(s.face('rightArm', 'left', 'outer'), ARM_SIDE);
  over(s.face('rightArm', 'back', 'outer'), fit(ARM_SIDE));
  over(s.face('rightArm', 'top', 'outer'), fit(['K   ', '    ', '    ', '    ']));
  const legOl = LEG[legs] || LEG.plates;
  over(s.face('rightLeg', 'front', 'outer'), legOl);
  over(s.face('rightLeg', 'right', 'outer'), LEG_SIDE);
  over(s.face('rightLeg', 'left', 'outer'), LEG_SIDE);
  over(s.face('rightLeg', 'back', 'outer'), LEG_SIDE);

  s.mirrorLimbs();
  glowBleed(s, R, { bleed, sparkle, seed });
  s.revealBright();
  // A pinch of variation so two skins with the same recipe never match pixel for pixel.
  const f = s.face('body', 'back');
  if (r() > 0.5) f.set(Math.floor(r() * 8), 10, R[3]);
  return s;
}

export { HAT, BODY, ARM, LEG, EYES, BODY_IN, ARM_IN, LEG_IN, BACK_IN };
export const neon = (c, step = 7) => neonRamp(hex(c))[step];
export { T };
