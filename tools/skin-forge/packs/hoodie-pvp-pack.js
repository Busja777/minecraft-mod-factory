// Hoodie PVP pack: sixteen flat-shaded PvP hoodies that only differ in colour. The pack's look: every
// material is one flat colour with a 1 px darker border (no noise), the hood sits on the overlay with a
// 4×6 window for the face (two dark eyes, a two-pixel nose shadow and mouth), a hair fringe peeking out,
// a lighter stripe down the back of the hood, drawstrings at the neck, a light chest stripe, cream cuffs
// over bare hands, dark grey trousers with a crease and white sneakers with a coloured stripe. Overlay
// ≈ 81 % transparent (hood plus a stripe) → style 'accent'.
// New fighters keep the flat material language and the hood, but each one gets its own idea: a mask,
// ears, a split cut, armour under the zip, a harness, a scarf, tie-dye, a big print or a colour fade.

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const mul = (c, f) => [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(c[i] * f)))).concat(255);
const I = (s, part, face) => s.face(part, face);
const O = (s, part, face) => s.face(part, face, 'outer');
const SIDES = ['front', 'right', 'left', 'back'];

// paint() that refuses rows of the wrong width (the kit cuts them silently).
function P(f, rows, m, at = {}) {
  const x = at.x || 0;
  rows.forEach((r, i) => { if (r.length + x !== f.w) throw new Error(`row ${i} "${r}" is ${r.length} wide on ${f.part}.${f.face} (${f.w})`); });
  return f.paint(rows, m, at);
}

// The pack's shading: flat fill, darker 1 px frame (cols, optional top/bottom rows) in a row range.
function flat(f, k, c, { y0 = 0, y1 = f.h - 1, top = true, bottom = true, sides = true } = {}) {
  for (let y = y0; y <= y1; y++) for (let x = 0; x < f.w; x++) {
    const edge = (sides && (x === 0 || x === f.w - 1)) || (top && y === y0) || (bottom && y === y1);
    f.set(x, y, edge ? k : c);
  }
  return f;
}

// A face window inside the hood: 6 rows of 4 (rows 2–7, cols 2–5), hood shadow '4' around it.
const win = rows => ['44444444', '44444444', ...rows.map(r => '44' + r + '44')];

