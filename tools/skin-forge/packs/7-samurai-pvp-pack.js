// .7 Samurai PVP PACK — classic, full-body samurai armour in one colour family each, radial face shading
// (bright centre, dark edges), a glowing accent band, steel gauntlets and boots, a tiny crest overlay.
// Existing: Kage Shadow, Ryuu Dragon, Midori Forest, Arashi Storm, Tsubaki Blossom, Tetsu Iron, Kaen Void,
// Oni Demon, Shiroi Ghost, Raijin Thunder, Kuroi Shogun — all share one template (eye slit, chest triangle,
// crescent crest). The new samurai keep the material language but each gets its own mask, crest and chest.
//
// human()/glow() do not cover this look, so the pack has its own builder below: samurai(kit, spec).
// Paint keys used in every rows array:
//   0–4 main ramp (dark → light)      a–d accent ramp        g/G/h glow (mid / core / dim)
//   k   near black                    v/w/W third colour     x/y/z steel (gauntlets, boots)
//   s   skin                          plus per-skin `extra` keys

const FACES6 = ['top', 'bottom', 'right', 'front', 'left', 'back'];
const PARTS6 = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];

function palette({ color }, spec) {
  const { hex, shade, mix } = color;
  const base = hex(spec.main), hi = hex(spec.hi || shade(base, 1.35));
  const M = [shade(base, 0.38), shade(base, 0.66), base, mix(base, hi, 0.55), hi];
  const acc = hex(spec.accent);
  const A = [shade(acc, 0.5), shade(acc, 0.72), acc, shade(acc, 1.3)];
  const gl = hex(spec.glow);
  const th = hex(spec.third || spec.accent);
  const W3 = [shade(th, 0.62), th, shade(th, 1.3)];
  const S = (spec.steel || ['#323237', '#555258', '#828087']).map(hex);
  const map = {
    0: M[0], 1: M[1], 2: M[2], 3: M[3], 4: M[4],
    a: A[0], b: A[1], c: A[2], d: A[3],
    g: gl, G: shade(gl, 1.45), h: shade(gl, 0.55),
    k: shade(M[0], 0.35), s: hex(spec.skin || '#be9169'),
    v: W3[0], w: W3[1], W: W3[2], x: S[0], y: S[1], z: S[2]
  };
  for (const [k, c] of Object.entries(spec.extra || {})) map[k] = hex(c);
  return { M, A, W3, S, map };
}

// Radial shading like the pack: dark border, light centre, upper part lit, lower edge darker.
function shadeFace(f, R, r, jitter = 0.1) {
  const half = (f.w - 1) / 2, vhalf = (f.h - 1) / 2, flat = f.face === 'top' || f.face === 'bottom';
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const dx = Math.min(x, f.w - 1 - x);
    let l = Math.round((dx / half) * 3);
    if (flat) l = Math.min(l, Math.round((Math.min(y, f.h - 1 - y) / vhalf) * 3)) + (f.face === 'top' ? 0 : -1);
    else {
      const vy = y / (f.h - 1);
      if (y > 0 && vy < 0.35) l += 1;
      if (vy > 0.8) l -= 1;
    }
    if (r() < jitter) l += r() < 0.5 ? -1 : 1;
    f.set(x, y, R[Math.max(0, Math.min(R.length - 1, l))]);
  }
}

// One ring of a band: edges dark, centre bright (head: 'afghhgfa' style, limbs: 'abba').
function bandRow(f, y, A, edge) {
  for (let x = 0; x < f.w; x++) {
    const dx = Math.min(x, f.w - 1 - x);
    f.set(x, y, edge && dx === 0 ? edge : A[Math.min(A.length - 1, f.w > 4 ? dx - (edge ? 1 : 0) : dx + 1)]);
  }
}

// Gauntlets / boots from row y0 down: steel with a highlight column.
function steel(f, y0, S) {
  for (let y = y0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const dx = Math.min(x, f.w - 1 - x);
    f.set(x, y, y === f.h - 1 ? S[dx ? 1 : 0] : dx === 0 ? S[0] : x === 2 && y < f.h - 1 ? S[2] : S[1]);
  }
}

