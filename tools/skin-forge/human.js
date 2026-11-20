import { Skin } from './skin.js';
import { hex, ramp, shade, mix, rng, T, WHITE, BLACK } from './color.js';

// Classic shaded characters after "Skills- MC Classic Skin": inner layer complete and edge-shaded,
// overlay sparse (hair volume, helmet crests, pauldrons, cuffs, knee guards, hems).
//
// human({
//   slim, seed,
//   skin: '#c69c6d',
//   face: { eyes: '#3b6fd0', style: 'normal|angry|happy|closed|glow|dot|tired', mouth: 'none|smile|line|open|grin', brows, beard, blush },
//   hair: { color, style: 'short|long|bald|spiky|mohawk|bun|ponytail|curly|side' } | null,
//   head: { kind: 'none|helmet|greathelm|hood|cap|beanie|crown|wizard|bandana|mask|ears|strawhat|headband|nightcap|circlet|horns|halo', color, trim, … },
//   top:  { kind: 'shirt|armor|robe|hoodie|jersey|sweater|tunic|coat|overalls|tabard|suit|dress|vest', color, trim, second, pattern: { kind, color, text } },
//   sleeves: 'long|short|none', gloves, belt, pants, boots, cape, scarf,
//   texture: 0.06            // per-pixel noise for cloth/metal
// })
// Returns the Skin; finish details with skin.face(...).paint(...).

const R = (c, n = 5, spread = 0.45) => ramp(hex(c), n, spread);
const pick = (r, list) => list[Math.floor(r() * list.length)];

// 3x5 digits for jerseys
const DIGITS = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111']
};

const PATTERNS = { // 8 wide, painted on body front from row `y`
  cross: { y: 1, rows: ['...XX...', '...XX...', '.XXXXXX.', '...XX...', '...XX...', '...XX...', '...XX...'] },
  emblem: { y: 2, rows: ['...XX...', '..XYYX..', '.XYYYYX.', '..XYYX..', '...XX...'] },
  stripes: { y: 2, rows: ['XXXXXXXX', '........', 'XXXXXXXX', '........', 'XXXXXXXX'] },
  chevron: { y: 2, rows: ['X......X', '.X....X.', '..X..X..', '...XX...'] },
  star: { y: 2, rows: ['...X....', '..XXX...', 'XXXXXXX.', '.XXXXX..', '.X...X..'] },
  heart: { y: 2, rows: ['.XX.XX..', 'XXXXXXX.', 'XXXXXXX.', '.XXXXX..', '..XXX...', '...X....'] },
  fleur: { y: 2, rows: ['...X....', '..XXX...', 'X..X..X.', 'XXXXXXX.', '..XXX...', '.X.X.X..'] },
  lion: { y: 2, rows: ['.XXXX...', 'XYXXYX..', 'XXXXXX..', '.XYYX...', '.XXXX...'] },
  diamond: { y: 3, rows: ['...X....', '..XYX...', '.XYYYX..', '..XYX...', '...X....'] },
  sash: { y: 0, rows: ['X.......', '.X......', '..X.....', '...X....', '....X...', '.....X..', '......X.', '.......X'] },
  checker: { y: 1, rows: ['X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X'] },
  skull: { y: 2, rows: ['.XXXX...', 'XYXXYX..', 'XXXXXX..', '.X.X.X..'] },
  moon: { y: 2, rows: ['..XXX...', '.XX.....', '.X......', '.XX.....', '..XXX...'] },
  flame: { y: 4, rows: ['...X....', '..XX..X.', '.XXX.XX.', 'XXYXXXX.', 'XYYYXXX.', 'XXYYYXX.'] }
};