// The fighter. o: { skin, eyes, mouth, brows, hoodie, hood, pants, shoes, accent, cuff, hair, colors,
//   hoodUp (default true), face (8 rows), hoodFront (8 overlay rows), stripe (chest stripe, default off),
//   inner(s, m), outer(s, m) before mirroring; finish(s, m) after mirroring }
function fighter({ Skin, color }, o) {
  const s = new Skin();
  const hx = color.hex;
  const t3 = (c, d = 0.7, l = 0.22) => { const b = hx(c); return [mul(b, d), b, color.mix(b, '#ffffff', l)]; };
  const SK = t3(o.skin || '#deb894', 0.81, 0.15);
  const HO = t3(o.hoodie), HD = t3(o.hood || mul(hx(o.hoodie), 1.2));
  const PA = t3(o.pants || '#373a40'), SH = t3(o.shoes || '#e8e8eb', 0.77, 0.4), HA = t3(o.hair || '#2a2420', 0.7, 0.25);
  const m = {
    a: SK[0], c: SK[1], C: SK[2], n: mul(SK[1], 0.86), s: mul(SK[1], 0.9),
    r: hx(o.mouth || '#78463c'), e: hx(o.eyes || '#232837'), w: hx('#f4f4f4'), b: hx(o.brows || mul(HA[1], 0.85)),
    1: HO[0], 2: HO[1], 3: HO[2], 4: HD[0], 5: HD[1], 6: HD[2], 7: PA[0], 8: PA[1], 9: PA[2],
    x: SH[0], y: SH[1], z: SH[2], v: hx(o.accent || '#fff0d2'), u: hx(o.cuff || '#fff0d2'),
    h: HA[0], H: HA[1], j: HA[2], k: hx('#1c1c20'),
    ...Object.fromEntries(Object.entries(o.colors || {}).map(([ch, v]) => [ch, hx(v)]))
  };
  const hoodUp = o.hoodUp !== false;

  // Head: flat skin; with the hood up the inner head is hood cloth with a shadow round the face.
  for (const f of s.faces('head')) flat(f, m.a, m.c);
  if (hoodUp) for (const f of ['top', 'right', 'left', 'back']) flat(I(s, 'head', f), m[4], m[5]);

  // Body: flat hoodie, drawstrings.
  for (const f of s.faces('body')) flat(f, m[1], m[2]);
  P(I(s, 'body', 'front'), ['..u..u..', '..u..u..', '..u..u..'], m);
  if (o.stripe) P(O(s, 'body', 'front'), ['........', '........', '........', '........', '.uuuuuu.'], m);

  // Arms: sleeve rows 0–8, cuff row 9, bare hand rows 10–11.
  for (const f of s.sides('rightArm')) { flat(f, m[1], m[2], { y1: 8, bottom: false }); f.row(9, m.u).row(10, m.c).row(11, m.a); }
  flat(I(s, 'rightArm', 'top'), m[1], m[2]); flat(I(s, 'rightArm', 'bottom'), m.a, m.c);

  // Legs: trousers with a crease, sneakers.
  for (const f of s.sides('rightLeg')) {
    flat(f, m[7], m[8], { y1: 7, top: false });
    flat(f, m.x, m.y, { y0: 8, y1: 11 });
  }
  I(s, 'rightLeg', 'front').col(1, m[9], 0, 6).col(2, m[9], 0, 6).row(9, m.v).row(11, m.z);
  flat(I(s, 'rightLeg', 'top'), m[7], m[8]); I(s, 'rightLeg', 'bottom').fill(m.x);

  // Face.
  if (o.face) P(I(s, 'head', 'front'), o.face, m);

  // Hood on the overlay.
  if (hoodUp) {
    flat(O(s, 'head', 'top'), m[4], m[5]); O(s, 'head', 'top').rect(2, 2, 4, 2, m[6]);
    for (const f of ['right', 'left']) flat(O(s, 'head', f), m[4], m[5]);
    flat(O(s, 'head', 'back'), m[4], m[5]); O(s, 'head', 'back').rect(3, 0, 2, 7, m[6]);
    P(O(s, 'head', 'front'), o.hoodFront || ['44444444', '45h..h54', '45....54', '45....54', '45....54', '45....54', '45....54', '45....54'], m);
  }

  if (o.inner) o.inner(s, m);
  if (o.outer) o.outer(s, m);
  s.mirrorLimbs();
  if (o.finish) o.finish(s, m);
  return s;
}

// Hood down: the hood lies folded over the shoulders and the upper back.
function hoodDown(s, m) {
  flat(O(s, 'body', 'top'), m[4], m[5]);
  P(O(s, 'body', 'back'), ['44444444', '45555554', '45566554', '45566554', '.455554.', '..4444..'], m);
  P(O(s, 'body', 'front'), ['44....44'], m);
  for (const f of ['right', 'left']) P(O(s, 'body', f), ['4444'], m);
}

// Spiral tie-dye on a face; cx, cy = centre of the spiral.
function tieDye(f, cols, cx, cy, twist = 0.55, turns = 2) {
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const a = Math.atan2(y - cy, x - cx) / (2 * Math.PI) + 0.5, r = Math.hypot(x - cx, y - cy);
    const i = Math.floor(a * turns * cols.length + r * twist * cols.length) % cols.length;
    f.set(x, y, cols[(i + cols.length) % cols.length]);
  }
}

// Vertical fade through colour stops (row 0 → last row).
const fadeAt = (color, stops, t) => {
  const k = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  return color.mix(stops[k], stops[k + 1], t * (stops.length - 1) - k);
};

// ── The design ────────────────────────────────────────────────────────────────────────────────