const SIDES4 = ['front', 'left', 'back', 'right'];
const mirrorRows = rows => rows.map(r => [...r].reverse().join(''));

function samurai(kit, spec) {
  const { Skin, color } = kit;
  const P = palette(kit, spec);
  const r = color.rng(spec.seed || 1);
  const s = new Skin({ slim: false });
  const legR = spec.legMain === 'accent' ? [P.A[0], P.A[0], P.A[1], P.A[2], P.A[3]] : P.M;
  for (const part of PARTS6) for (const face of FACES6) shadeFace(s.face(part, face), part.endsWith('Leg') ? legR : P.M, r, spec.jitter ?? 0.05);

  // Head: band around the sides and back, face, back detail.
  if (spec.headBand != null) for (const face of ['right', 'left', 'back']) bandRow(s.face('head', face), spec.headBand, P.A, P.M[0]);
  if (spec.face) s.face('head', 'front').paint(spec.face, P.map);
  if (spec.headBack) s.face('head', 'back').paint(spec.headBack, P.map);
  if (spec.headTop) s.face('head', 'top').paint(spec.headTop, P.map);

  // Body: obi around all four sides, chest and back art.
  if (spec.obi != null) for (const face of SIDES4) bandRow(s.face('body', face), spec.obi, P.A, face === 'front' || face === 'back' ? P.M[0] : null);
  if (spec.chest) s.face('body', 'front').paint(spec.chest, P.map);
  s.face('body', 'back').paint(spec.back || mirrorRows(spec.chest || []), P.map);
  if (spec.bodySide) for (const face of ['right', 'left']) s.face('body', face).paint(spec.bodySide, P.map);

  // Right limbs (mirrored at the end).
  const arm = { bands: [3], hands: 9, ...spec.arm }, leg = { bands: [4], boots: 8, ...spec.leg };
  const ramp = which => (which === 'main' ? [P.M[0], P.M[2], P.M[4]] : which === 'third' ? P.W3 : which === 'accent' ? [P.A[0], P.A[2], P.A[3]] : P.S);
  for (const face of SIDES4) {
    const fa = s.face('rightArm', face), fl = s.face('rightLeg', face);
    for (const y of arm.bands) bandRow(fa, y, P.A);
    for (const y of leg.bands) bandRow(fl, y, P.A);
    if (arm.hands != null) steel(fa, arm.hands, ramp(arm.handRamp));
    if (leg.boots != null) steel(fl, leg.boots, ramp(leg.bootRamp));
    if (arm.sides) fa.paint(arm.sides, P.map);
    if (leg.sides) fl.paint(leg.sides, P.map);
  }
  if (arm.hands != null) s.face('rightArm', 'bottom').fill(ramp(arm.handRamp)[0]);
  if (leg.boots != null) s.face('rightLeg', 'bottom').fill(ramp(leg.bootRamp)[0]);
  if (arm.front) s.face('rightArm', 'front').paint(arm.front, P.map);
  if (leg.front) s.face('rightLeg', 'front').paint(leg.front, P.map);
  if (arm.outer) s.face('rightArm', 'right').paint(arm.outer, P.map);

  // Overlay: crest (hat), collar, sode (shoulder guards), knee guards.
  const o = (part, face, rows) => rows && s.face(part, face, 'outer').paint(rows, P.map);
  const hat = spec.hat || {};
  o('head', 'top', hat.top); o('head', 'front', hat.front); o('head', 'back', hat.back);
  o('head', 'right', hat.right || hat.side); o('head', 'left', hat.left || (hat.side && hat.right ? null : hat.side) || (hat.right && mirrorRows(hat.right)));
  o('body', 'front', spec.collar); o('body', 'back', spec.collarBack);
  if (arm.sode) { o('rightArm', 'right', arm.sode.side); o('rightArm', 'front', arm.sode.front); o('rightArm', 'back', arm.sode.back); o('rightArm', 'top', arm.sode.top); }
  if (leg.guard) { o('rightLeg', 'front', leg.guard.front); o('rightLeg', 'right', leg.guard.side); o('rightLeg', 'left', leg.guard.side); }

  s.mirrorLimbs();
  if (spec.finish) spec.finish(s, P.map);
  return s;
}