export function human(spec = {}) {
  const { slim = false, seed = 1, texture = 0.06 } = spec;
  const r = rng(seed);
  const s = new Skin({ slim });
  const SK = R(spec.skin || '#c69c6d', 5, 0.35);
  const face = { eyes: '#3b6fd0', style: 'normal', mouth: 'line', ...spec.face };
  const top = { kind: 'shirt', color: '#3a7bd5', ...spec.top };
  const TOP = R(top.color), TRIM = top.trim ? R(top.trim, 4) : null, SECOND = top.second ? R(top.second) : null;
  const PANTS = R(spec.pants || shade(hex(top.color), 0.55));
  const BOOTS = R(spec.boots || '#3b2a1e', 4);
  const sleeves = spec.sleeves || (['jersey', 'vest', 'overalls', 'dress'].includes(top.kind) ? 'none' : 'long');
  const armorish = ['armor', 'tabard'].includes(top.kind);

  // ── Base: everything skin, then clothes ──
  for (const p of ['head', 'body', 'rightArm', 'rightLeg']) s.shadePart(p, SK);

  // Legs: pants + boots
  s.shadePart('rightLeg', PANTS);
  for (const f of s.sides('rightLeg')) { f.rect(0, 9, f.w, 3, BOOTS[2]); f.row(11, BOOTS[1]); f.row(9, BOOTS[3]); }
  s.face('rightLeg', 'bottom').fill(BOOTS[0]);

  // Body
  s.shadePart('body', TOP);
  if (top.kind === 'robe' || top.kind === 'dress') {
    s.shadePart('rightLeg', TOP);
    for (const f of s.sides('rightLeg')) { f.row(11, BOOTS[1]); f.row(10, TOP[0]); }
  }

  // Arms
  const SLEEVE = top.sleeve ? R(top.sleeve) : armorish ? TOP : TOP;
  s.shadePart('rightArm', SK);
  if (sleeves === 'long') s.shadePart('rightArm', SLEEVE);
  if (sleeves === 'short') for (const f of s.sides('rightArm')) f.rect(0, 0, f.w, 4, SLEEVE[2]).row(3, SLEEVE[1]);
  if (sleeves === 'short') s.face('rightArm', 'top').fill(SLEEVE[3]);
  if (sleeves === 'long') for (const f of s.sides('rightArm')) f.rect(0, 11, f.w, 1, SK[2]);
  if (sleeves === 'long') s.face('rightArm', 'bottom').fill(SK[1]);
  if (spec.gloves) { const G = R(spec.gloves, 4); for (const f of s.sides('rightArm')) f.rect(0, 9, f.w, 3, G[2]).row(9, G[3]); s.face('rightArm', 'bottom').fill(G[1]); }

  // ── Tops ──
  const bf = s.face('body', 'front'), bb = s.face('body', 'back');
  const X = top.pattern?.color ? hex(top.pattern.color) : TRIM ? TRIM[2] : WHITE;
  const Y = top.pattern?.second ? hex(top.pattern.second) : shade(X, 0.7);
  switch (top.kind) {
    case 'shirt': case 'tunic':
      bf.paint(['..k..k..', '...kk...'], { k: TOP[0] });
      if (top.kind === 'tunic' && spec.belt !== null) s.band('body', 7, R(spec.belt || '#5a3a1e', 3)[1]);
      break;
    case 'armor': {
      // Plate armour: highlights, seams and trim edges (H highlight, L light, M base, D dark, K seam, T/t trim).
      const A = TRIM || R(shade(hex(top.color), 1.35), 4);
      const map = { H: TOP[4], L: TOP[3], M: TOP[2], D: TOP[1], K: TOP[0], T: A[2], t: A[1] };
      bf.paint(['TDLLLLDT', 'DLHHHHLD', 'DLHMMHLD', 'DLMMMMLD', 'DMMMMMMD', 'KDDDDDDK', 'TTTTTTTT', 'DMMMMMMD', 'DLMMMMLD', 'DLMKKMLD', 'DMMKKMMD', 'KDDKKDDK'], map);
      bb.paint(['TDDDDDDT', 'DMLLLLMD', 'DMLMMLMD', 'DMMMMMMD', 'DMMMMMMD', 'KDDDDDDK', 'TTTTTTTT', 'DMMMMMMD', 'DMMMMMMD', 'DMMKKMMD', 'DMMKKMMD', 'KDDKKDDK'], map);
      for (const f of [s.face('body', 'right'), s.face('body', 'left')]) f.paint(['TDDT', 'DLLD', 'DMMD', 'DMMD', 'DMMD', 'KDDK', 'TTTT', 'DMMD', 'DMMD', 'DMMD', 'DMMD', 'KDDK'], map);
      const armRows = ['TTTT', 'LHHL', 'DLLD', 'KDDK', 'MLLM', 'MMMM', 'DMMD', 'KDDK', 'tTTt', 'DMMD', 'DMMD', 'KDDK'];
      for (const f of s.sides('rightArm')) f.paint(slim ? armRows.map(x => x.slice(1)) : armRows, map);
      s.face('rightArm', 'top').fill(TOP[3]); s.face('rightArm', 'bottom').fill(TOP[0]);
      if (spec.gloves) { const G = R(spec.gloves, 4); for (const f of s.sides('rightArm')) f.paint(['....', '....', '....', '....', '....', '....', '....', '....', '....', 'GggG', 'GggG', 'GGGG'], { G: G[1], g: G[2] }); }
      for (const f of s.sides('rightLeg')) f.paint(['DMMD', 'MLLM', 'MMMM', 'DMMD', 'KDDK', 'LHHL', 'DLLD', 'MMMM', 'DMMD', 'tTTt'], map);
      s.face('rightLeg', 'top').fill(TOP[1]);
      break;
    }
    case 'tabard': { // chainmail everywhere, cloth tabard over the body
      const C = R(top.mail || '#8a8f96', 4);
      for (const p of ['rightArm', 'rightLeg']) s.faces(p).forEach(f => f.texture([[C[1], 3], [C[2], 4], [C[3], 2]], seed));
      if (spec.gloves) for (const f of s.sides('rightArm')) f.rect(0, 9, f.w, 3, R(spec.gloves, 4)[2]);
      for (const f of s.sides('rightLeg')) { f.rect(0, 9, f.w, 3, BOOTS[2]); f.row(11, BOOTS[1]); }
      for (const f of [s.face('body', 'right'), s.face('body', 'left')]) f.texture([[C[1], 3], [C[2], 4], [C[3], 2]], seed);
      bf.col(0, C[2]).col(7, C[1]); bb.col(0, C[1]).col(7, C[2]);
      break;
    }
    case 'robe':
      bf.paint(['..kkkk..', '...kk...'], { k: TOP[0] });
      if (TRIM) { bf.col(3, TRIM[2], 2).col(4, TRIM[1], 2); for (const f of s.sides('rightLeg')) f.row(9, TRIM[2]); s.face('rightLeg', 'front').col(3, TRIM[2], 0, 9); }
      if (TRIM && sleeves === 'long') for (const f of s.sides('rightArm')) f.row(10, TRIM[2]);
      s.band('body', 6, R(spec.belt || top.trim || '#6b4a2b', 3)[1]);
      break;
    case 'hoodie': {
      const D = TOP[0];
      bf.paint(['.kk..kk.', '..W..W..', '..W..W..', '..w..w..', '........', '........', '........', '.dddddd.', '.d....d.', '.dddddd.', '........', 'kkkkkkkk'], { k: D, W: shade(WHITE, 0.95), w: shade(WHITE, 0.8), d: TOP[1] });
      if (sleeves === 'long') for (const f of s.sides('rightArm')) f.row(10, TOP[1]);
      bb.paint(['.kkkkkk.', '.k....k.', '..kkkk..'], { k: TOP[1] });
      break;
    }
    case 'jersey': {
      const J = TRIM ? TRIM[2] : TOP[0];
      bf.paint(['kJ....Jk', '.JJ..JJ.'], { k: SK[2], J });
      bf.row(11, J); bb.row(11, J); bb.paint(['kJJJJJJk'], { k: SK[2], J });
      for (const f of [s.face('body', 'right'), s.face('body', 'left')]) f.col(1, J).col(2, J);
      const num = String(top.pattern?.text ?? Math.floor(r() * 99)).slice(0, 2);
      const drawNum = (f, y) => { const w = num.length * 4 - 1, x0 = Math.floor((8 - w) / 2); [...num].forEach((d, i) => f.paint(DIGITS[d].map(row => row.replace(/1/g, 'X').replace(/0/g, '.')), { X }, { x: x0 + i * 4, y })); };
      drawNum(bf, 3); drawNum(bb, 2);
      // shorts + socks
      s.shadePart('rightLeg', SK);
      for (const f of s.sides('rightLeg')) { f.rect(0, 0, f.w, 5, PANTS[2]).row(4, PANTS[1]); f.rect(0, 7, f.w, 3, WHITE).row(7, TRIM ? TRIM[2] : TOP[2]); f.rect(0, 10, f.w, 2, BOOTS[2]).row(11, BOOTS[0]); }
      s.face('rightLeg', 'top').fill(PANTS[2]);
      break;
    }
    case 'sweater': {
      for (const f of [...s.faces('body'), ...(sleeves === 'long' ? s.faces('rightArm') : [])]) f.texture([[TOP[2], 5], [TOP[3], 3], [TOP[1], 2]], seed);
      if (sleeves === 'long') for (const f of s.sides('rightArm')) { f.row(10, TOP[0]); f.row(11, SK[2]); }
      bf.row(0, TOP[0]); bf.row(11, TOP[0]);
      if (SECOND) { s.band('body', 3, SECOND[2]); s.band('body', 5, SECOND[2]); }
      break;
    }
    case 'coat': {
      bf.paint(['.kW..Wk.', '.kkWWkk.', '..k..k..', '...b....', '........', '...b....', '........', '...b....', '........', '........', '........', '........'], { k: TOP[0], W: WHITE, b: TRIM ? TRIM[3] : shade(WHITE, 0.8) });
      bf.col(4, TOP[1], 2);
      for (const f of s.sides('rightLeg')) f.rect(0, 0, f.w, 4, TOP[2]);
      break;
    }
    case 'suit': {
      const SH = R(top.shirt || '#f2f2f2', 3), TIE = R(top.tie || '#b0202a', 3);
      bf.paint(['.kSSSSk.', '..kSTk..', '...STk..', '..kTTk..', '...TT...', '...TT...', '...TT...', '....b...', '........', '....b...', '........', '........'], { k: TOP[0], S: SH[2], T: TIE[1], b: shade(WHITE, 0.7) });
      break;
    }
    case 'overalls': {
      const U = SECOND || R('#3f6fb0');
      bf.rect(0, 5, 8, 7, U[2]).paint(['.U....U.', '.U....U.', '.U....U.', '.U....U.', '.U....U.', 'UUUUUUUU', 'U.uuuu.U', 'U.u..u.U', 'U.uuuu.U', 'UUUUUUUU', 'UUUUUUUU', 'U......U'], { U: U[2], u: U[1] });
      bb.rect(0, 5, 8, 7, U[1]).paint(['..U..U..', '...UU...', '..U..U..', '.U....U.', 'U......U'], { U: U[2] });
      s.shadePart('rightLeg', U);
      for (const f of s.sides('rightLeg')) { f.rect(0, 9, f.w, 3, BOOTS[2]); f.row(11, BOOTS[1]); }
      break;
    }
    case 'dress':
      bf.paint(['.kk..kk.', '..k..k..'], { k: TOP[0] });
      s.band('body', 5, (TRIM || TOP)[3]);
      break;
    case 'vest':
      bf.paint(['kk.SS.kk', 'k..SS..k', '...SS...', '...SS...', '........', '........', '........', '........'], { k: SK[2], S: SECOND ? SECOND[2] : WHITE });
      break;
  }
  if (top.pattern && top.kind !== 'jersey') {
    const P = PATTERNS[top.pattern.kind];
    if (P) { bf.paint(P.rows, { X, Y }, { y: top.pattern.y ?? P.y }); if (top.pattern.back !== false) bb.paint(P.rows, { X, Y }, { y: top.pattern.y ?? P.y }); }
  }
  if (spec.belt && !['robe', 'tunic'].includes(top.kind)) {
    const B = R(spec.belt, 3);
    s.band('body', 10, B[1]); s.band('body', 11, B[0]);
    bf.paint(['...gg...'], { g: R(spec.buckle || '#e2b33c', 3)[2] }, { y: 10 });
  }
  if (spec.scarf) { const C = R(spec.scarf, 3); s.band('body', 0, C[1]); bf.paint(['.CC.....', '.CC.....', '.C......'], { C: C[2] }, { y: 1 }); }

  // Cloth / metal texture over everything below the head (armour glints a bit more)
  if (texture) for (const p of ['body', 'rightArm', 'rightLeg']) s.faces(p).forEach(f => f.noise(armorish ? texture * 1.6 : texture, seed));

  // ── Head ──
  drawFace(s, face, SK, r);
  if (spec.hair) drawHair(s, spec.hair, r);
  if (spec.head && spec.head.kind !== 'none') drawHeadwear(s, spec.head, SK, r, seed);

  // ── Overlay accents by outfit ──
  drawOverlay(s, { top, TOP, TRIM, sleeves, spec, SK, BOOTS, PANTS });

  if (spec.cape) {
    const C = R(spec.cape, 4);
    bb.shaded(C); bb.row(0, C[3]);
    const ob = s.face('body', 'back', 'outer');
    ob.paint(['CCCCCCCC', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C', 'CcCcCcCc'], { C: C[1], c: C[0] });
    for (const f of s.sides('rightLeg')) if (f.face === 'back') f.rect(0, 0, f.w, 7, C[1]);
  }

  s.mirrorLimbs();
  return s;
}

function drawFace(s, face, SK, r) {
  const f = s.face('head', 'front');
  const E = hex(face.eyes), W = face.style === 'glow' ? shade(E, 1.6) : [245, 245, 245, 255];
  const brow = face.brows ? hex(face.brows) : SK[0];
  const rows = {
    normal: ['........', '........', '........', '.bb..bb.', '.WE..EW.', '........', '........', '........'],
    angry: ['........', '........', '........', '.b....b.', '.bE..Eb.', '........', '........', '........'],
    happy: ['........', '........', '........', '.b....b.', '.EE..EE.', '........', '........', '........'],
    closed: ['........', '........', '........', '........', '.bb..bb.', '........', '........', '........'],
    glow: ['........', '........', '........', '........', '.WE..EW.', '........', '........', '........'],
    dot: ['........', '........', '........', '........', '..E..E..', '........', '........', '........'],
    tired: ['........', '........', '........', '.bb..bb.', '.EW..WE.', '.ss..ss.', '........', '........'],
    wide: ['........', '........', '........', '.bb..bb.', '.WW..WW.', '.WE..EW.', '........', '........']
  }[face.style] || [];
  f.paint(rows, { b: brow, E, W, s: SK[1] });
  f.set(3, 5, SK[1]); f.set(4, 5, SK[1]); // nose shadow
  const M = shade(SK[0], 0.75);
  const mouth = { smile: ['..m..m..', '...mm...'], line: ['...mm...'], open: ['...mm...', '...MM...'], grin: ['..mmmm..', '..WWWW..'], none: [] }[face.mouth] || [];
  f.paint(mouth, { m: M, M: [150, 40, 50, 255], W: [240, 240, 235, 255] }, { y: face.mouth === 'smile' ? 6 : 6 });
  if (face.blush) f.paint(['p......p'], { p: mix(SK[3], '#ff7a8a', 0.45) }, { y: 5 });
  if (face.beard) {
    const B = R(face.beard, 3);
    f.paint(['B......B', 'BBB..BBB', 'BBBBBBBB'], { B: B[1] }, { y: 5 });
    f.paint(['..b..b..'], { b: B[0] }, { y: 6 });
    for (const side of ['right', 'left']) s.face('head', side).paint(['........', '........', '........', '........', '........', 'BBB.....', 'BBBB....', 'BBBBBB..'].map(x => side === 'right' ? [...x].reverse().join('') : x), { B: B[1] });
  }
}

function drawHair(s, hair, r) {
  const H = R(hair.color, 5, 0.5);
  const style = hair.style || 'short';
  if (style === 'bald') return;
  const top = s.face('head', 'top'); top.texture([[H[1], 2], [H[2], 4], [H[3], 2]], hair.color);
  const front = s.face('head', 'front');
  const back = s.face('head', 'back');
  const sides = [s.face('head', 'right'), s.face('head', 'left')];
  const len = { short: 2, side: 2, spiky: 2, mohawk: 0, bun: 2, ponytail: 2, curly: 3, long: 7 }[style] ?? 2;
  if (style === 'mohawk') {
    top.fill(s.face('head', 'top').get(0, 0)).col(3, H[3]).col(4, H[2]);
    const hatTop = s.face('head', 'top', 'outer'); hatTop.col(3, H[3]).col(4, H[2]);
    s.face('head', 'front', 'outer').paint(['...HH...'], { H: H[3] });
    s.face('head', 'back', 'outer').paint(['...HH...', '...HH...', '...HH...'], { H: H[2] });
    return;
  }
  front.rect(0, 0, 8, 1, H[2]);
  if (style === 'side') front.paint(['HHHHHHHH', 'HHHHH..H', 'H......H'], { H: H[2] });
  else if (style === 'curly') front.paint(['HhHHhHHh', 'H.hH.hHH', 'h......h'], { H: H[2], h: H[1] });
  else front.paint(['HHHHHHHH', 'H.HH.HHH'], { H: H[2] });
  for (const f of sides) { f.rect(0, 0, 8, Math.min(8, len + 1), H[2]); f.texture([[H[1], 2], [H[2], 3]], hair.color, { only: (x, y) => y < len + 1 }); }
  back.rect(0, 0, 8, Math.min(8, len + 3), H[2]);
  back.texture([[H[1], 2], [H[2], 3], [H[3], 1]], hair.color, { only: (x, y) => y < len + 3 });
  // Overlay volume: front fringe, side tufts, back fall
  const of = s.face('head', 'front', 'outer'), ot = s.face('head', 'top', 'outer'), ob = s.face('head', 'back', 'outer');
  const os = [s.face('head', 'right', 'outer'), s.face('head', 'left', 'outer')];
  of.paint(style === 'spiky' ? ['H.H.H.HH'] : ['HH.HH.HH'], { H: H[3] });
  for (const f of os) f.paint(style === 'long' ? ['HHHHHHHH', 'H.HH.HH.', 'H......H', 'H......H', '.......H'] : ['HHH.HHHH', 'H......H'], { H: H[2] });
  ob.paint(style === 'long' ? ['HHHHHHHH', 'HHHHHHHH', 'H.HHHH.H', 'H.H..H.H', 'H......H', '.H....H.'] : ['HHHHHHHH', 'H.HH.HH.'], { H: H[2] });
  if (style === 'spiky') ot.paint(['H..H..H.', '.H..H..H', '..H..H..', 'H..H..H.', '.H..H..H', '..H..H..', 'H..H..H.', '.H..H..H'], { H: H[3] });
  if (style === 'bun') ot.paint(['........', '...HH...', '..HHHH..', '..HHHH..', '...HH...'], { H: H[3] });
  if (style === 'ponytail') ob.paint(['........', '...HH...', '...HH...', '...HH...', '...HH...', '....H...'], { H: H[1] });
}

function drawHeadwear(s, head, SK, r, seed) {
  const C = R(head.color || '#8a8f96', 5);
  const TR = head.trim ? R(head.trim, 4) : null;
  const hf = s.face('head', 'front'), ht = s.face('head', 'top');
  const sides = [s.face('head', 'right'), s.face('head', 'left'), s.face('head', 'back')];
  const of = s.face('head', 'front', 'outer'), ot = s.face('head', 'top', 'outer'), ob = s.face('head', 'back', 'outer');
  const os = [s.face('head', 'right', 'outer'), s.face('head', 'left', 'outer')];
  const E = head.eyes ? hex(head.eyes) : BLACK;
  switch (head.kind) {
    case 'helmet': // open-faced knight helmet with nose guard
      ht.shaded(C); sides.forEach(f => f.shaded(C));
      hf.paint(['CCCCCCCC', 'CccccccC', 'C..cc..C', 'C..cc..C', 'C..cc..C', 'C......C', 'C......C', 'CC....CC'], { C: C[2], c: C[1] });
      ot.paint(['........', '...TT...', '...TT...', '...TT...', '...TT...', '...TT...', '...TT...', '........'], { T: (TR || C)[3] });
      of.paint(['CCCCCCCC', '...TT...'], { C: C[3], T: (TR || C)[2] });
      os.forEach(f => f.paint(['CCCCCCCC', '........', '........', '........', '........', '........', '........', 'CCCCCCCC'], { C: C[1] }));
      break;
    case 'greathelm': { // closed helm: dark visor band with eyes, centre ridge, breathing holes
      const G = TR || R(shade(C[2], 1.3), 4);
      const map = { H: C[4], L: C[3], M: C[2], D: C[1], K: C[0], T: G[2], E, V: shade(C[0], 0.5) };
      ht.paint(['DDDTTDDD', 'DLLTTLLD', 'DLHTTHLD', 'DLHTTHLD', 'DLLTTLLD', 'DLLTTLLD', 'DMMTTMMD', 'DDDTTDDD'], map);
      hf.paint(['TTTTTTTT', 'LHHTTHHL', 'LMMTTMML', 'VVVVVVVV', 'VEVVVVEV', 'DMMTTMMD', 'DMKMMKMD', 'KDDDDDDK'], map);
      sides.forEach(f => f.paint(['TTTTTTTT', 'DLLLLLLD', 'DMMMMMMD', 'VVVVVVDD', 'DMMMMMMD', 'DMKMKMMD', 'DMMMMMMD', 'KDDDDDDK'], map));
      if (head.cross) hf.paint(['...XX...', '...XX...', '.XXXXXX.', '........', '........', '...XX...', '...XX...', '...XX...'], { X: hex(head.cross) });
      of.paint(['CCCCCCCC', '........', '........', 'C......C', '........', '........', '........', 'CCCCCCCC'], { C: C[3] });
      os.forEach(f => f.paint(['CCCCCCCC', '........', '........', '........', '........', '........', '........', 'CCCCCCCC'], { C: C[1] }));
      ob.paint(['CCCCCCCC', '........', '........', '........', '........', '........', '........', 'CCCCCCCC'], { C: C[1] });
      ot.paint(['...TT...', '...TT...', '...TT...', '...TT...', '...TT...', '...TT...', '...TT...', '...TT...'], { T: G[3] });
      break;
    }
    case 'hood': {
      ht.texture([[C[1], 2], [C[2], 5]], seed); sides.forEach(f => f.texture([[C[1], 2], [C[2], 5]], seed));
      hf.paint(['CCCCCCCC', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C'], { C: C[1] });
      for (let y = 1; y < 8; y++) for (let x = 1; x < 7; x++) { const c = hf.get(x, y); hf.set(x, y, shade(c, y < 4 ? 0.55 : 0.75)); }
      ot.paint(['CCCCCCCC', 'CCCCCCCC', 'CC....CC', 'C......C', 'C......C', 'CC....CC', 'CCCCCCCC', 'CCCCCCCC'], { C: C[2] });
      of.paint(['CCCCCCCC', 'C......C', 'C......C', 'C......C', 'C......C', 'C......C'], { C: C[2] });
      if (TR) of.row(0, TR[2]);
      os.forEach(f => f.paint(['CCCCCCCC', 'CCCCCCCC', 'CCCCCCC.', 'CCCCCC..', 'CCCCCC..', 'CCCCCC..', 'CCCCC...', 'CCCC....'], { C: C[1] }));
      ob.paint(['CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC', '.CCCCCC.', '..CCCC..'], { C: C[1] });
      if (head.mask) hf.paint(['........', '........', '........', '........', '........', '.MMMMMM.', '.MMMMMM.', '.MMMMMM.'], { M: hex(head.mask) });
      break;
    }
    case 'cap':
      ht.fill(C[2]); ot.fill(C[2]); ot.paint(['........', '........', '........', '...ll...', '...ll...'], { l: C[3] });
      of.paint(['CCCCCCCC', 'CCCCCCCC', 'BBBBBBBB'], { C: C[2], B: C[1] });
      os.forEach(f => f.paint(['CCCCCCCC', 'CCCCCCCC'], { C: C[1] }));
      ob.paint(['CCCCCCCC', 'CC....CC', '...ss...'], { C: C[1], s: C[0] });
      if (head.logo) of.paint(['...LL...'], { L: hex(head.logo) }, { y: 0 });
      break;
    case 'beanie':
      ht.fill(C[2]); ot.texture([[C[2], 3], [C[3], 2]], seed);
      of.paint(['CCCCCCCC', 'CcCcCcCc', 'FFFFFFFF'], { C: C[2], c: C[3], F: C[1] });
      os.forEach(f => f.paint(['CCCCCCCC', 'CcCcCcCc', 'FFFFFFFF'], { C: C[2], c: C[3], F: C[1] }));
      ob.paint(['CCCCCCCC', 'CcCcCcCc', 'FFFFFFFF'], { C: C[2], c: C[3], F: C[1] });
      if (head.pom) ot.paint(['........', '........', '........', '...PP...', '...PP...'], { P: hex(head.pom) });
      break;
    case 'crown': {
      const G = TR || R('#e7b53b', 4);
      const gem = hex(head.gem || '#d0203a');
      of.paint(['G.G.G.G.', 'GGGGGGGG', 'GgGRGgGG'], { G: G[2], g: G[3], R: gem });
      os.forEach(f => f.paint(['G.G.G.G.', 'GGGGGGGG'], { G: G[1] }));
      ob.paint(['G.G.G.G.', 'GGGGGGGG'], { G: G[1] });
      break;
    }
    case 'circlet': {
      const G = TR || R('#d9dde3', 4);
      of.paint(['........', 'GGGRGGGG'], { G: G[2], R: hex(head.gem || '#38c6ff') });
      os.forEach(f => f.paint(['........', 'GGGGGGGG'], { G: G[1] }));
      ob.paint(['........', 'GGGGGGGG'], { G: G[1] });
      break;
    }
    case 'wizard':
      ht.fill(C[2]); ot.texture([[C[2], 4], [C[3], 1]], seed);
      ot.paint(['........', '........', '...SS...', '...SS...'], { S: (TR || R('#f2d75b', 4))[3] });
      [of, ...os, ob].forEach(f => f.paint(['CCCCCCCC', 'BBBBBBBB', 'CCCCCCCC'], { C: C[1], B: (TR || C)[2] }));
      break;
    case 'bandana':
      [hf, ...sides].forEach(f => f.paint(['........', 'BBBBBBBB', 'BBBBBBBB'], { B: C[2] }));
      ob.paint(['........', 'BBBBBBBB', '..BBB...', '..B.B...', '..B..B..'], { B: C[1] });
      break;
    case 'headband':
      [hf, ...sides].forEach(f => f.row(2, C[2]));
      of.row(2, C[3]); os.forEach(f => f.row(2, C[2])); ob.paint(['........', '........', 'BBBBBBBB', '...BB...', '...B.B..'], { B: C[2] });
      break;
    case 'mask':
      hf.paint(['........', '........', '........', '........', '........', 'MMMMMMMM', 'MMMMMMMM', 'MMMMMMMM'], { M: C[2] });
      of.paint(['........', '........', '........', '........', '........', 'MMMMMMMM', 'M......M', 'MMMMMMMM'], { M: C[1] });
      break;
    case 'ears': { // bunny / cat / fox ears on top of the head
      const IN = hex(head.inner || '#ffb3c1');
      // Ears read from the front: they stand on the overlay's top edge and the upper front/back rows.
      ot.paint(head.style === 'cat' ? ['CC....CC', 'CC....CC', '........'] : ['.CC..CC.', '.CI..IC.', '.CI..IC.', '.CI..IC.', '.CC..CC.'], { C: C[2], I: IN });
      of.paint(head.style === 'cat' ? ['CC....CC', 'C......C'] : ['.CI..IC.', '.CI..IC.'], { C: C[2], I: IN });
      ob.paint(head.style === 'cat' ? ['CC....CC', 'C......C'] : ['.CC..CC.', '.CC..CC.'], { C: C[1] });
      os.forEach(f => f.paint(['C......C'], { C: C[1] }));
      break;
    }
    case 'strawhat': {
      const S = R(head.color || '#e3c46b', 4);
      ht.texture([[S[1], 2], [S[2], 4], [S[3], 2]], seed); ot.texture([[S[1], 2], [S[2], 4], [S[3], 2]], seed);
      [of, ...os, ob].forEach(f => f.paint(['SsSsSsSs', 'BBBBBBBB', 'sSsSsSsS'], { S: S[2], s: S[1], B: (TR || R('#a0322b', 4))[2] }));
      break;
    }
    case 'nightcap':
      ht.fill(C[2]); ot.fill(C[2]);
      [of, ...os].forEach(f => f.paint(['CCCCCCCC', 'WWWWWWWW'], { C: C[2], W: WHITE }));
      ob.paint(['CCCCCCCC', 'CCCCCCCC', '.CCCCCC.', '..CCCC..', '...CC...', '...WW...'], { C: C[1], W: WHITE });
      break;
    case 'horns': {
      const H = R(head.color || '#e8dcc0', 4);
      ot.paint(['H......H', 'H......H', '........'], { H: H[3] });
      of.paint(['H......H'], { H: H[2] });
      os.forEach(f => f.paint(['....HH..', '...H....'], { H: H[2] }));
      break;
    }
    case 'halo': {
      const H = R(head.color || '#ffe680', 4);
      ot.paint(['.HHHHHH.', 'H......H', 'H......H', 'H......H', 'H......H', 'H......H', 'H......H', '.HHHHHH.'], { H: H[3] });
      break;
    }
  }
}

function drawOverlay(s, { top, TOP, TRIM, sleeves, spec, BOOTS }) {
  const armO = s.face('rightArm', 'front', 'outer');
  const armSides = s.sides('rightArm', 'outer');
  const legSides = s.sides('rightLeg', 'outer');
  const bodyO = s.face('body', 'front', 'outer');
  const bodyB = s.face('body', 'back', 'outer');
  const A = TRIM || TOP;
  switch (top.kind) {
    case 'armor': {
      // Pauldrons (shoulder cap all around), gauntlet cuff, knee guard, boot top — the 3D-accent recipe.
      for (const f of armSides) { f.row(0, TOP[3]); f.row(1, TOP[2]); f.row(2, TOP[1]); f.row(8, A[2]); }
      s.face('rightArm', 'top', 'outer').fill(TOP[3]);
      for (const f of legSides) { f.row(5, TOP[3]); f.row(9, BOOTS[3]); }
      bodyO.paint(['T......T', 'TT....TT', '........', '........', '........', '........', 'BBBBBBBB', '........', '.T....T.', '.T....T.'], { T: TOP[3], B: A[1] });
      bodyB.paint(['T......T', 'TT....TT', '........', '........', '........', '........', 'BBBBBBBB'], { T: TOP[2], B: A[1] });
      break;
    }
    case 'tabard':
      for (const f of armSides) { f.row(0, TOP[2]); f.row(9, (spec.gloves ? R(spec.gloves, 4) : TOP)[3]); }
      bodyO.paint(['.TTTTTT.', '........', '........', '........', '........', '........', 'BBBBBBBB', '........', '........', '........', '........', '.T.TT.T.'], { T: TOP[3], B: R(spec.belt || '#5a3a1e', 3)[1] });
      bodyB.paint(['.TTTTTT.', '........', '........', '........', '........', '........', 'BBBBBBBB'], { T: TOP[2], B: R(spec.belt || '#5a3a1e', 3)[1] });
      for (const f of legSides) f.row(9, BOOTS[3]);
      break;
    case 'robe':
      if (sleeves === 'long') for (const f of armSides) { f.row(9, A[2]); f.row(10, TOP[1]); }
      for (const f of legSides) { f.row(8, TOP[1]); f.row(9, A[2]); }
      bodyO.paint(['T......T', '........', '........', '........', '........', '........', 'BBBBBBBB'], { T: A[3], B: A[1] });
      break;
    case 'hoodie': case 'sweater':
      if (sleeves === 'long') for (const f of armSides) f.row(10, TOP[1]);
      bodyO.row(11, TOP[1]); bodyB.row(11, TOP[1]);
      for (const f of legSides) f.row(10, BOOTS[3]);
      break;
    case 'coat': case 'suit':
      bodyO.paint(['.k....k.', '..k..k..'], { k: TOP[3] });
      for (const f of armSides) f.row(10, TOP[1]);
      for (const f of legSides) if (top.kind === 'coat') f.paint(['CCCC', 'CCCC', 'C..C', '....'], { C: TOP[1] });
      break;
    case 'jersey':
      for (const f of armSides) f.row(9, A[2]);
      for (const f of legSides) f.row(4, TOP[1]);
      break;
    default:
      if (sleeves !== 'none') for (const f of armSides) f.row(sleeves === 'short' ? 3 : 10, TOP[1]);
      for (const f of legSides) f.row(9, BOOTS[3]);
  }
  if (spec.belt) { bodyO.row(10, R(spec.belt, 3)[2]); }
}

export { PATTERNS, DIGITS };
export const palette = { skin: { pale: '#f0c8a4', light: '#e0ac84', tan: '#c69c6d', brown: '#a0704a', dark: '#6b4430', deep: '#4a2e20', zombie: '#6aa05a', orc: '#7a9a4a', ghost: '#cfd8e0', stone: '#8b8b8b' } };
