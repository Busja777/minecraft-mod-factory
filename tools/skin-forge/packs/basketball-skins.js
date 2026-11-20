// Basketball skins — classic shaded ballers. Existing: Court Rookie (cream/purple #23, full beard, white arm
// sleeve), Purple Hoops Star (gold/purple #24, purple arm sleeve), Blacktop Legend (black/gold, emblem, beard).
// The pack's look: brown skin with edge-darkening and light noise, flat inner hair, a tank-top jersey with a
// V-neck in trim colour, 3×5 block numbers, long shorts to the knee, white socks and chunky sneakers, one
// arm sleeve. The overlay is sparse (number, shoes, hair volume), 76–96 % transparent → style 'accent'.
// New players keep the material language and change hair, face, jersey cut, numbers, arms and legs.
// All teams and nicknames are made up.

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const DIGITS = {
  0: ['111', '101', '101', '101', '111'], 1: ['110', '010', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111']
};
const numberRows = num => [0, 1, 2, 3, 4].map(y => [...String(num)].map(d => DIGITS[d][y].replace(/1/g, 'X').replace(/0/g, '.')).join('.'));
const flip = rows => rows.map(r => [...r].reverse().join(''));

// Faces get a little darker towards the back and the sides, like the hand-made skins.
const FACEF = { front: 1, back: 0.9, right: 0.93, left: 0.93, top: 1.04, bottom: 0.78 };

// Hair: inner rows (I) and overlay rows (O). Side rows are written for the right face (front edge = last column).
const HAIR = {
  buzz: {
    I: { front: ['HHHHHHHH'], side: ['HHHHHHHH', 'HHHHHHH.', 'HHHHHH..', 'HHHH....'], back: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '.HHHHHH.'] },
    O: {}
  },
  hightop: { // flat-top fade: tall block on top, faded sides
    I: { front: ['HHHHHHHH', 'HHHHHHHH'], side: ['HHHHHHHH', 'HHHHHHHH', 'ffffffff', 'ffffff..', 'ffff....'], back: ['HHHHHHHH', 'HHHHHHHH', 'ffffffff', 'ffffffff', '.ffffff.'] },
    O: { top: Array(8).fill('HHHHHHHH'), front: ['HHHHHHHH', 'H......H'], side: ['HHHHHHHH'], back: ['HHHHHHHH'] }
  },
  twists: { // short twists standing up
    I: { front: ['HHHHHHHH', 'H.HH.HH.'], side: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHH..', 'HHHH....'], back: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '.HHHHHH.'] },
    O: { top: ['H.H.H.H.', '.h.h.h.h', 'H.H.H.H.', '.h.h.h.h', 'H.H.H.H.', '.h.h.h.h', 'H.H.H.H.', '.h.h.h.h'], front: ['HH.HH.HH'], side: ['H.HH.HH.'], back: ['HH.HH.HH'] }
  },
  afro: { // big round afro
    I: { front: ['HHHHHHHH', 'HH....HH'], side: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHH.HH', 'HHHHH.H.', 'HHHHH...'], back: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '.HHHHHH.'] },
    O: { top: Array(8).fill('HHHHHHHH'), front: ['HHHHHHHH', 'HH....HH'], side: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHH.', 'HHHHHH..', 'HHH.H...'], back: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '.HHHHHH.', '..H..H..'] }
  },
  cornrows: { // tight braids running front to back, short tails at the neck
    I: { top: ['HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh'], front: ['HhHhHhHh', 'H.h.H.h.'], side: ['HHHHHHHH', 'hhhhhhhh', 'HHHHHHH.', 'hhhhh...'], back: ['HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh', 'HhHhHhHh', '.h.h.h.h'] },
    O: { back: ['        ', '        ', '        ', '        ', '        ', 'H.H..H.H', 'H.H..H.H', 'h.h..h.h'] }
  },
  locs: { // long locs with coloured tips (t)
    I: { front: ['HHHHHHHH', 'H......H'], side: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHH.', 'HHHHHH..', 'HHHHHH..', 'HHHHHH..', 'HHHHHH..', 'HHHHHH..'], back: Array(8).fill('HHHHHHHH') },
    O: { top: ['HHHHHHHH', 'H.H.H.H.', 'HHHHHHHH', '.H.H.H.H', 'HHHHHHHH', 'H.H.H.H.', 'HHHHHHHH', 'HHHHHHHH'],
      front: ['HHHHHHHH', 'Hh....hH', 'H......H', 'H......H', 'h......h'],
      side: ['HHHHHHHH', 'HHHHHHHH', 'HhHHhHHH', 'HhHHhHH.', 'HhHhhH..', 'H.HhtH..', 't.t.....', '........'],
      back: ['HHHHHHHH', 'HHHHHHHH', 'HhHHhHHh', 'HhHhHhHh', 'HhHhHhHh', 'H.HhH.Hh', 't.Ht.tH.', '..t...t.'] }
  },
  ponytail: { // high ponytail tied with a band (t)
    I: { front: ['HHHHHHHH', 'HHHHH.HH'], side: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHH.', 'HHHHHH..', 'HHHH....'], back: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '.HHHHHH.'] },
    O: { top: ['..tttt..', '..HHHH..'], front: ['HHHHHHH.'], side: ['HHHHHHHH'], back: ['..tttt..', '..HHHH..', '...HH...', '..HHhH..', '...HH...', '...hH...', '...Hh...', '....H...'] }
  },
  messy: { // untidy short hair, strands sticking out
    I: { front: ['HHHHHHHH', 'HH.HHH.H'], side: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHH..', 'HHHH....'], back: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'H.HHHH.H'] },
    O: { top: ['H..H..H.', '.H..H..H', '..H..H..', 'H..H..H.', '.H..H..H', '..H..H..', 'H..H..H.', '.HH..HH.'], front: ['H.HH.H.H'], side: ['HH.HH.H.'], back: ['HHHHHHHH', 'H.H..H.H'] }
  },
  bald: { I: {}, O: {} }
};

// The builder. o: { seed, slim, skin, eyes, brows, mouth, beard, freckles, hair: { style, color, tip },
//   jersey: { color, trim, second, number, numColor, numY, neck, pattern, colors, back },
//   shorts: { color, trim, len, stripe, logo }, socks: { color, stripes, top }, shoes: { color, sole, accent, high },
//   headband, wristbands, sleeve: { side, color, stripe }, goggles, kneepads, chain, finish }
function baller({ Skin, color }, o) {
  const { hex, shade, mix, rng, T } = color;
  const seed = o.seed || 1;
  const s = new Skin({ slim: !!o.slim });
  const side = p => s.sides(p);

  const shaded = (f, colAt, only) => {
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      if (only && !only(x, y)) continue;
      const e = (x === 0 || x === f.w - 1) + (y === 0 || y === f.h - 1);
      let k = [1, 0.87, 0.76][e];
      if (f.face !== 'top' && f.face !== 'bottom' && y === 0 && e === 1) k = 1;
      f.set(x, y, shade(colAt(x, y), k * FACEF[f.face]));
    }
    return f;
  };
  const C = c => hex(c);
  const SKc = C(o.skin);
  const SKd = shade(SKc, 0.78);
  const jer = { neck: 'v', numY: 3, ...o.jersey };
  const Jc = C(jer.color), JT = C(jer.trim), J2 = C(jer.second || jer.trim);
  const NUM = C(jer.numColor || jer.trim);
  const sh = { len: 7, ...o.shorts };
  const SHc = C(sh.color || jer.color), SHT = C(sh.trim || jer.trim);
  const so = { color: '#f2f2f2', top: 9, ...o.socks };
  const SOc = C(so.color);
  const shoe = { color: '#f2f2f2', sole: '#fbfbfb', ...o.shoes };
  const SNc = C(shoe.color), SOLE = C(shoe.sole), SNA = C(shoe.accent || shoe.color);
  const shoeTop = shoe.high ? 9 : 10;

  // ── Inner base ──
  for (const p of ['head', 'rightArm']) for (const f of s.faces(p)) shaded(f, () => SKc);

  // Jersey colour per pixel (body)
  const jerseyAt = (f) => (x, y) => {
    let c = Jc;
    if (jer.pattern === 'gradient') { const cs = jer.colors.map(C); const t = y / 11 * (cs.length - 1); const i = Math.min(cs.length - 2, Math.floor(t)); c = mix(cs[i], cs[i + 1], t - i); }
    if (jer.pattern === 'pinstripe' && (f.face === 'front' || f.face === 'back') && x % 2 === 1) c = mix(Jc, J2, 0.55);
    if (jer.pattern === 'mesh' && (x + y) % 2 === 0) c = shade(Jc, 0.93);
    if (jer.pattern === 'split' && (f.face === 'front' || f.face === 'back') && x >= 4) c = J2;
    if ((f.face === 'right' || f.face === 'left') && (x === 1 || x === 2) && jer.pattern !== 'mesh') c = J2;
    return c;
  };
  for (const f of s.faces('body')) shaded(f, f.face === 'bottom' ? () => SHc : jerseyAt(f));

  // Legs: shorts, skin, socks, shoes
  const legAt = (x, y) => y < sh.len ? SHc : y < so.top ? SKc : y < shoeTop ? SOc : SNc;
  for (const f of side('rightLeg')) shaded(f, legAt);
  s.face('rightLeg', 'top').fill(shade(SHc, 1.03));
  s.face('rightLeg', 'bottom').fill(shade(SOLE, 0.8));

  for (const p of ['head', 'body', 'rightArm', 'rightLeg']) for (const f of s.faces(p)) f.noise(p === 'head' ? 0.05 : 0.035, seed);

  // ── Jersey details ──
  const bf = s.face('body', 'front'), bb = s.face('body', 'back');
  const neck = jer.neck === 'round' ? ['JTSSSSTJ', 'JJTTTTJJ'] : ['JTSSSSTJ', 'JJTSSTJJ', 'JJJTTJJJ'];
  bf.paint(neck.map(r => r.replace(/J/g, '.')), { T: JT, S: SKd });
  bb.paint(['.TSSSST.', '..TTTT..'], { T: JT, S: SKd });
  for (const f of [s.face('body', 'right'), s.face('body', 'left')]) f.paint(['TTTT'], { T: JT });
  s.face('body', 'top').paint(['TTTTTTTT', '..SSSS..', '..SSSS..', 'TTTTTTTT'].map(r => r.replace(/\./g, '.')), { T: JT, S: SKd });
  bf.row(10, shade(jerseyAt(bf)(3, 10), 0.72)); bb.row(10, shade(jerseyAt(bb)(3, 10), 0.68));
  s.band('body', 11, SHT);
  bf.paint(['...dd...'], { d: shade(SHT, 0.7) }, { y: 11 }); // drawstring

  const nrows = numberRows(jer.number);
  const nx = Math.round((8 - nrows[0].length) / 2);
  const drawNum = (f, y, c) => f.paint(nrows, { X: c }, { x: nx, y });
  drawNum(bf, jer.numY, shade(NUM, 0.62)); drawNum(bb, 4, shade(NUM, 0.6));
  bb.paint([jer.back || '.XX.XXX.'], { X: shade(NUM, 0.85) }, { y: 2 });
  if (jer.emblem) bf.paint(jer.emblem, { X: NUM, Y: JT, Z: J2 }, { y: jer.emblemY ?? 2 });

  // Shorts: hem, stripe on the outer side, logo
  for (const f of side('rightLeg')) f.row(sh.len - 1, shade(SHc, 0.7));
  if (sh.stripe !== false) s.face('rightLeg', 'right').col(1, SHT, 0, sh.len - 2).col(2, shade(SHT, 0.85), 0, sh.len - 2);
  // Socks stripes / shoes
  for (const [i, c] of (so.stripes || []).entries()) for (const f of side('rightLeg')) f.row(so.top + 1 + i, C(c));
  for (const f of side('rightLeg')) { f.row(11, SOLE); f.row(shoeTop, shade(SNc, 1.08)); }
  s.face('rightLeg', 'front').paint(['.AA.'], { A: SNA }, { y: 10 });
  s.face('rightLeg', 'right').paint(['AAA.'], { A: SNA }, { y: 10 });
  if (o.kneepads) for (const f of side('rightLeg')) { f.rect(0, sh.len, f.w, 2, C(o.kneepads)); f.row(sh.len + 1, shade(C(o.kneepads), 0.75)); }

  // Arms: wristbands, darker hand
  for (const f of side('rightArm')) f.row(11, shade(SKc, 0.82));
  if (o.wristbands) for (const f of side('rightArm')) { f.rect(0, 8, f.w, 2, C(o.wristbands)); f.row(9, shade(C(o.wristbands), 0.8)); }

  // ── Head ──
  const hf = s.face('head', 'front');
  const H = o.hair ? [0.6, 0.8, 1, 1.09].map(k => shade(C(o.hair.color), k)) : null;
  const hairMap = H ? { H: H[2], h: H[1], f: mix(H[1], SKc, 0.45), t: C(o.hair.tip || o.hair.color) } : {};
  const hr = rng(`hair${seed}`);
  const hairPaint = (f, rows) => rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    if (ch === ' ') return f.set(x, y, T);
    let c = hairMap[ch];
    if (ch === 'H') c = [H[1], H[2], H[2], H[3]][Math.floor(hr() * 4)];
    f.set(x, y, c);
  }));
  if (o.hair) {
    const st = HAIR[o.hair.style];
    const { I, O } = st;
    hairPaint(s.face('head', 'top'), I.top || Array(8).fill('HHHHHHHH'));
    if (I.front) hairPaint(hf, I.front);
    if (I.side) { hairPaint(s.face('head', 'right'), I.side); hairPaint(s.face('head', 'left'), flip(I.side)); }
    if (I.back) hairPaint(s.face('head', 'back'), I.back);
    if (O.top) hairPaint(s.face('head', 'top', 'outer'), O.top);
    if (O.front) hairPaint(s.face('head', 'front', 'outer'), O.front);
    if (O.side) { hairPaint(s.face('head', 'right', 'outer'), O.side); hairPaint(s.face('head', 'left', 'outer'), flip(O.side)); }
    if (O.back) hairPaint(s.face('head', 'back', 'outer'), O.back);
  } else {
    s.face('head', 'top').paint(['........', '........', '...ll...', '..ll....'], { l: shade(SKc, 1.12) }); // shine
  }

  // Face: brows, eyes, nose, mouth, beard
  const BR = C(o.brows || (o.hair ? o.hair.color : '#2a1a12'));
  const EYE = C(o.eyes || '#2a1a12');
  const W = [244, 242, 238, 255];
  hf.paint(o.lashes ? ['.b....b.', 'bWE..EWb'] : ['.bb..bb.', '.WE..EW.'], { b: shade(BR, 0.8), W, E: EYE }, { y: 3 });
  hf.paint(['...nn...'], { n: shade(SKc, 0.8) }, { y: 5 });
  if (o.freckles) hf.paint(['.f....f.', 'f.f..f.f'], { f: mix(SKc, '#a0522d', 0.45) }, { y: 5 });
  if (o.blush) hf.paint(['p......p'], { p: mix(SKc, '#ff7a8a', 0.4) }, { y: 5 });
  const B = C(o.beardColor || (o.hair ? o.hair.color : '#1e1410'));
  const beardMap = { B: B, b: shade(B, 1.2) };
  if (o.beard === 'full') {
    hf.paint(['B.BBBB.B', 'BB....BB', 'BBBbBBBB'], beardMap, { y: 5 });
    const jaw = ['........', '........', '........', '.......B', '......BB', '.....BBB', '....BBBB', '...BBBBB'];
    s.face('head', 'right').paint(jaw, beardMap); s.face('head', 'left').paint(flip(jaw), beardMap);
    s.face('head', 'bottom').paint(['BBBBBBBB', 'BBBBBBBB', 'BBBBBBBB', '.BBBBBB.'], beardMap);
    s.face('head', 'front', 'outer').paint(['.BBBBBB.'], beardMap, { y: 7 });
  }
  if (o.beard === 'goatee') hf.paint(['..BbbB..', '........', '...BB...'], beardMap, { y: 5 });
  if (o.beard === 'mustache') hf.paint(['.BBbbBB.', '.B....B.'], beardMap, { y: 5 });
  if (o.beard === 'stubble') { const r = rng(`st${seed}`); for (let y = 5; y < 8; y++) for (let x = 0; x < 8; x++) if (r() < 0.45) hf.set(x, y, mix(hf.get(x, y), B, 0.35)); }
  const M = shade(SKc, 0.55);
  const mouth = { line: ['...mm...'], smile: ['..m..m..', '...mm...'], grin: ['..WWWW..'], focus: ['..mmmm..'], smirk: ['....mm..'] }[o.mouth || 'line'];
  hf.paint(mouth, { m: M, W }, { y: 6 });

  // Headband / goggles
  const of = s.face('head', 'front', 'outer');
  const headRing = [hf, s.face('head', 'right'), s.face('head', 'left'), s.face('head', 'back')];
  const headRingO = [of, s.face('head', 'right', 'outer'), s.face('head', 'left', 'outer'), s.face('head', 'back', 'outer')];
  if (o.headband) {
    const HB = C(o.headband), HL = C(o.headbandLogo || o.headband);
    headRing.forEach(f => f.row(2, shade(HB, 0.85)));
    headRingO.forEach(f => f.row(2, HB));
    of.paint(['...LL...'], { L: HL }, { y: 2 });
  }
  if (o.goggles) {
    const G = C(o.goggles), L = mix(W, C(o.lens || '#9ad8ff'), 0.45);
    hf.paint(['GGGGGGGG', 'GLEGGELG', '.GG..GG.'], { G, L, E: EYE }, { y: 3 });
    of.paint(['GGGGGGGG', 'G..GG..G', '.GG..GG.'], { G: shade(G, 1.25) }, { y: 3 });
    headRing.slice(1).forEach(f => f.row(3, G));
    headRingO.slice(1).forEach(f => f.row(3, shade(G, 1.15)));
  }
  if (o.chain) {
    const G = C(o.chain), P = C(o.pendant || o.chain);
    const rows = ['.G....G.', '..G..G..', '...PP...', '...PP...'];
    bf.paint(rows, { G, P }, { y: 1 });
    s.face('body', 'front', 'outer').paint(rows, { G: shade(G, 1.15), P: shade(P, 1.1) }, { y: 1 });
  }

  // ── Overlay ──
  const bo = s.face('body', 'front', 'outer'), bbo = s.face('body', 'back', 'outer');
  drawNum(bo, jer.numY, NUM); drawNum(bbo, 4, NUM);
  if (jer.emblem) bo.paint(jer.emblem.map(r => r.replace(/[YZ]/g, '.')), { X: shade(NUM, 1.1) }, { y: jer.emblemY ?? 2 });
  const lo = s.sides('rightLeg', 'outer');
  for (const f of lo) { f.row(sh.len - 1, shade(SHc, 0.85)); f.row(11, SOLE); f.row(10, SNc); if (shoe.high) f.row(9, shade(SNc, 1.08)); }
  s.face('rightLeg', 'front', 'outer').paint(['.AA.'], { A: SNA }, { y: 10 });
  s.face('rightLeg', 'right', 'outer').paint(['AAA.'], { A: SNA }, { y: 10 });
  if (o.kneepads) for (const f of lo) f.rect(0, sh.len, f.w, 2, shade(C(o.kneepads), 1.1));
  if (o.wristbands) for (const f of s.sides('rightArm', 'outer')) { f.row(8, C(o.wristbands)); f.row(9, shade(C(o.wristbands), 0.85)); }

  s.mirrorLimbs();

  // Shorts logo on the left leg only, arm sleeve on one arm
  if (sh.logo) s.face('leftLeg', 'front').paint(sh.logo, { X: SHT, Y: NUM }, { y: 1 });
  if (o.sleeve) {
    const arm = o.sleeve.side === 'right' ? 'rightArm' : 'leftArm';
    const SL = C(o.sleeve.color), SS = C(o.sleeve.stripe || o.sleeve.color);
    const from = o.sleeve.from ?? 1;
    for (const f of s.sides(arm)) shaded(f, (x, y) => (o.sleeve.stripes || []).includes(y) ? SS : SL, (x, y) => y >= from && y <= 9);
    for (const f of s.sides(arm)) f.noise(0.03, seed);
    for (const f of s.sides(arm, 'outer')) { f.row(9, shade(SL, 1.1)); if (from > 0) f.row(from, shade(SL, 1.1)); }
  }

  if (o.finish) o.finish(s, { color, SKc, Jc, JT, NUM, H, shaded });
  return s;
}

// ── Mascot finish: an owl costume over the jersey ─────────────────────────────────────────────
function owlCostume(s, { color, shaded }) {
  const { hex, shade, mix, rng } = color;
  const F = ['#3a2a3e', '#4e3a52', '#634a66', '#7a5e7c'].map(hex); // dusk-purple feathers
  const D = ['#d9c9a8', '#e8dcc0', '#f4ecd8'].map(hex);             // pale face disc
  const Y = hex('#ffcf2a'), O = hex('#ff8a1e'), K = hex('#141018');
  const r = rng('owl');
  const feather = (f, only) => shaded(f, (x, y) => (y % 2 === 0 ? [F[1], F[2], F[2], F[3]] : [F[0], F[1], F[2], F[1]])[Math.floor(r() * 4)], only);
  for (const f of s.faces('head')) feather(f);
  const hf = s.face('head', 'front');
  hf.paint(['FFFFFFFF', 'FddFFddF', 'dDDddDDd', 'DYYDDYYD', 'DYKDDKYD', 'dDDOODDd', 'FdDOODdF', 'FFdddddF'].map(x => x), { F: F[1], d: D[0], D: D[1], Y, K, O });
  // Overlay: ear tufts, brows over the eyes, feather ruff along the sides
  const of = s.face('head', 'front', 'outer');
  of.paint(['TT    TT', 'BBB  BBB', '        ', '        ', '        ', '        ', 'r      r', 'rr    rr'], { T: F[3], B: F[0], r: F[2] });
  s.face('head', 'top', 'outer').paint(['        ', '        ', '        ', '        ', '        ', 'T      T', 'TT    TT', 'TT    TT'], { T: F[3] });
  for (const [face, rows] of [['right', ['......TT', '........', '........', '........', '........', 'rrrrrrrr', 'r.r.r.r.', '.r.r.r.r']], ['left', ['TT......', '........', '........', '........', '........', 'rrrrrrrr', '.r.r.r.r', 'r.r.r.r.']]]) s.face('head', face, 'outer').paint(rows, { T: F[3], r: F[2] });
  s.face('head', 'back', 'outer').paint(['........', '........', '........', '........', '........', 'rrrrrrrr', 'r.r.r.r.', '.r.r.r.r'], { r: F[2] });
  // Wing arms with yellow mascot gloves, feather fringe on the overlay
  for (const arm of ['rightArm', 'leftArm']) {
    for (const f of s.faces(arm)) feather(f);
    for (const f of s.sides(arm)) { f.rect(0, 9, f.w, 3, Y); f.row(9, shade(Y, 1.1)); f.row(11, shade(Y, 0.8)); }
    s.face(arm, 'bottom').fill(shade(Y, 0.8));
    const outerSide = arm === 'rightArm' ? 'right' : 'left';
    s.face(arm, outerSide, 'outer').paint(['FFFF', 'FFFF', 'fFfF', 'FfFf', 'fFfF', 'FfFf', 'f.f.', '.f.f'], { F: F[2], f: F[1] });
    s.face(arm, 'back', 'outer').paint(['....', '....', '....', '....', 'FFFF', 'fFfF', 'f.f.'].map(x => x.slice(0, s.face(arm, 'back').w)), { F: F[2], f: F[1] });
    for (const f of s.sides(arm, 'outer')) f.row(9, shade(Y, 1.15));
  }
  // Feathered legs and orange talon shoes
  for (const leg of ['rightLeg', 'leftLeg']) {
    for (const f of s.sides(leg)) { feather(f, (x, y) => y >= 7 && y <= 9); f.rect(0, 10, f.w, 2, O); f.row(11, shade(O, 0.75)); }
    s.face(leg, 'front').paint(['O.O.', 'OOOO'].map(x => x), { O: shade(O, 1.15) }, { y: 10 });
    s.face(leg, 'bottom').fill(shade(O, 0.7));
    for (const f of s.sides(leg, 'outer')) { f.row(10, O); f.row(11, shade(O, 0.85)); }
    s.face(leg, 'front', 'outer').paint(['T.T.', 'TTTT'].map(x => x), { T: shade(O, 1.2) }, { y: 10 });
  }
}

// ── Crown for the slam champion ───────────────────────────────────────────────────────────────
function crown(s, { color }) {
  const { hex, shade } = color;
  const G = hex('#f2c230'), g = hex('#c8901a'), R = hex('#2a6ae8');
  const rows = ['G..GG..G', 'GgGRRGgG'];
  s.face('head', 'front', 'outer').paint(rows, { G, g, R });
  for (const f of ['right', 'left', 'back']) s.face('head', f, 'outer').paint(['G..GG..G', 'GgGgGgGg'], { G: shade(G, 0.9), g });
}

// ── Updates ───────────────────────────────────────────────────────────────────────────────────

export default {
  style: 'accent',
  updates: [
    {
      title: 'Tip-Off Night',
      note: 'The new season tips off under the city lights, and three new players walk onto the court: a high-flying dunker, an ice-cold shooter and a centre nobody can move.',
      skins: [
        {
          name: 'Comet Flyer', story: 'The star of the Harbor City Comets jumps so high that the crowd swears his teal sleeve leaves a trail across the rim.',
          build: kit => baller(kit, { seed: 401, skin: '#5a3a28', hair: { style: 'hightop', color: '#1c1410' }, beard: 'goatee', mouth: 'focus',
            jersey: { color: '#169c98', trim: '#ff7a1a', second: '#ff7a1a', number: 11, numColor: '#ffffff' }, shorts: { color: '#169c98', trim: '#ff7a1a', logo: ['.X..', 'XYX.', '.X..'] },
            shoes: { color: '#ff7a1a', accent: '#ffffff', sole: '#f4f4f4', high: true }, sleeve: { side: 'left', color: '#169c98', stripe: '#ff7a1a', stripes: [2, 8] } })
        },
        {
          name: 'Frost Guard', story: 'The point guard of the Glacier Bay Lynx never blinks behind his sport goggles, and his free throws are as cold as the bay in January.',
          build: kit => baller(kit, { seed: 402, skin: '#f0c8a4', hair: { style: 'messy', color: '#c4622a' }, eyes: '#3a7bd0', freckles: true, mouth: 'smirk',
            jersey: { color: '#e9f1f8', trim: '#3aa0e8', second: '#3aa0e8', number: 7, numColor: '#1c3a6a', neck: 'round' }, shorts: { color: '#e9f1f8', trim: '#3aa0e8' },
            socks: { color: '#1c3a6a', top: 8 }, shoes: { color: '#ffffff', accent: '#3aa0e8', sole: '#1c3a6a' }, goggles: '#22282e', lens: '#7fd0ff', wristbands: '#3aa0e8' })
        },
        {
          name: 'Canyon Center', story: 'The bearded giant of the Red Mesa Coyotes plants himself under the basket like a canyon wall, and nothing gets past him.',
          build: kit => baller(kit, { seed: 403, skin: '#9a6644', hair: null, beard: 'full', beardColor: '#1e1612', mouth: 'line',
            jersey: { color: '#b3302a', trim: '#e8c890', second: '#e8c890', number: 50, numColor: '#f2dcae' }, shorts: { color: '#b3302a', trim: '#e8c890', len: 6 },
            kneepads: '#222428', socks: { color: '#f2f2f2', top: 8, stripes: ['#b3302a'] }, shoes: { color: '#2a2a2e', accent: '#e8c890', sole: '#e8c890' }, headband: '#e8c890' })
        }
      ]
    },
    {
      title: 'Streetball Summer',
      note: 'When school is out, the real games move to the park courts: a crossover artist with a gold chain, a night baller with glowing locs and the queen of the sunset court.',
      skins: [
        {
          name: 'Park Crossover', story: 'He learned his crossover on the cracked park court behind his building and still plays there every evening in his mesh tank and gold chain.',
          build: kit => baller(kit, { seed: 411, skin: '#7a4e32', hair: { style: 'cornrows', color: '#1a120e' }, beard: 'stubble', mouth: 'smirk',
            jersey: { color: '#f2f2ee', trim: '#1e7a3a', second: '#f2f2ee', number: 0, numColor: '#1e7a3a', numY: 6, pattern: 'mesh', back: '.XXX.XX.' }, chain: '#e8b830', pendant: '#fff0a0',
            shorts: { color: '#3c5c8c', trim: '#2c4468', len: 7, stripe: false }, socks: { color: '#f4f4f4', top: 9 }, shoes: { color: '#d8302a', accent: '#ffffff', sole: '#f4f4f4' },
            sleeve: { side: 'right', color: '#1c1c1e', from: 0 } })
        },
        {
          name: 'Neon Night Baller', story: 'Under the floodlights of the midnight league his lime-tipped locs and neon jersey are the brightest things on the court.',
          build: kit => baller(kit, { seed: 412, skin: '#4a2e20', hair: { style: 'locs', color: '#20160f', tip: '#b8ff2a' }, mouth: 'grin',
            jersey: { color: '#18191c', trim: '#b8ff2a', second: '#3a3d44', number: 8, numColor: '#b8ff2a', pattern: 'split' }, shorts: { color: '#18191c', trim: '#b8ff2a' },
            socks: { color: '#18191c' }, shoes: { color: '#b8ff2a', accent: '#18191c', sole: '#18191c', high: true }, wristbands: '#b8ff2a' })
        },
        {
          name: 'Sunset Queen', slim: true, story: 'Nobody has beaten her at the beach court since spring, and she always plays the last game of the day as the sun goes down.',
          build: kit => baller(kit, { seed: 413, slim: true, skin: '#e0ac84', hair: { style: 'ponytail', color: '#3a2214', tip: '#ff5aa0' }, eyes: '#5a3a1e', lashes: true, blush: true, mouth: 'smile',
            jersey: { color: '#ff8a3a', trim: '#ffffff', second: '#ffd04a', number: 21, numColor: '#ffffff', pattern: 'gradient', colors: ['#ffc23a', '#ff6a4a', '#d0408a'] },
            shorts: { color: '#7a3aa0', trim: '#ffc23a', len: 5 }, socks: { color: '#ffffff', top: 9 }, shoes: { color: '#ffffff', accent: '#ff5aa0', sole: '#ff5aa0' },
            headband: '#ffffff', headbandLogo: '#ff5aa0', wristbands: '#ff5aa0' })
        }
      ]
    },
    {
      title: 'All-Star Weekend',
      note: 'The best players of the season meet for one big weekend: the crowned slam champion, a retro guard straight out of the seventies and the owl mascot who steals every show.',
      skins: [
        {
          name: 'Slam Champion', story: 'He won the dunk contest three years running, and the league finally gave him a golden crown to wear at every All-Star game.',
          build: kit => baller(kit, { seed: 421, skin: '#5e3c28', hair: { style: 'twists', color: '#1a120e' }, beard: 'goatee', mouth: 'smile',
            jersey: { color: '#f6f4ee', trim: '#f2c230', second: '#2a5ad8', number: 1, numColor: '#2a5ad8', back: '.XXXXX..' }, shorts: { color: '#2a5ad8', trim: '#f2c230', logo: ['.X..', 'XXX.', '.X..'] },
            shoes: { color: '#f2c230', accent: '#2a5ad8', sole: '#ffffff' }, wristbands: '#f2c230', finish: crown })
        },
        {
          name: 'Retro Groove Guard', story: 'He still plays in short shorts, striped tube socks and a big afro, because nobody ever told him the seventies were over.',
          build: kit => baller(kit, { seed: 422, skin: '#8a5a3a', hair: { style: 'afro', color: '#2a1a12' }, beard: 'mustache', mouth: 'smile',
            jersey: { color: '#f0e2c0', trim: '#c4521e', second: '#7a3a1e', number: 12, numColor: '#c4521e', neck: 'round', pattern: 'pinstripe' },
            shorts: { color: '#7a3a1e', trim: '#f0e2c0', len: 4 }, socks: { color: '#f6f2e8', top: 5, stripes: ['#c4521e', '#7a3a1e'] },
            shoes: { color: '#f6f2e8', accent: '#c4521e', sole: '#e0d0b0' }, headband: '#c4521e', wristbands: '#f0e2c0' })
        },
        {
          name: 'Midnight Owl Mascot', story: 'The Midnight Owls never win the title, but their purple owl mascot flips, dances and dunks so well that the fans only come to see him.',
          build: kit => baller(kit, { seed: 423, skin: '#634a66', hair: null, mouth: 'line',
            jersey: { color: '#1e2a5a', trim: '#c8ccd8', second: '#c8ccd8', number: '00', numColor: '#ffcf2a', back: '.XX.XX..' }, shorts: { color: '#1e2a5a', trim: '#c8ccd8', len: 7 },
            finish: owlCostume })
        }
      ]
    }
  ]
};
