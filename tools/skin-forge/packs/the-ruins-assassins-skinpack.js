// The Ruins Assassins Skinpack — hooded assassins, one colour each, in the pack's own look:
// monochrome cloth that is bright in the middle of every face and dark at the edges, a hood on the
// overlay that throws the face into shadow, pale skin, a belt and an accent colour (sash, eyes).
// Existing: Shadow (black/white), Void (purple/cyan), Royal (gold), Crimson, Forest, Ocean, Ember —
// all with the same hood, a single diagonal sash, bracers and boot bands.
// The new assassins keep the material language but change hood, face, chest gear, arms and legs.

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Six-step cloth ramp, darkest → brightest (the hand-made assassins use 6 close steps).
const ramp6 = (color, base, lo = 0.42, hi = 1.14) => [0, 1, 2, 3, 4, 5].map(i => color.shade(base, lo + (hi - lo) * i / 5));

// Brightness level of a pixel on a face: bright in the middle and at the top, dark at the edges.
function level(f, x, y, bias = 0) {
  const cx = f.w > 1 ? Math.abs(x - (f.w - 1) / 2) / ((f.w - 1) / 2) : 0;
  if (f.face === 'top') {
    const cz = f.h > 1 ? Math.abs(y - (f.h - 1) / 2) / ((f.h - 1) / 2) : 0;
    return 4.9 + bias - 1.9 * cx ** 1.5 - 1.9 * cz ** 1.5;
  }
  if (f.face === 'bottom') return 1 + bias - cx;
  const cy = f.h > 1 ? y / (f.h - 1) : 0;
  return 4.7 + bias - 2.5 * cx ** 1.5 - 2.1 * cy;
}
const FACE_BIAS = { front: 0, back: -0.5, right: -0.9, left: -0.9, top: 0.2, bottom: 0 };

// Shade a whole face as cloth.
function cloth(color, f, R, seed, bias = 0, only) {
  const r = color.rng(`${seed}:${f.part}:${f.face}:${f.layer}`);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (only && !only(x, y)) continue;
    const l = level(f, x, y, bias + FACE_BIAS[f.face]) + (r() - 0.5) * 0.9;
    f.set(x, y, R[clamp(Math.round(l), 0, R.length - 1)]);
  }
  return f;
}

// Paint an overlay mask: ' ' clears, '.' keeps, 'h' = shaded cloth (rim pixels next to a hole are
// darker, so the hood opening reads as depth), anything else from the map.
function mask(color, f, rows, R, seed, map = {}, bias = 0.2) {
  const r = color.rng(`m${seed}:${f.part}:${f.face}`);
  const at = (x, y) => (rows[y] || '')[x];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    if (ch === ' ') return f.set(x, y, color.T);
    if (ch === 'h') {
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === ' ');
      const l = level(f, x, y, bias + FACE_BIAS[f.face]) + (r() - 0.5) * 0.9 - (rim ? 1.3 : 0);
      return f.set(x, y, R[clamp(Math.round(l), 0, R.length - 1)]);
    }
    if (map[ch] === undefined) throw new Error(`mask: no colour for "${ch}"`);
    f.set(x, y, map[ch]);
  }));
  return f;
}
const flip = rows => rows.map(r => [...r].reverse().join(''));