const build = spec => kit => samurai(kit, spec);

export default {
  style: 'minimal',
  updates: [
    // ───────────────────────────── Update 1 ─────────────────────────────
    {
      title: 'Tide and Moon',
      note: 'Three new samurai step onto the arena at night: a tide warrior with a dorsal-fin crest, a moon guard behind a silver visor and a firefly hunter who glows in the dark.',
      skins: [
        {
          name: 'Nami Tide',
          story: 'He fights the way the sea moves, wave after wave, and his foam-white mask has never been seen dry.',
          build: build({
            seed: 201, main: '#1b5683', hi: '#47aede', accent: '#9ee8f2', glow: '#5ff0ff', third: '#1f9aa0',
            steel: ['#1c2430', '#34404e', '#5c6c7c'],
            face: ['01233210', '12344321', '0abccba0', '0kgkkgk0', '1wwwwww1', '1wdwwdw1', '12wwww21', '11211211'],
            headBand: 2,
            headBack: ['........', '........', '........', '...dd...', '...cd...', '..c..c..', '........', '........'],
            obi: 6,
            chest: ['........', '..ddd...', '.d...d..', '.d.cd.d.', '.c..c...', '..cc....', '........', '........', '........', '.w....w.', '..w..w..', '........'],
            arm: { bands: [3], hands: 9 },
            leg: { bands: [4], boots: 8 },
            hat: {
              top: ['        ', '        ', '   ww   ', '   wW   ', '   wW   ', '   wW   ', '   wW   ', '   WW   '],
              front: ['   WW   ', '    W   '],
              back: ['   ww   ', '   w    ']
            },
            collar: ['        ', ' c    c ', '  d  d  ']
          })
        },
        {
          name: 'Tsuki Moon',
          story: 'She only duels under a full moon, and the silver disc on her helm is the last light her rivals remember.',
          build: build({
            seed: 202, main: '#2c2b68', hi: '#6d6bcc', accent: '#c4c8da', glow: '#e4f6ff', third: '#f2eec4',
            steel: ['#1e1e2e', '#3a3a52', '#64648a'],
            face: ['012wW210', '12wWWw21', '012ww210', 'kkkkkkkk', 'khGkkGhk', 'kkkkkkkk', 'abcddcba', '01222210'],
            headBand: 3,
            headBack: ['........', '........', '........', '........', '...ww...', '..wWWw..', '...ww...', '........'],
            obi: 7,
            chest: ['........', '.W....W.', '...ww...', '..wWWw..', '..wWWw..', '...ww...', '.W......', '........', '........', '......W.', '..W.....', '........'],
            back: ['........', '..ww....', '.w......', '.w......', '.w......', '..ww....', '......W.', '........', '........', '.W......', '....W...', '........'],
            arm: { bands: [1, 5], hands: 9 },
            leg: { bands: [3, 7], boots: 9 },
            hat: {
              top: ['        ', '        ', '        ', '        ', ' c    c ', ' cd  dc ', '  cddc  ', '        '],
              front: ['dc    cd', ' cd  dc ']
            },
            collar: ['c      c', ' c    c ']
          })
        },
        {
          name: 'Hotaru Firefly',
          story: 'Nobody sees him in the dark forest arena until the fireflies on his armour light up all at once.',
          build: build({
            seed: 203, main: '#2e3c1c', hi: '#647e36', accent: '#a6e22e', glow: '#ecff70', third: '#5a3e22',
            steel: ['#1a1e14', '#2e3424', '#4a523a'],
            face: ['01233210', '12344321', '1kkkkkk1', 'khGkkGhk', 'kkhkkhkk', '1kkkkkk1', '12kkkk21', '01222210'],
            headBand: 1,
            obi: 6,
            chest: ['...w....', '...w....', '..hgh...', '..gGg...', '..hgh...', '...w....', '........', '...w....', '.g....h.', '...w....', '....g...', '.h......'],
            back: ['........', '.h....g.', '........', '...hgh..', '...gGg..', '...hgh..', '........', '........', '..g.....', '.....h..', '........', '...g....'],
            arm: { bands: [3], hands: 9, front: ['....', '....', '....', '....', '....', '.g..', '....', '..h.'] },
            leg: { bands: [4], boots: 9, front: ['....', '.h..', '....', '....', '....', '....', '..g.', '....'] },
            hat: {
              top: ['        ', '        ', '        ', '        ', '        ', ' G    G ', ' c    c ', '  c  c  '],
              front: ['  d  d  ']
            },
            collar: ['        ', '        ', '   cc   ']
          })
        }
      ]
    },
    // ───────────────────────────── Update 2 ─────────────────────────────
    {
      title: 'Ashes of the Mountain',
      note: 'The mountain clan joins the fight: a volcano samurai with lava in his cracks, a golden general in crimson lacing and a stone guardian tied with a sacred rope.',
      skins: [
        {
          name: 'Kazan Volcano',
          story: 'Every hit he takes only cracks his armour wider, and the lava underneath burns hotter for the next round.',
          build: build({
            seed: 211, main: '#302826', hi: '#62544f', accent: '#ff5a14', glow: '#ffd84a', third: '#ff8a2a',
            steel: ['#1a1616', '#2c2626', '#463c3a'], jitter: 0.14,
            face: ['0123a210', '123ab321', '1ab2b4a1', '0kckkck0', '12cb3321', '1kgGGgk1', '12ka3k21', '012a1110'],
            headBand: null,
            headBack: ['..a.....', '..ba....', '...b....', '...cb...', '..b..a..', '.a......', '........', '........'],
            obi: 6,
            chest: ['...a....', '...ba...', '....c...', '...cdb..', '..b..c..', '.a...cb.', '........', '...b....', '..c.....', '..cb..a.', '.b...b..', '.a...a..'],
            back: ['.....a..', '....ab..', '...c....', '..bdc...', '..c..b..', '.bc...a.', '........', '....b...', '.....c..', '.a..bc..', '..b...b.', '..a...a.'],
            arm: { bands: [], hands: 8, front: ['..a.', '.b..', '.c..', '..cb', '...a', '..b.', '.a..', '....', '....', '.c..', '....', '.c.c'] },
            leg: { bands: [], boots: 8, front: ['.a..', '.b..', '..c.', '..cb', '.b..', 'a...', '....', '....', '....', '..c.', '....', '....'] },
            hat: {
              top: ['        ', '        ', '        ', '        ', '        ', '  c  c  ', ' bcb bc ', 'abcbabca'],
              front: [' ab  ba ', '  a  a  ']
            },
            collar: ['        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', '  c     ', ' b   b  ', ' a   a  ']
          })
        },
        {
          name: 'Kin Gold',
          story: 'The golden general laces his armour with crimson cord, one knot for every arena he has won.',
          build: build({
            seed: 212, main: '#b8861c', hi: '#ffe27a', accent: '#b41c2c', glow: '#fff4c0', third: '#2a2630',
            steel: ['#1a1820', '#2e2a36', '#4c4658'],
            face: ['01233210', '0abccba0', '12344321', '1kGkkGk1', '12w34w21', '1wwwwww1', '1w2kk2w1', '01w22w10'],
            headBand: 1,
            headBack: ['........', '........', '........', '........', 'bcbcbcbc', '........', '........', '........'],
            obi: null,
            chest: ['........', 'bcbcbcbc', '........', '........', 'cbcbcbcb', '........', 'vwwddwwv', '........', '........', 'bcbcbcbc', '........', '........'],
            back: ['........', 'cbcbcbcb', '........', '........', 'bcbcbcbc', '........', 'vwwwwwwv', '........', '........', 'cbcbcbcb', '........', '........'],
            bodySide: ['....', 'bcbc', '....', '....', 'cbcb', '....', 'vwwv', '....', '....', 'bcbc', '....', '....'],
            arm: {
              bands: [], hands: 9, sides: ['....', '....', '....', '....', '....', 'cbcb', '....', '....'],
              sode: { side: ['3444', 'bcbc', '2332', 'cbcb'], front: ['3443', 'bccb'], back: ['3443', 'bccb'] }
            },
            leg: { bands: [], boots: 8, sides: ['....', '....', '....', '....', 'bcbc', '....', '....', '....'] },
            hat: {
              top: ['        ', '        ', '        ', '        ', '   dd   ', ' d dd d ', '  dddd  ', 'd cddc d'],
              front: ['  cddc  ']
            }
          })
        },
        {
          name: 'Iwa Stone',
          story: 'A guardian carved from the mountain itself, tied with a sacred rope so he cannot walk away from the fight.',
          build: build({
            seed: 213, main: '#8a7a62', hi: '#d2c4a2', accent: '#d8b860', glow: '#7cff9a', third: '#4f7a2e',
            steel: ['#4a4238', '#5e5448', '#7a6e5e'], jitter: 0.16,
            extra: { p: '#f6f2e8', P: '#c8c2b0' },
            face: ['ww123310', 'w2344321', '1kkkkkk1', '1kgkkgk1', '12344321', '1dkdkdk1', '12kkkk21', '01w22210'],
            headBand: null,
            headBack: ['........', 'abababab', 'babababa', '...pp...', '...P....', '........', '.....w..', '....ww..'],
            obi: null,
            chest: ['........', '..w.....', '.ww..1..', '...1....', '........', 'abababab', 'babababa', '.pp..pp.', '.pP..pP.', '..P...P.', '........', '........'],
            back: ['........', '.....w..', '..1..ww.', '....1...', '........', 'abababab', 'babababa', '........', '...pp...', '....p...', '...pp...', '........'],
            bodySide: ['....', '....', '....', '....', '....', 'abab', 'baba', '....', '....', '....', '....', '....'],
            arm: { bands: [], hands: 9, handRamp: 'main', sides: ['....', 'w...', 'ww..', '....', '....', 'abab', '....', '....', '....', '....', '....', '....'] },
            leg: { bands: [], boots: 9, front: ['....', '....', '..w.', '....', '....', 'abab', 'baba', '....'] },
            hat: {
              front: ['        ', 'abababab', '   pp   ', '   pP   ', '    P   '],
              side: ['        ', 'abababab'],
              back: ['        ', 'abababab', '   ab   ', '   b    '],
              top: ['        ', '        ', ' w      ', 'ww    w ', '        ', '        ', '        ', '        ']
            }
          })
        }
      ]
    },
    // ───────────────────────────── Update 3 ─────────────────────────────
    {
      title: 'Spirits of the Shrine',
      note: 'Three shrine spirits put on armour for the tournament: a white fox in a vermilion mask, a jade serpent with golden fangs and a crow samurai with a sharp orange beak.',
      skins: [
        {
          name: 'Kitsune Fox',
          story: 'The shrine fox wears a white mask with red markings, and by the time you see her ears move she has already struck.',
          build: build({
            seed: 221, main: '#d2ccbe', hi: '#fbf8f0', accent: '#e0401c', glow: '#ffc83a', third: '#ffc83a',
            steel: ['#1e1a1a', '#363030', '#524a48'], legMain: 'accent',
            face: ['12344321', '1a3443a1', '23b44b32', '2kg44gk2', '334bb433', '23444432', '123kk321', '01233210'],
            headBand: null,
            headBack: ['........', '........', '..b..b..', '...bb...', '........', '........', '........', '........'],
            obi: 5,
            chest: ['a......a', '.a....a.', '..a..a..', '...ab...', '...ba...', '........', 'bbbwWbbb', '........', '.4....4.', '.34..43.', '..3..3..', '........'],
            back: ['........', '........', '...ww...', '..wWWw..', '...ww...', '........', 'bbbbbbbb', '........', '.4..4..4', '.3..3..3', '........', '........'],
            arm: { bands: [7], hands: 10, handRamp: 'main' },
            leg: { bands: [], boots: 10, bootRamp: 'main', front: ['....', '....', '..d.', '....', '....', '....', '.d..', '....', '....', '....', '....', 'xxxx'] },
            hat: {
              top: ['        ', '        ', '        ', '        ', '        ', '  3  3  ', ' 3b  b3 ', ' 34  43 '],
              front: [' 3b  b3 ']
            },
            collar: ['W      W', ' W    W ']
          })
        },
        {
          name: 'Hebi Serpent',
          story: 'The jade serpent hisses once before every duel, and nobody has ever lasted long enough to hear the second.',
          build: build({
            seed: 222, main: '#1c6a4c', hi: '#5cd09a', accent: '#d8b42a', glow: '#f4ff4a', third: '#0f3d2c',
            steel: ['#14261e', '#24402f', '#3c5e48'],
            extra: { f: '#f0f0e0' },
            face: ['01233210', '12w44w21', '1w3443w1', '1Gk33kG1', '1gk33kg1', '12344321', '1kfkkfk1', '01f22f10'],
            headBand: null,
            headTop: ['0w0w0w0w', 'w1w1w1w1', '1w2w2w1w', 'w2w3w2w1', '1w2w2w1w', 'w1w2w1w1', '0w1w1w0w', 'w0w0w0w0'],
            obi: 6,
            chest: ['........', '.w.cc.w.', 'w.wddw.w', '.w.cc.w.', 'w.wddw.w', '.w.cc.w.', '........', '.w.cc.w.', 'w.wddw.w', '.w.cc.w.', 'w.wddw.w', '........'],
            back: ['w.w.w.w.', '.w.w.w.w', 'w.w.w.w.', '.w.w.w.w', 'w.w.w.w.', '.w.w.w.w', '........', 'w.w.w.w.', '.w.w.w.w', 'w.w.w.w.', '.w.w.w.w', '........'],
            arm: { bands: [], hands: 9, sides: ['w.w.', '.w.w', 'w.w.', '.w.w', 'w.w.', '.w.w', 'w.w.', '.w.w'] },
            leg: { bands: [], boots: 9, sides: ['.w.w', 'w.w.', '.w.w', 'w.w.', '.w.w', 'w.w.', '.w.w', 'w.w.', '.w.w'] },
            hat: {
              right: ['   wwwww', '  w2222w', '  w2dd2w', '  w2222w', '   ww22w', '     www', '        ', '        '],
              back: ['wwwwwwww', 'w      w', 'w      w', ' w    w ']
            }
          })
        },
        {
          name: 'Karasu Crow',
          story: 'The crow samurai drops from the shrine roof with black feathers spread, and his red eyes pick a target before he lands.',
          build: build({
            seed: 223, main: '#1e2442', hi: '#4a5482', accent: '#e8901c', glow: '#ff3434', third: '#34467e',
            steel: ['#141420', '#262636', '#40405a'],
            face: ['01233210', '12344321', '1kgkkgk1', '123cc321', '12bccb21', '12bcdb21', '123bc321', '0122b210'],
            headBand: null,
            headBack: ['........', '.w....w.', '.Ww..wW.', '..Ww.W..', '...WW...', '........', '........', '........'],
            obi: 6,
            chest: ['........', 'w......w', 'Ww....wW', '.Ww..wW.', '..WwwW..', '...WW...', '........', 'w......w', 'Ww....wW', '.Ww..wW.', '..WwwW..', '........'],
            arm: {
              bands: [], hands: 9, front: ['....', '....', '....', '....', '....', '....', '....', '....', '....', '....', '....', 'c.c.'],
              sode: { side: ['Wwwv', 'wwv ', 'wv  '], front: ['Wwwv', 'Www '] }
            },
            leg: { bands: [], boots: 9, bootRamp: 'accent', front: ['....', 'w..w', 'Ww.W', '.WW.', '....', '....', '....', '....'] },
            hat: {
              front: ['        ', '        ', '        ', '        ', '   cc   ', '   bd   ', '    b   '],
              right: ['   vwwWW', '  vwwWW ', ' vwwW   ', 'vww     ', '        ', '        ', '        ', '        '],
              top: ['vwwvvwwv', ' vw  wv ', '        ', '        ', '        ', '        ', '        ', '        ']
            },
            collar: ['W      W', 'wW    Ww']
          })
        }
      ]
    }
  ]
};