export default {
  style: 'accent',
  updates: [
    {
      title: 'Hoods Up',
      note: 'Three new fighters pull their hoods up and keep their secrets: a masked raider, a fox with ears on his hood and a hoodie cut clean down the middle.',
      skins: [
        {
          name: 'Bandit Shade',
          story: 'Nobody has ever seen what is under the red bandana, only the cold blue eyes above it when he takes your bed.',
          build: kit => fighter(kit, {
            skin: '#d6a47c', eyes: '#2f6fc0', hoodie: '#3a3e48', hood: '#464b57', pants: '#1f2126', shoes: '#2c2d33',
            accent: '#d23a40', cuff: '#d23a40', hair: '#1e1a18',
            colors: { R: '#c8323c', Q: '#8e2128', W: '#f2e6e0' },
            face: win(['hHHh', 'cbbc', 'ecce', 'RRRR', 'RWRR', 'RRRR']),
            hoodFront: ['44444444', '45hhhh54', '45....54', '45....54', '45....54', '45RRRR54', '4RQRRQR4', '4RRRRRR4'],
            inner: (s, m) => {
              // kangaroo pocket, red bandana tip on the chest, jogger stripe and cuffs
              P(I(s, 'body', 'front'), ['..R..R..', '..R..R..', '..R..R..', '........', '........', '........', '.111111.', '.1....1.', '1......1', '11111111', '........', '11111111'], m);
              P(I(s, 'body', 'back'), ['........', '...RR...', '...Q....'], m);
              for (const f of s.sides('rightArm')) f.row(2, m.R).row(3, m.Q);
              I(s, 'rightLeg', 'right').col(1, m.R, 0, 6).col(2, m.R, 0, 6);
              for (const f of s.sides('rightLeg')) f.row(7, m.Q);
            },
            outer: (s, m) => {
              P(O(s, 'head', 'back'), ['........', '........', '........', '........', '........', 'RRRRRRRR', '...RQ...', '...R.Q..'], m);
              for (const f of ['right', 'left']) P(O(s, 'head', f), ['........', '........', '........', '........', '........', 'RRRRRRRR', '........', '........'], m);
              for (const f of s.sides('rightArm', 'outer')) f.row(9, m.R);
            }
          })
        },
        {
          name: 'Copper Fox',
          story: 'He stitched fox ears and a bushy tail onto his hoodie for a joke, and now the whole server is scared of the orange blur in the trees.',
          build: kit => fighter(kit, {
            skin: '#f2c9a0', eyes: '#3fa84a', hoodie: '#e0742a', hood: '#ec8432', pants: '#4a3426', shoes: '#2a201a',
            accent: '#f4ead8', cuff: '#2a1a12', hair: '#b8461e', mouth: '#9a4a3c',
            colors: { F: '#f4ead8', f: '#d8c6aa', T: '#2a1a12', p: '#e8a080' },
            face: win(['HHjH', 'Hccc', 'ecce', 'pccp', 'ccrr', 'aaaa']),
            hoodFront: ['TT4444TT', 'TF5hH5FT', '45....54', '45....54', '45....54', '45....54', '4F....F4', '4FF..FF4'],
            inner: (s, m) => {
              // cream fox chest, dark "fox socks" on the forearms, paw sneakers
              P(I(s, 'body', 'front'), ['1Fu..uF1', '1FuFFuF1', '1FFFFFF2', '2FFFFFF2', '22FFFF22', '22FFFF22', '222FF222', '22222222', '22222222', '22222222', '22222222', '11111111'], m);
              for (const f of s.sides('rightArm')) f.rect(0, 5, 4, 4, m.T).row(9, m.T);
              P(I(s, 'rightLeg', 'front'), ['....', '....', '....', '....', '....', '....', '....', '....', 'xxxx', 'FyyF', 'yyyy', 'FFFF'], m);
              // tail on the back
              P(I(s, 'body', 'back'), ['........', '........', '........', '........', '........', '...44...', '..4554..', '..5555..', '..5555..', '..4FF4..', '...FF...', '11111111'], m);
            },
            outer: (s, m) => {
              // ears on the hood's top corners, dark tips, cream insides
              P(O(s, 'head', 'top'), ['TT....TT', 'T5....5T', '........', '........', '........', '........', '........', '........'], m);
              for (const f of ['right', 'left']) P(O(s, 'head', f), ['TT....TT', '........', '........', '........', '........', '........', '........', '........'], m);
              P(O(s, 'head', 'back'), ['TT....TT', '........', '........', '........', '........', '........', '........', '........'], m);
              P(O(s, 'body', 'back'), ['........', '........', '........', '........', '........', '...44...', '..4554..', '.455554.', '.455554.', '.45FF54.', '..FFFF..', '...FF...'], m);
              for (const f of s.sides('rightArm', 'outer')) f.row(9, m.T);
            }
          })
        },
        {
          name: 'Split Signal',
          story: 'Half teal, half night: she switches sides of the arena mid-fight and nobody can tell which team she is on.',
          build: kit => fighter(kit, {
            skin: '#9a6a48', eyes: '#1fb8a8', hoodie: '#22a89a', hood: '#28bcae', pants: '#2a2c32', shoes: '#22a89a',
            accent: '#f2f2f2', cuff: '#f2f2f2', hair: '#e8e8ee', brows: '#c8c8d0', mouth: '#5a3424',
            colors: { K: '#1a1a20', L: '#2a2a32', M: '#3a3a44', A: '#f0a020', Z: '#f2f2f2' },
            face: win(['HHjH', 'bccb', 'ecca', 'ccnc', 'crrc', 'aaaa']),
            hoodFront: ['4444KKKK', '45HjHHLK', '45....LK', '45....LK', '45....LK', '45....LK', '45....LK', '45....LK'],
            inner: (s, m) => {
              // the left half (x 4–7 front, 0–3 back) is black, with a white stitched seam
              const half = (f, xs) => { for (let y = 0; y < f.h; y++) for (const x of xs) f.set(x, y, (x === 0 || x === 7 || y === 0 || y === f.h - 1) ? m.K : m.L); };
              half(I(s, 'body', 'front'), [4, 5, 6, 7]); half(I(s, 'body', 'back'), [0, 1, 2, 3]);
              flat(I(s, 'body', 'left'), m.K, m.L);
              P(I(s, 'body', 'front'), ['..u..2..', '..u..2..', '..u..2..', '...Z....', '....Z...', '...Z....', '....Z...', '...Z....', '....Z...', '...Z....', '....Z...', '........'], m);
              P(I(s, 'body', 'top'), ['2222KKKK', '2222LLLL', '2222LLLL', '2222KKKK'], m);
              // face: one teal and one amber eye
              I(s, 'head', 'front').set(5, 4, m.A);
            },
            outer: (s, m) => {
              const hood = (f, xs) => { for (let y = 0; y < f.h; y++) for (const x of xs) f.set(x, y, (x === 0 || x === 7 || y === 0 || y === 7) ? m.K : m.M); };
              hood(O(s, 'head', 'top'), [4, 5, 6, 7]); hood(O(s, 'head', 'back'), [0, 1, 2, 3]);
              flat(O(s, 'head', 'left'), m.K, m.M);
              O(s, 'head', 'back').rect(3, 0, 1, 7, m.Z).rect(4, 0, 1, 7, m[6]);
              P(O(s, 'body', 'front'), ['........', '........', '........', '........', '.555LLL.'], m);
            },
            finish: (s, m) => {
              // arms crossed over: right arm black, left arm teal; shoes swapped too
              for (const f of s.sides('rightArm')) { flat(f, m.K, m.L, { y1: 8, bottom: false }); f.row(9, m.u); }
              flat(I(s, 'rightArm', 'top'), m.K, m.L);
              for (const f of s.sides('leftLeg')) flat(f, m.K, m.Z, { y0: 8, y1: 11 });
              P(I(s, 'leftLeg', 'front'), ['....', '....', '....', '....', '....', '....', '....', '....', '....', '2222', '....', 'ZZZZ'], m);
            }
          })
        }
      ]
    },
    {
      title: 'Suited for Battle',
      note: 'The arena got rougher, so three fighters gear up: iron under the zip, a hazard harness over the hood and a thick knit scarf against the cold.',
      skins: [
        {
          name: 'Iron Zip',
          story: 'He wears his iron chestplate under an open zip hoodie, pushes the hood back before every duel and still has the scar from the first one he lost.',
          build: kit => fighter(kit, {
            hoodUp: false,
            skin: '#8d5a3a', eyes: '#2a1a10', hoodie: '#55657a', hood: '#62748a', pants: '#3a3e46', shoes: '#9aa0a8',
            accent: '#cfd4da', cuff: '#cfd4da', hair: '#3a2416', mouth: '#4a2a1c',
            colors: { G: '#7e858e', I: '#c3c8ce', l: '#e6e9ec', R: '#5a6068', L: '#c88a72' },
            face: ['HHHHHHHH', 'HhHHHhHH', 'abbccbLa', 'aweccewa', 'acccccLa', 'accnncca', 'accrrcca', 'assssssa'],
            inner: (s, m) => {
              // short hair
              for (const f of ['right', 'left']) P(I(s, 'head', f), f === 'right'
                ? ['HHHHHHHH', 'HHHHHHHh', 'HHHHHh..', 'HHHH....'] : ['HHHHHHHH', 'hHHHHHHH', '..hHHHHH', '....HHHH'], m);
              P(I(s, 'head', 'back'), ['HHHHHHHH', 'HHHHHHHH', 'HhHHhHHH', 'HHHHHHHH', 'hHHHHHHh'], m);
              flat(I(s, 'head', 'top'), m.h, m.H);
              // open zip over an iron chestplate
              P(I(s, 'body', 'front'), ['22GIIG22', '2lGIIGl2', '2lIllIl2', '2lIIIIl2', '2lRIIRl2', '2lGIIGl2', '2lIIIIl2', '2lRIIRl2', '2lIIIIl2', '2lGGGGl2', '2lkkkkl2', '11kkkk11'], m);
              // iron knee plates and iron-toed boots
              for (const f of s.sides('rightLeg')) f.paint(['....', '....', '....', '....', 'GIIG', 'GGGG'], m);
            },
            outer: (s, m) => {
              hoodDown(s, m);
              P(O(s, 'body', 'front'), ['44....44', '.2....2.', '.2....2.', '.2....2.', '.2....2.', '.2....2.', '.2....2.', '.2....2.', '.2....2.', '.2....2.', '.2....2.', '11....11'], m);
              // hair volume
              P(O(s, 'head', 'front'), ['HH.HHH.H'], m);
              P(O(s, 'head', 'top'), ['H.H.HH.H', '.H.H..H.', 'H..H.H.H', '.H..H...', '..H...H.', '.H.H.H..', 'H....H.H', '.H.H..H.'], m);
              for (const f of ['right', 'left']) P(O(s, 'head', f), ['HHH.HHHH'], m);
              P(O(s, 'head', 'back'), ['HHHHHHHH', 'H.HH.HH.'], m);
              // pauldrons and knee guards
              P(O(s, 'rightArm', 'top'), ['GIIG', 'IllI', 'IllI', 'GIIG'], m);
              for (const f of s.sides('rightArm', 'outer')) P(f, ['IlII', 'GIIG', 'RGGR'], m);
              for (const f of s.sides('rightLeg', 'outer')) { f.row(4, m.I); f.row(8, m.G); }
            }
          })
        },
        {
          name: 'Hazard Runner',
          story: 'Strapped into a hazard-orange harness with goggles over his eyes, he is the courier who always gets through the warzone.',
          build: kit => fighter(kit, {
            skin: '#c68e62', hoodie: '#26282e', hood: '#30333a', pants: '#545a3c', shoes: '#1e1f23',
            accent: '#ff8a1e', cuff: '#ff8a1e', hair: '#141416',
            colors: { S: '#3a3d44', D: '#1a1b1f', O: '#ff8a1e', o: '#c0600e', L: '#ffd34a', B: '#a8adb4', K: '#121214' },
            face: win(['cccc', 'KKKK', 'LKKL', 'SSSS', 'SDSS', 'SSSS']),
            hoodFront: ['44444444', '45hhhh54', '45....54', 'KK....KK', 'KL....LK', '45....54', '4SSSSSS4', '4SSSSSS4'],
            inner: (s, m) => {
              // X harness with a buckle, strap bands on the sleeves, gloves
              P(I(s, 'body', 'front'), ['Ou....uO', '.O....O.', '..O..O..', '...BB...', '...BB...', '..O..O..', '.O....O.', 'O......O', '........', 'oooooooo', 'OOOBBOOO', 'oooooooo'], m);
              P(I(s, 'body', 'back'), ['O......O', '.O....O.', '..O..O..', '...OO...', '...OO...', '..O..O..', '.O....O.', 'O......O', '........', 'oooooooo', 'OOOOOOOO', 'oooooooo'], m);
              for (const f of s.sides('rightArm')) f.row(3, m.O).row(4, m.o).row(10, m.K).row(11, m.K);
              flat(I(s, 'rightArm', 'bottom'), m.K, m.D);
              // cargo pockets, black boots with orange laces
              P(I(s, 'rightLeg', 'right'), ['....', '....', '.oo.', '7887', '7887', '7777', '....', '....'], m);
              P(I(s, 'rightLeg', 'front'), ['....', '....', '....', '....', '....', '....', '....', '....', 'xxxx', 'xOxO', 'OxOx', 'xxxx'], m);
            },
            outer: (s, m) => {
              // goggle strap round the hood, harness and pockets standing out
              for (const f of ['right', 'left', 'back']) P(O(s, 'head', f), ['........', '........', '........', 'KKKKKKKK', '........', '........', '........', '........'], m);
              P(O(s, 'body', 'front'), ['O......O', '........', '........', '...BB...', '...BB...', '........', '........', '........', '........', '........', 'OOOBBOOO', '........'], m);
              for (const f of s.sides('rightArm', 'outer')) f.row(3, m.O);
              P(O(s, 'rightLeg', 'right'), ['....', '....', '.oo.', '7887', '7887', '7777', '....', '....', '....', '....', '....', '....'], m);
            }
          })
        },
        {
          name: 'Frost Wrap',
          story: 'She fights in the snow biome with a fur-trimmed hood and a scarf so long it trails behind her like a red flag.',
          build: kit => fighter(kit, {
            skin: '#f4d2b4', eyes: '#3a74c8', hoodie: '#2f6c8a', hood: '#3a7c9c', pants: '#22324a', shoes: '#6a4a32',
            accent: '#efe6d6', cuff: '#c8363a', hair: '#e8c070', mouth: '#b06060',
            colors: { R: '#c8363a', Q: '#8e2226', W: '#f2e8d8', F: '#efe6d6', f: '#d4c8b4', p: '#f0a0a0' },
            face: win(['HjHH', 'cccc', 'ecce', 'pccp', 'crrc', 'RRRR']),
            hoodFront: ['44444444', '4FfFFfF4', '4F....F4', '4f....f4', '4F....F4', '4F....F4', '4f....f4', '4RRRRRR4'],
            inner: (s, m) => {
              // scarf round the neck, a long striped end hanging down the front
              s.band('body', 0, m.R); s.band('body', 1, m.W);
              P(I(s, 'body', 'front'), ['RRRRRRRR', 'WWWWWWWW', '.....RR.', '.....WW.', '.....RR.', '.....WW.', '.....RR.', '.....WW.', '.....RR.', '.....F.F', '........', '........'], m);
              // knit mittens
              for (const f of s.sides('rightArm')) f.row(9, m.R).row(10, m.R).row(11, m.Q);
              flat(I(s, 'rightArm', 'bottom'), m.Q, m.R);
              // snow boots with fur cuffs
              for (const f of s.sides('rightLeg')) f.row(7, m.f).row(8, m.F);
              I(s, 'rightLeg', 'front').row(9, m.y);
            },
            outer: (s, m) => {
              P(O(s, 'body', 'front'), ['RRRRRRRR', 'WWWWWWWW', '....RRR.', '.....WW.', '.....RR.', '.....WW.', '.....RR.', '.....WW.', '.....RR.', '.....F.F', '........', '........'], m);
              for (const f of ['right', 'left', 'back']) P(O(s, 'body', f), f === 'back' ? ['RRRRRRRR', 'WRRWWRRW', '..RR....', '..WW....', '..RR....', '...F....'] : ['RRRR', 'WWWW'], m);
              for (const f of ['right', 'left']) P(O(s, 'head', f), ['........', '........', '........', '........', '........', '........', '........', 'RRRRRRRR'], m);
              for (const f of s.sides('rightArm', 'outer')) f.row(9, m.W);
              for (const f of s.sides('rightLeg', 'outer')) f.row(8, m.F);
            }
          })
        }
      ]
    },
    {
      title: 'Loud Prints',
      note: 'Plain hoodies are out: a tie-dye storm, a giant crossed-swords print and a hoodie that fades from coal to flame.',
      skins: [
        {
          name: 'Tie-Dye Tempest',
          story: 'She dyed her hoodie in a bucket of every colour she could craft and fights with a grin as loud as her clothes.',
          build: kit => fighter(kit, {
            hoodUp: false,
            skin: '#6b4430', eyes: '#2a1810', hoodie: '#9a5aff', hood: '#ff4fa0', pants: '#6f8fb8', shoes: '#f2f2f2',
            accent: '#ff4fa0', cuff: '#ffd23a', hair: '#24160f', mouth: '#3a1a10',
            colors: { T: '#f6f2ea', B: '#ff4fa0', Y: '#ffd23a', U: '#3ad0ff', V: '#9a5aff', d: '#4a6a94', q: '#a8c0dc' },
            face: ['HHHHHHHH', 'HHHHHHHH', 'Hbbccbbh', 'aweccewa', 'acccccca', 'accnncca', 'acrTTrca', 'aacrrcaa'],
            inner: (s, m) => {
              const dye = [m.B, m.Y, m.U, m.V];
              tieDye(I(s, 'body', 'front'), dye, 3.5, 4.5); tieDye(I(s, 'body', 'back'), dye, 3.5, 4.5, 0.5, 3);
              for (const f of ['right', 'left', 'top', 'bottom']) tieDye(I(s, 'body', f), dye, 1.5, 2, 0.4, 1);
              P(I(s, 'body', 'front'), ['..T..T..', '..T..T..'], m);
              for (const f of s.sides('rightArm')) for (let y = 0; y < 9; y++) f.row(y, dye[Math.floor(y / 2 + (f.face === 'front' ? 0 : 1)) % 4]);
              flat(I(s, 'rightArm', 'top'), m.V, m.B);
              // big curly hair
              flat(I(s, 'head', 'top'), m.h, m.H);
              for (const f of ['right', 'left', 'back']) P(I(s, 'head', f), ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHhHHhHH'], m);
              // ripped light jeans
              for (const f of s.sides('rightLeg')) flat(f, m.d, m[8], { y1: 7, top: false });
              P(I(s, 'rightLeg', 'front'), ['.qq.', '.qq.', '.qq.', '.qq.', 'TqTq', 'qTqT', '.qq.', '....', '....', 'BYUV', '....', '....'], m);
            },
            outer: (s, m) => {
              hoodDown(s, m);
              const dye = [m.B, m.Y, m.U, m.V];
              tieDye(O(s, 'body', 'top'), dye, 3.5, 1.5, 0.4, 1);
              // afro volume and a pink sweatband
              P(O(s, 'head', 'top'), ['HHHHHHHH', 'HjHHjHHH', 'HHHHHHjH', 'HHjHHHHH', 'HHHHjHHH', 'HjHHHHHH', 'HHHHHjHH', 'HHHHHHHH'], m);
              P(O(s, 'head', 'front'), ['HHHHHHHH', 'BBBBBBBB', 'H......H'], m);
              for (const f of ['right', 'left']) P(O(s, 'head', f), ['HHHHHHHH', 'BBBBBBBB', 'HHHHHHHH', 'HHHHHHH.', 'HHHHHH..', 'HHHH.H..'].map(r => f === 'left' ? [...r].reverse().join('') : r), m);
              P(O(s, 'head', 'back'), ['HHHHHHHH', 'BBBBBBBB', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HhHHhHHh', '.H.HH.H.'], m);
            }
          })
        },
        {
          name: 'Twin Blade',
          story: 'Two crossed swords on his chest and one down his back: he wears the duel he has never lost.',
          build: kit => fighter(kit, {
            skin: '#c99a6e', eyes: '#3a2014', hoodie: '#e6e6ea', hood: '#f2f2f4', pants: '#1e1e24', shoes: '#c0242c',
            accent: '#f2f2f2', cuff: '#c0242c', hair: '#141414', mouth: '#6a3a2a',
            colors: { R: '#c0242c', Q: '#801820', S: '#b8c0ca', K: '#33363e', G: '#e8b83a', g: '#8a5a2a', W: '#f6ecd8' },
            face: win(['HhHH', 'bccb', 'ecce', 'cWnc', 'crrc', 'aaaa']),
            hoodFront: ['44444444', '4RhHhHR4', '4R....R4', '4R....R4', '4R....R4', '4R....R4', '4R....R4', '4R....R4'],
            inner: (s, m) => {
              // crossed swords print (S blades, Q outline, G guards, g grips)
              P(I(s, 'body', 'front'), ['11111111', 'K.2..2.K', 'SK2..2KS', '.SK..KS.', '..SKKS..', '...KK...', '..K..K..', 'GGG..GGG', 'R......R', '........', '........', '11111111'], m);
              P(I(s, 'body', 'back'), ['....S...', '...QSQ..', '...QSQ..', '...QSQ..', '...QSQ..', '...QSQ..', '..GGGGG.', '....g...', '....g...', '....G...', '........', '11111111'], m);
              // red sleeve stripes and red high-tops
              for (const f of s.sides('rightArm')) f.row(2, m.R).row(4, m.R);
              for (const f of s.sides('rightLeg')) f.row(7, m.Q);
              I(s, 'rightLeg', 'front').row(9, m.W);
            },
            outer: (s, m) => {
              P(O(s, 'body', 'front'), ['........', 'K......K', '.K....K.', '..K..K..', '...KK...', '........', '........', '........', '........', '........', '........', '........'], m);
              for (const f of s.sides('rightLeg', 'outer')) f.row(7, m.R);
            }
          })
        },
        {
          name: 'Ember Fade',
          story: 'His hoodie burns from coal at the shoulders to flame at the hem, and in the shadow of his hood only two embers glow.',
          build: kit => fighter(kit, {
            skin: '#7a5038', hoodie: '#1c1c22', hood: '#202026', pants: '#18181c', shoes: '#18181c',
            accent: '#ff7a1a', cuff: '#ff7a1a', hair: '#101012',
            colors: { D: '#121216', E: '#ffb02a', e: '#ff6a1a', Y: '#ffd84a', X: '#ff5a14', Z: '#a82a14' },
            face: win(['DDDD', 'DDDD', 'EDDE', 'DDDD', 'aDDa', 'aaaa']),
            hoodFront: ['44444444', '45....54', '45....54', '45....54', '45....54', '45....54', '45....54', '45....54'],
            inner: (s, m) => {
              const kit = { mix: (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)).concat(255) };
              const stops = [m[2], m[2], m.Z, m.X, m.Y];
              for (const f of s.faces('body')) {
                if (f.face === 'top' || f.face === 'bottom') continue;
                for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
                  const c = fadeAt(kit, stops, y / (f.h - 1));
                  f.set(x, y, (x === 0 || x === f.w - 1 || y === f.h - 1) ? mul(c, 0.75) : c);
                }
              }
              for (const f of s.sides('rightArm')) for (let y = 0; y < 9; y++) for (let x = 0; x < 4; x++) {
                const c = fadeAt(kit, stops, y / 8);
                f.set(x, y, (x === 0 || x === 3) ? mul(c, 0.75) : c);
              }
              flat(I(s, 'body', 'bottom'), m.Z, m.X);
              // ember sparks rising, drawstrings in flame colour
              P(I(s, 'body', 'front'), ['..e..e..', '..e..e..', '.Y......', '......E.', '...E....', '........', '.......E', '........', '........', '........', '........', '........'], m);
              // flame soles
              for (const f of s.sides('rightLeg')) f.row(10, m.X).row(11, m.Y);
              I(s, 'rightLeg', 'front').row(9, m.x);
            },
            outer: (s, m) => {
              for (const f of s.sides('rightLeg', 'outer')) f.row(10, m.X);
            }
          })
        }
      ]
    }
  ]
};