// Hoods (overlay of the head). Side rows are written for the right face (front edge on the right).
const HOODS = {
  deep: {
    front: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hh    hh', 'h      h', 'h      h', 'h      h', '        '],
    side: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh '],
    back: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh '],
    top: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh']
  },
  peak: { // pointed brim over the brow, edged in trim
    front: ['   tt   ', '  thht  ', ' thhhht ', 'thh  hht', 'hh    hh', 'h      h', '        ', '        '],
    side: ['  hhhhhh', ' hhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhh ', 'hhhhhh  ', ' hhhh   ', '        '],
    back: [' hhhhhh ', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ', '  hhhh  ', '   tt   '],
    top: ['  hhhh  ', ' hhtthh ', 'hhhtthhh', 'hhhtthhh', 'hhhtthhh', 'hhhtthhh', ' hhtthh ', '  hhhh  ']
  },
  ears: { // jackal ears standing on the hood
    front: ['EE    EE', 'eEhhhhEe', 'hhhhhhhh', 'hh    hh', 'h      h', 'h      h', '        ', '        '],
    side: ['     EEe', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhh ', 'hhhhhh  ', 'hhhhh   ', ' hhhh   '],
    back: ['EE    EE', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ', '  hhhh  '],
    top: ['        ', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'EhhhhhhE', 'EhhhhhhE', 'EEhhhhEE']
  },
  fur: { // white fur rim around the opening
    front: ['fFfFfFfF', 'FfFffFfF', 'Ff    fF', 'f      f', 'h      h', 'h      h', 'f      f', '        '],
    side: ['FfFfFfFf', 'fFfFfFfF', 'hhhhhhfF', 'hhhhhhhf', 'hhhhhhh ', 'hhhhhhh ', 'hhhhhhf ', ' hhhhh  '],
    back: ['FfFfFfFf', 'fFfFfFfF', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ', '  hhhh  '],
    top: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'fFfFfFfF', 'FfFfFfFf']
  },
  cowl: { // hood with a face wrap pulled up over nose and mouth
    front: ['hhhhhhhh', 'hhhhhhhh', 'hh    hh', 'h      h', 'h      h', 'wwwwwwww', 'wWwwwwWw', 'wwwwwwww'],
    side: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhwww', 'hhhhwwWw', ' hhhwwww'],
    back: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'wwwwwwww', 'wwwwwwww', ' WW  WW '],
    top: [' hhhhhh ', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ']
  },
  horns: { // two bone horns breaking through the hood
    front: ['HH    HH', 'hHhhhhHh', 'hhhhhhhh', 'hhh  hhh', 'hh    hh', ' h    h ', '        ', '        '],
    side: ['  HHHHHH', ' HHhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ', '        ', '        '],
    back: ['        ', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ', '  hhhh  ', '   hh   '],
    top: ['  hhhh  ', ' hhhhhh ', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'HhhhhhhH', 'HhhhhhhH', 'HHhhhhHH']
  },
  circlet: { // hood with a metal band and a gem over the brow
    front: ['hhhhhhhh', 'hhhhhhhh', 'cccGGccc', 'hh    hh', 'h      h', 'h      h', '        ', '        '],
    side: ['hhhhhhhh', 'hhhhhhhh', 'cccccccc', 'hhhhhhhh', 'hhhhhhh ', 'hhhhhh  ', ' hhhh   ', '        '],
    back: ['hhhhhhhh', 'hhhhhhhh', 'cccccccc', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ', '  hhhh  '],
    top: [' hhhhhh ', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ']
  },
  beak: { // hawk hood: a bronze beak comes down between the eyes
    front: ['hhhhhhhh', 'hhhhhhhh', 'hhhbbhhh', 'hh bb hh', 'h  bB  h', 'h   b  h', '        ', '        '],
    side: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhh ', 'hhhhhh  ', 'hhhhh   ', ' hhh    '],
    back: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', ' hhhhhh ', ' bhhhhb ', '  b  b  '],
    top: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhbbhhh', 'hhhbbhhh', 'hhhbbhhh', 'hhhbbhhh', 'hhhbbhhh']
  }
};

// Faces (inner head front). D hood shadow, a–e skin dark→light, E eye, K black.
const FACES = {
  open: ['hhhhhhhh', 'hhhhhhhh', 'DaaaaaaD', 'DabbbbaD', 'DaEccEaD', 'DbcddcbD', 'DbccccbD', 'DDhhhhDD'],
  wrap: ['hhhhhhhh', 'hhhhhhhh', 'DaaaaaaD', 'DabbbbaD', 'DaEccEaD', 'DwwwwwwD', 'DwWwwWwD', 'DDwwwwDD'],
  veil: ['hhhhhhhh', 'hhhhhhhh', 'DaaaaaaD', 'DabbbbaD', 'DaEccEaD', 'DvvvvvvD', 'DvvvvvvD', 'DDVVVVDD'],
  mask: ['hhhhhhhh', 'hhhhhhhh', 'DmmmmmmD', 'DMmmmmMD', 'DKEmmEKD', 'DmmMMmmD', 'DmMmmMmD', 'DDmmmmDD'],
  paint: ['hhhhhhhh', 'hhhhhhhh', 'DaaaaaaD', 'DabbbbaD', 'DPEPPEPD', 'DbcddcbD', 'DbcPPcbD', 'DDhPPhDD'],
  scar: ['hhhhhhhh', 'hhhhhhhh', 'DaaaaSaD', 'DabbbSaD', 'DaEccSaD', 'DbcddSbD', 'DbccccbD', 'DDhhhhDD']
};

// Chest gear (body front, 8×12). '.' keeps the cloth.
const CHEST = {
  cross: { // two leather straps crossed over the chest, buckle in the middle
    inner: ['S......S', 'sS....Ss', '.sS..Ss.', '..sBBs..', '..SBBS..', '.Ss..sS.', '........', '........'],
    outer: ['S      S', ' S    S ', '        ', '   BB   ', '   BB   ', '        ', '        ', '        '],
    back: ['S......S', '.S....S.', '..S..S..', '...SS...', '...SS...', '..S..S..']
  },
  collar: { // broad golden collar set with blue stones, straps down to the belt
    inner: ['AaAaaAaA', 'AQAAAAQA', '.AAQQAA.', '.S.AA.S.', '.S....S.', '.S....S.', '.S....S.', '........'],
    outer: ['AaAaaAaA', ' Q    Q ', '   QQ   ', '        ', '        ', '        ', '        ', '        '],
    back: ['AaAaaAaA', '.AAAAAA.']
  },
  scarf: { // thick fur scarf, one end hanging over the chest
    inner: ['FfFfFfFf', 'fFfFfFfF', '.fF.....', '.Ff.....', '.fF.....', '.Ff.....', '.ff.....', '........'],
    outer: ['FfFfFfFf', 'fFfFfFfF', ' fF     ', ' Ff     ', ' fF     ', ' Ff     ', ' ff     ', ' f f    '],
    back: ['FfFfFfFf', 'fFfFfFfF']
  },
  robe: { // long open coat with pale trim, closed by a sash knot
    inner: ['.T.SS.T.', '..TSST..', '..TSST..', '..TSST..', '..TSST..', '..TSST..', 'AAAKKAAA', 'AAAKKAAA', '..TSST..', '..TSST..', '..TSST..', '..TSST..'],
    outer: [' T    T ', '  T  T  ', '        ', '        ', '        ', '        ', '   KK   ', '   KK   ', '   AA   ', '   A A  ', '        ', '        '],
    back: ['.TTTTTT.']
  },
  aurora: { // a sash from the right shoulder to the left hip that shifts colour like the northern lights
    inner: ['.....123', '....123.', '...123..', '..123...', '.123....', '123.....', '23......', '3.......'],
    outer: ['      1 ', '        ', '        ', '  1     ', '        ', '        ', '        ', '        '],
    back: ['123.....', '.123....', '..123...', '...123..', '....123.', '.....123']
  },
  bandolier: { // leather bandolier with three glowing poison vials
    inner: ['SS......', '.SS.....', '.VSS....', '.VVSS...', '...VSS..', '...VVSS.', '.....VSS', '.....VVS'],
    outer: ['        ', '        ', ' V      ', ' v      ', '    V   ', '    v   ', '      V ', '      v '],
    back: ['......SS', '.....SS.', '....SS..', '...SS...', '..SS....', '.SS.....']
  },
  feathers: { // layered hawk feathers over the shoulders and a chevron down the chest
    inner: ['FfFffFfF', 'f.FffF.f', '...FF...', 'F......F', '.F....F.', '..F..F..', '...FF...', '........'],
    outer: ['FfFffFfF', 'f F  F f', '        ', '        ', '        ', '        ', '        ', '        '],
    back: ['FfFffFfF', 'f.F..F.f', '.f....f.']
  },
  emblem: { // symbol on the chest (rows given per skin), metal collar clasps
    inner: ['cc....cc'],
    outer: ['c      c'],
    back: []
  }
};

// The builder. o: { cloth, accent, trim, skin, hood, face, chest, emblem, arms, legs, belt, seed, wrap, fur, … }
function assassin({ Skin, color }, o) {
  const { shade, mix, hex, T } = color;
  const seed = o.seed || 1;
  const s = new Skin();
  const C = ramp6(color, o.cloth, o.lo, o.hi);
  const A = ramp6(color, o.accent, 0.5, 1.1);
  const TR = ramp6(color, o.trim || '#b9a98c', 0.5, 1.15);
  const LE = ramp6(color, o.leather || mix(hex(o.cloth), '#2a2018', 0.55), 0.5, 1.1);
  const BO = ramp6(color, o.boot || mix(hex(o.cloth), '#2c2622', 0.5), 0.45, 1.05);
  const SKB = hex(o.skin || '#ab917a');
  const SK = [0.7, 0.8, 0.9, 1.0, 1.1].map(f => shade(SKB, f));
  const W = ramp6(color, o.wrap || '#cbbd9e', 0.6, 1.1);
  const VL = ramp6(color, o.veil || o.accent, 0.5, 1.1);
  const FU = ramp6(color, o.fur || '#e8eef2', 0.75, 1.1);
  const eye = hex(o.eyes || o.accent);
  const side = p => s.sides(p);

  // ── Inner: cloth everywhere ──
  for (const p of ['head', 'body', 'rightArm', 'rightLeg']) for (const f of s.faces(p)) cloth(color, f, C, seed);

  // Face
  const fmap = { D: C[0], a: SK[0], b: SK[1], c: SK[2], d: SK[3], e: SK[4], E: eye, K: [12, 10, 12, 255],
    w: W[3], W: W[1], v: VL[3], V: VL[1], m: TR[3], M: TR[1], P: A[3], S: mix(SK[2], '#c05a5a', 0.55) };
  const hf = s.face('head', 'front');
  const rows = FACES[o.face || 'open'];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== 'h') hf.set(x, y, fmap[ch]); }));

  // Belt
  const belt = o.belt ?? 7;
  if (belt !== null) {
    s.band('body', belt, LE[1]); s.band('body', belt + 1, LE[0]);
    s.face('body', 'front').paint(['...BB...'], { B: TR[4] }, { y: belt });
    s.face('body', 'front').paint(['...bb...'], { b: TR[2] }, { y: belt + 1 });
  }

  // Chest gear
  const bf = s.face('body', 'front'), bb = s.face('body', 'back');
  const bo = s.face('body', 'front', 'outer'), bbo = s.face('body', 'back', 'outer');
  const auroraCols = o.aurora || [A[4], A[5], A[3]];
  const cmap = { S: LE[2], s: LE[1], B: TR[4], A: TR[4], a: TR[2], Q: hex(o.stone || '#2f6fe0'), X: [214, 220, 228, 255], F: FU[4], f: FU[2], T: TR[4], K: A[1],
    1: auroraCols[0], 2: auroraCols[1], 3: auroraCols[2], V: A[5], v: A[3], c: TR[3] };
  const chest = CHEST[o.chest];
  if (chest) {
    bf.paint(chest.inner, cmap);
    mask(color, bo, chest.outer.map(r => r.replace(/ /g, '.')), C, seed, cmap);
    if (chest.back.length) bb.paint(chest.back, cmap);
    if (o.chest === 'robe') for (const f of [bb, s.face('body', 'right'), s.face('body', 'left')]) f.paint(['AAAA', 'AAAA'], { A: A[2] }, { y: 6 });
  }
  if (o.emblem) bf.paint(o.emblem, { X: A[5], Y: A[3], Z: A[1], G: TR[4], g: TR[2], W: [235, 235, 230, 255] }, { y: o.emblemY ?? 1 });

  // Arms (right arm; mirrored at the end)
  const ao = s.sides('rightArm', 'outer');
  switch (o.arms) {
    case 'wraps': // bandaged forearms
      for (const f of side('rightArm')) for (let y = 5; y < 11; y++) for (let x = 0; x < f.w; x++) f.set(x, y, x === 0 || x === f.w - 1 ? W[2] : y % 2 ? W[3] : W[4]);
      for (const f of side('rightArm')) f.row(11, SK[1]);
      s.face('rightArm', 'bottom').fill(SK[0]);
      for (const f of ao) f.row(4, C[2]);
      break;
    case 'gauntlet': // metal gauntlets, shaded like the cloth, with a cuff on the overlay
      for (const f of side('rightArm')) { cloth(color, f, TR, seed, -1.2, (x, y) => y >= 8); f.row(8, TR[4]); f.row(11, TR[0]); }
      s.face('rightArm', 'bottom').fill(TR[1]);
      s.face('rightArm', 'front', 'outer').row(8, TR[3]);
      break;
    case 'blade': // dark gloves, a hidden blade along the wrist
      for (const f of side('rightArm')) { f.rect(0, 8, f.w, 4, LE[1]); f.row(8, LE[2]); }
      s.face('rightArm', 'front').paint(['.XX.', '.Xx.', '.Xx.', '.xx.'], { X: [225, 230, 236, 255], x: [150, 156, 166, 255] }, { y: 8 });
      s.face('rightArm', 'bottom').fill(LE[0]);
      for (const f of ao) f.row(7, C[3]);
      s.face('rightArm', 'front', 'outer').paint(['.X..', '.X..', '.x..'], { X: [235, 240, 245, 255], x: [170, 176, 186, 255] }, { y: 9 });
      break;
    case 'pauldron': { // fur or metal shoulder guard, gloves
      const P = o.pauldron === 'fur' ? FU : TR;
      for (const f of ao) { f.row(0, P[4]); f.row(1, P[3]); f.row(2, P[1]); }
      s.face('rightArm', 'top', 'outer').fill(P[4]);
      for (const f of side('rightArm')) { f.rect(0, 9, f.w, 3, LE[1]); f.row(9, LE[2]); }
      s.face('rightArm', 'bottom').fill(LE[0]);
      break;
    }
    case 'claws': // dark gloves ending in three bone claws
      for (const f of side('rightArm')) { f.rect(0, 8, f.w, 4, LE[1]); f.row(8, LE[3]); }
      s.face('rightArm', 'bottom').fill(LE[0]);
      for (const f of ao) f.row(8, LE[3]);
      s.face('rightArm', 'front', 'outer').paint(['X.X.', 'x.x.'], { X: TR[5], x: TR[3] }, { y: 10 });
      break;
  }

  // Legs (right leg; mirrored at the end)
  const lo = s.sides('rightLeg', 'outer');
  const boots = (from, cuff) => {
    for (const f of side('rightLeg')) { f.rect(0, from, f.w, 12 - from, BO[2]); f.row(from, BO[3]); f.row(11, BO[0]); f.col(0, BO[1], from, 11); }
    s.face('rightLeg', 'bottom').fill(BO[0]);
    if (cuff) for (const f of lo) f.row(from, BO[4]);
  };
  switch (o.legs) {
    case 'wraps': // bandaged shins tied off with a leather band, soft shoes
      for (const f of side('rightLeg')) { for (let y = 4; y < 10; y++) for (let x = 0; x < f.w; x++) f.set(x, y, x === 0 || x === f.w - 1 ? W[2] : y % 2 ? W[3] : W[4]); f.row(4, LE[2]); }
      boots(10, false);
      break;
    case 'boots': // tall boots with a folded cuff
      boots(7, true);
      break;
    case 'kneepad': // metal knee guards
      boots(9, false);
      s.face('rightLeg', 'front').paint(['.MM.', 'MmmM', '.MM.'], { M: TR[2], m: TR[4] }, { y: 4 });
      s.face('rightLeg', 'front', 'outer').paint(['.MM.', 'MmmM'], { M: TR[2], m: TR[4] }, { y: 4 });
      break;
    case 'greaves': // plate on the shin
      boots(10, false);
      s.face('rightLeg', 'front').paint(['MMMM', 'MmmM', 'MmmM', 'MmmM', 'MmmM', 'MMMM'], { M: TR[2], m: TR[4] }, { y: 5 });
      s.face('rightLeg', 'front', 'outer').paint(['MMMM'], { M: TR[3] }, { y: 5 });
      break;
    case 'tails': // long coat tails over the legs
      boots(9, false);
      for (const f of lo) mask(color, f, ['hhhh', 'hhhh', 'hhhh', 'hhhh', 'hhhh', 'h hh', 'TTTT'].map(r => r), C, seed, { T: TR[4] });
      break;
  }

  // Hood overlay
  const H = HOODS[o.hood];
  const hmap = { t: TR[4], E: TR[4], e: TR[2], f: FU[3], F: FU[5], w: W[3], W: A[3], H: hex(o.horn || '#e9e1cc'), c: TR[3], G: A[5], b: TR[4], B: TR[5] };
  mask(color, s.face('head', 'front', 'outer'), H.front, C, seed, hmap);
  mask(color, s.face('head', 'right', 'outer'), H.side, C, seed, hmap);
  mask(color, s.face('head', 'left', 'outer'), flip(H.side), C, seed, hmap);
  mask(color, s.face('head', 'back', 'outer'), H.back, C, seed, hmap);
  mask(color, s.face('head', 'top', 'outer'), H.top, C, seed, hmap);

  if (o.finish) o.finish(s, { C, A, TR, LE, BO, SK, W, FU, color });
  s.mirrorLimbs();
  return s;
}

// ── Updates ───────────────────────────────────────────────────────────────────────────────────

export default {
  style: 'accent',
  updates: [
    {
      title: 'Sands of the Fallen City',
      note: 'Beyond the ruins lies a city buried in sand, and three assassins have walked out of it: a wanderer of the storm, a keeper of the scarab and a hunter in a jackal hood.',
      skins: [
        {
          name: 'Sandstorm Assassin', story: 'He crosses the dunes with his face wrapped against the wind, and when the sandstorm clears, his target is already gone.',
          build: kit => assassin(kit, { seed: 301, cloth: '#b48e58', accent: '#2fc4b4', wrap: '#e3d4b0', skin: '#9c7a5c', leather: '#5a3a22', hood: 'cowl', face: 'wrap', chest: 'cross', arms: 'wraps', legs: 'wraps', belt: 7 })
        },
        {
          name: 'Scarab Assassin', story: 'Sworn to the golden scarab of the sunken temple, she guards its last chamber from every thief who digs too deep.',
          build: kit => assassin(kit, { seed: 302, cloth: '#14625e', accent: '#e8b630', trim: '#d9a62a', hood: 'peak', face: 'paint', chest: 'emblem', arms: 'gauntlet', legs: 'kneepad', belt: 8,
            emblem: ['.X....X.', '..XGGX..', 'X.GggG.X', '.XGggGX.', '..GGGG..', '.X.GG.X.'] })
        },
        {
          name: 'Jackal Assassin', story: 'Behind the golden jackal mask is a hunter who has never once lost a trail in the shifting sand.',
          build: kit => assassin(kit, { seed: 303, cloth: '#3a332c', accent: '#ffb020', eyes: '#ffb020', trim: '#e2b33c', hood: 'ears', face: 'mask', chest: 'collar', arms: 'blade', legs: 'boots', belt: 7 })
        }
      ]
    },
    {
      title: 'Winter in the Ruins',
      note: 'Snow has fallen on the broken towers, and the order sent three of its coldest blades: a frost hunter, a rose in winter and an assassin who walks under the northern lights.',
      skins: [
        {
          name: 'Frost Assassin', story: 'Wrapped in white fur, she waits in the snow so still that the frost grows over her before she strikes.',
          build: kit => assassin(kit, { seed: 311, cloth: '#c9d8e4', lo: 0.55, hi: 1.12, accent: '#4fc8ff', eyes: '#4fc8ff', fur: '#f4f7fa', trim: '#9fb7c9', hood: 'fur', face: 'open', chest: 'scarf', arms: 'pauldron', pauldron: 'fur', legs: 'greaves', belt: 7 })
        },
        {
          name: 'Winter Rose Assassin', story: 'She leaves a single frozen rose beside every sleeping guard, so the order knows she was there.',
          build: kit => assassin(kit, { seed: 312, cloth: '#b03a6c', accent: '#ffd0e0', trim: '#f1e6ec', veil: '#e8d8e0', hood: 'deep', face: 'veil', chest: 'robe', arms: 'wraps', wrap: '#f1e6ec', legs: 'tails', belt: null })
        },
        {
          name: 'Aurora Assassin', story: 'He only hunts on nights when the northern lights burn green over the ruins, and his sash glows in the same colours.',
          build: kit => assassin(kit, { seed: 313, cloth: '#1f2c44', accent: '#3cf0b0', eyes: '#3cf0b0', trim: '#aab4c4', hood: 'circlet', face: 'open', chest: 'aurora', aurora: ['#3cf0b0', '#38c6ff', '#b07cff'], arms: 'claws', legs: 'boots', belt: 8 })
        }
      ]
    },
    {
      title: 'Masters of the Ruins',
      note: 'Only three assassins ever earned the title of master: one who walks under the blood moon, one who brews poison in the ruins and one who hunts from the sky.',
      skins: [
        {
          name: 'Blood Moon Master', story: 'Horned and scarred, he leads the order on the night of the red moon, when no lantern in the ruins stays lit.',
          build: kit => assassin(kit, { seed: 321, cloth: '#2a2224', accent: '#e0283c', eyes: '#ff3a3a', trim: '#5e5650', hood: 'horns', face: 'scar', chest: 'emblem', arms: 'pauldron', legs: 'boots', boot: '#3a2a2c', belt: 8,
            emblem: ['..ZZXX..', '.ZZZZXX.', '.ZZZZZX.', '.ZZZZZX.', '.ZZZZXX.', '..ZZXX..'] })
        },
        {
          name: 'Venom Master', story: 'Every vial on his bandolier was brewed from a plant that grows only in the darkest cellar of the ruins.',
          build: kit => assassin(kit, { seed: 322, cloth: '#3c2a48', accent: '#9cff2a', eyes: '#9cff2a', hood: 'peak', trim: '#7a9a3a', veil: '#2a2030', face: 'veil', chest: 'bandolier', arms: 'blade', legs: 'wraps', wrap: '#7a6a82', belt: 9 })
        },
        {
          name: 'Hawk Master', story: 'He watches the ruins from the highest broken tower, and his copper hood is the last thing his prey ever sees.',
          build: kit => assassin(kit, { seed: 323, cloth: '#8e4a26', accent: '#ffc070', eyes: '#ffd27a', trim: '#e0a050', fur: '#f0e2c8', hood: 'beak', face: 'open', chest: 'feathers', arms: 'gauntlet', legs: 'kneepad', belt: 8 })
        }
      ]
    }
  ]
};
