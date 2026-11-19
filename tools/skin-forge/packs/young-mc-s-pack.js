// Young MC's Pack (Fresh Youth Slim Pack): 16 slim streetwear kids. The pack's look, measured from the
// textures: soft edge-darkened faces (no brows, white eye + dark pupil looking inwards, a two-pixel nose
// shadow and a faint mouth), tidy hair on the inner layer with a swept fringe and a round crown on the
// overlay, a plain tee with a small chest motif, short sleeves with a dark cuff over bare arms, plain
// trousers and coloured shoes. Shading is column based: dark outer columns, light middle. The overlay is
// almost only hair (90–94 % transparent) → style 'hair'.
// The old skins are all the same tee in different colours, so every new kid gets a real outfit idea:
// a jacket, a knit, headwear, a print, shorts, socks, a tied flannel. All slim (3 px arms).

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const flip = rows => rows.map(r => [...r].reverse().join(''));

// Rows for a w-wide face from segments: [[char | row, count], …]
const stack = (segs, w = 4) => segs.flatMap(([v, n]) => Array(n).fill(v.length === 1 ? v.repeat(w) : v));

// The pack's head, painted from its own textures (C edge, D dark, F base, H light skin; G nose, m mouth,
// W eye white, P pupil). Side rows are for the right face: column 0 = back edge, column 7 = front edge.
const HEAD = {
  front: ['CDFFFFDC', 'CDFHHFDC', 'DFFHHFFD', 'DWPHHPWD', 'DFFGGFFD', 'DFFHHFFD', 'CDFmmFDC', 'CDDFFDDC'],
  side: ['CCDDDDCC', 'CDFFFFDC', 'CDFFFFDC', 'CDFFHFDC', 'CDFFHFDC', 'CDFFFFDC', 'CDDFFDDC', 'CCDDDDCC'],
  top: ['CCDDDDCC', 'CDFFFFDC', 'CDFHHFDC', 'CDFHHFDC', 'CDFHHFDC', 'CDFFFFDC', 'CDFFFFDC', 'CCDDDDCC'],
  bottom: ['CCDDDDCC', 'CDDFFDDC', 'CDFFFFDC', 'CDFGGFDC', 'CDDFFDDC', 'CCDDDDCC', 'CCCDDCCC', 'CCCCCCCC']
};

// Hair styles (A darkest, B dark, E base, L light). I = inner, O = overlay. Top face: row 0 = back, row 7 = front.
const HAIR = {
  swoop: { // the pack's own cut: swept fringe, round crown
    I: { top: ['AABBBBAA', 'ABBEEBBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEBBA', 'ABBEEBAA', 'AABBBBAA', 'AAABBAAA'], front: ['ABBEEBBA', 'ABEEEEBA'], side: ['ABBEEBBA', 'ABEEEEBA', 'ABE.....', 'AB......'], back: ['ABBEEBBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABBEEBBA'] },
    O: { top: ['..BEBE..', '.BEEEEB.', 'BEEEEEEB', 'ABEEEEBA', 'BEEEEEEB', 'ABEEEEBA', '.BEBBEB.', '..ABBA..'], front: ['ABEEEEBA', 'ABE..EBA', 'AB....B.'], side: ['ABEEB...', 'ABEB....', 'ABB.....', '.A......'], back: ['ABEEEEBA', 'ABEEEEBA', '.ABEEBA.', '..ABBA..'] }
  },
  messy: { // untidy, strands sticking out everywhere
    I: { top: ['ABEBBEBA', 'BEEBEEBE', 'EBEEBEEB', 'BEEBEEBE', 'EBEEBEEB', 'BEEBEEBE', 'EBEEBEEB', 'ABEBBEBA'], front: ['ABEBEBEA', 'AB.E.BEA'], side: ['ABEBEBEA', 'ABEEBEBA', 'ABEB....', 'AB......'], back: ['ABEBEBEA', 'ABEEBEBA', 'ABEBEEBA', 'ABEEBEBA', 'A.BB.BBA'] },
    O: { top: ['B.E.EB.E', '.EBE.E.B', 'EBELBEEB', '.EEBEE.E', 'EBEEEBLB', 'B.EEBE.E', '.E.BE.E.', 'E.B.E.B.'], front: ['EBE.EBEB', 'B.E..E.B'], side: ['EBEBEBEB', 'B.E.B...', '.B......'], back: ['BEBEEBEB', 'EBEBBEBE', '.B.EB.B.'] }
  },
  long: { // long hair with a middle part, down to the shoulders
    I: { top: ['ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEBBEBA', 'ABEBBEBA', 'AEEBBEEA'], front: ['AEEBBEEA', 'AE....EA', 'A......A', 'A......A'], side: ['ABBEEBBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEB.', 'ABEEEBB.', 'ABEEEB..', 'ABEEEB..', 'ABEEBB..'], back: ['ABBEEBBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEELEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABBEEBBA', 'AABBBBAA'] },
    O: { top: ['.BEEEEB.', 'BEEEEEEB', 'BEELEEEB', 'BEEEEEEB', 'BEEEELEB', 'BEEBBEEB', 'BEEBBEEB', '.EB..BE.'], front: ['EEB..BEE', 'EB....BE', 'E......E', 'B......B', 'A......A'], side: ['BEEEB...', 'BEEB....', 'BEB.....', 'BEB.....', 'BE......', 'B.......'], back: ['BEEEEEEB', 'BEEEEEEB', 'BEEBBEEB', 'BEEEEEEB', 'BEBEEBEB', '.B.BB.B.'] }
  },
  curtain: { // chin-length curtain bangs
    I: { top: ['AABBBBAA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEBBEBA', 'AEBAABEA', 'AEBAABEA'], front: ['AEEBBEEA', 'EEB..BEE', 'E......E'], side: ['ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEB..', 'ABEEB...', '.ABB....'], back: ['ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', '.ABBBBA.'] },
    O: { top: ['..BEEB..', '.BEEEEB.', 'BEELEEEB', 'BEEEEEEB', 'BEEEELEB', 'BEEBBEEB', '.EB..BE.', '..B..B..'], front: ['EEB..BEE', 'EB....BE', 'B......B', 'E......E'], side: ['BEEB....', 'BEB.....', '.B......', 'BB......'], back: ['BEEEEEEB', '.BEEEEB.', '..BEEB..', '...BB...'] }
  },
  buns: { // two space buns and a neat middle part
    I: { top: ['AEEBBEEA', 'AEEBBEEA', 'AEEBBEEA', 'AEEBBEEA', 'AEEBBEEA', 'AEEBBEEA', 'AEEBBEEA', 'AEEBBEEA'], front: ['EEEBBEEE', 'EB....BE'], side: ['ABEEEEBA', 'ABEEEEBA', 'ABEEEE..', 'ABEE....', 'AB......'], back: ['ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABBBBBBA', '.AAAAAA.'] },
    O: { top: ['........', 'BEB..BEB', 'ELE..ELE', 'EEB..BEE', 'BB....BB', '........', '........', '........'], front: ['EEB..BEE'], side: ['.BEEB...'], back: ['.BB..BB.'] }
  },
  wavy: { // shaggy surfer hair over the ears
    I: { top: ['ABEEEEBA', 'ABELEEBA', 'ABEEEEBA', 'ABEEELBA', 'ABEEEEBA', 'ABELEEBA', 'ABEEEEBA', 'AEEBEEBA'], front: ['AEEBEEBA', 'BE.EB.EB'], side: ['ABEEEEBA', 'ABEEEEBA', 'ABEEEBE.', 'ABEEB.B.', 'AB.B....'], back: ['ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABEBEEBA', 'ABEBBEBA', '.B.BB.B.'] },
    O: { top: ['.BEEEEB.', 'BEELEEEB', 'BELEEEEB', 'BEEEEEEB', 'BEEEELEB', 'BEEEEEEB', 'BEEEEEEB', '.EB.EB.E'], front: ['EEBEEBEE', '........', 'E......E'], side: ['BEEBEEB.', 'BEB.EB..', 'B.B.....', '.B......'], back: ['BEEEEEEB', 'EBEEBEEB', 'B.EB.EB.', '.B..B..B'] }
  },
  fade: { // short coils on top, faded sides
    I: { top: ['ABBBBBBA', 'ABEBEEBA', 'ABEEBEBA', 'ABEBEEBA', 'ABEEBEBA', 'ABEBEEBA', 'ABEEBEBA', 'ABBEEBBA'], front: ['ABBEEBBA'], side: ['ABEEEEBA', 'AABBBBA.', '.A......'], back: ['ABEEEEBA', 'ABEEEEBA', 'AABBBBAA', '.AAAAAA.'] },
    O: { top: ['..B..B..', '.B.EB.B.', 'B.E.E.EB', '.EBE.EB.', 'B.E.EB.B', '.B.E.B..', '..B.B...', '........'] }
  },
  under: { // short hair that sits under a hat
    I: { top: Array(8).fill('ABEEEEBA'), front: ['ABEEEEBA'], side: ['ABEEEEBA', 'ABEEEEBA', 'ABE.....', 'AB......'], back: ['ABEEEEBA', 'ABEEEEBA', 'ABEEEEBA', 'ABBEEBBA'] },
    O: {}
  }
};

// The builder. o: { seed, skin, hair: { color, style, overlay: false }, eyes, lashes, glasses, mats,
//   body: { front, back, side }, arm: { front, side, outer?, inner?, back? }, leg: { front, side, outer?, back? },
//   inner(s, h), over(s, h) before mirroring; finish(s, h) after. h = helpers (ramp access, overlay maps).
function youth({ Skin, color }, o) {
  const { hex, mix } = color;
  const s = new Skin({ slim: true });
  const mul = (c, f) => [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(c[i] * f)))).concat(255);
  const ramp = c => { const b = hex(c); return [mul(b, 0.6), mul(b, 0.75), mul(b, 0.88), b, mix(mul(b, 1.13), '#ffffff', 0.06)]; };
  const mats = { s: ramp(o.skin) };
  for (const [k, v] of Object.entries(o.mats || {})) mats[k] = ramp(v);

  // Column shading like the pack: dark outer columns, light middle.
  const idx = (f, x) => {
    const w = f.w, ex = Math.min(x, w - 1 - x);
    let i = w >= 8 ? [1, 2, 3, 3][Math.min(ex, 3)] : w === 4 ? [1, 2, 3, 2][x] : [1, 3, 2][x];
    if (f.face === 'top') i = Math.min(4, i + 1);
    if (f.face === 'bottom') i = Math.max(0, i - 1);
    return i;
  };
  const paint = (f, rows) => {
    if (rows.length > f.h) throw new Error(`${f.part}.${f.face}: ${rows.length} rows > ${f.h}`);
    rows.forEach((r, y) => {
      if (r.length !== f.w) throw new Error(`${f.part}.${f.face} row ${y}: "${r}" is ${r.length} wide, face is ${f.w}`);
      [...r].forEach((ch, x) => {
        if (ch === '.') return;
        const m = mats[ch];
        if (!m) throw new Error(`no material "${ch}" (${f.part}.${f.face})`);
        f.set(x, y, m[idx(f, x)]);
      });
    });
  };
  const fillRows = (f, ch) => Array(f.h).fill(ch.repeat(f.w));

  // ── Head ──
  const SK = hex(o.skin);
  const hc = hex(o.hair?.color || '#2a1a12');
  const headMap = {
    C: mul(SK, 0.725), D: mul(SK, 0.875), F: SK, H: mix(mul(SK, 1.12), '#ffffff', 0.04), G: mul(SK, 0.785), m: mul(SK, 0.64),
    W: hex('#ebebf0'), P: hex(o.eyes || '#140f19'),
    A: mul(hc, 0.45), B: mul(hc, 0.7), E: hc, L: mix(mul(hc, 1.2), '#ffffff', 0.1),
    k: hex(o.glasses || '#1e1418')
  };
  const hp = (face, rows, layer = 'inner') => s.face('head', face, layer).paint(rows, headMap);
  hp('front', HEAD.front); hp('right', HEAD.side); hp('left', flip(HEAD.side)); hp('back', HEAD.side); hp('top', HEAD.top); hp('bottom', HEAD.bottom);
  if (o.lashes) hp('front', ['........', '........', '.A....A.']);
  if (o.hair) {
    const st = HAIR[o.hair.style || 'swoop'];
    const { I, O } = st;
    if (I.top) hp('top', I.top); if (I.front) hp('front', I.front);
    if (I.side) { hp('right', I.side); hp('left', flip(I.side)); }
    if (I.back) hp('back', I.back);
    if (o.hair.overlay !== false) {
      if (O.top) hp('top', O.top, 'outer'); if (O.front) hp('front', O.front, 'outer');
      if (O.side) { hp('right', O.side, 'outer'); hp('left', flip(O.side), 'outer'); }
      if (O.back) hp('back', O.back, 'outer');
    }
  }
  if (o.glasses) { // round frames, with a 3D rim on the overlay
    s.face('head', 'front').paint(['.kk..kk.', 'k..kk..k', '.kk..kk.'], headMap, { y: 2 });
    for (const f of ['right', 'left']) hp(f, [f === 'right' ? '......kk' : 'kk......'], 'inner');
  }

  // ── Body, arms, legs ──
  const B = o.body;
  paint(s.face('body', 'front'), B.front);
  paint(s.face('body', 'back'), B.back || B.front);
  paint(s.face('body', 'right'), B.side);
  paint(s.face('body', 'left'), flip(B.side));
  paint(s.face('body', 'top'), Array(4).fill(B.side[0][0].repeat(8)));
  paint(s.face('body', 'bottom'), Array(4).fill(B.front[11][0].repeat(8)));

  const A = o.arm;
  paint(s.face('rightArm', 'front'), A.front);
  paint(s.face('rightArm', 'back'), A.back || A.front);
  paint(s.face('rightArm', 'right'), A.outer || A.side);
  paint(s.face('rightArm', 'left'), A.inner || A.side);
  paint(s.face('rightArm', 'top'), Array(4).fill(A.front[0][1].repeat(3)));
  paint(s.face('rightArm', 'bottom'), Array(4).fill(A.front[11][1].repeat(3)));

  const Lg = o.leg;
  paint(s.face('rightLeg', 'front'), Lg.front);
  paint(s.face('rightLeg', 'back'), Lg.back || Lg.side);
  paint(s.face('rightLeg', 'right'), Lg.outer || Lg.side);
  paint(s.face('rightLeg', 'left'), Lg.inner || Lg.side);
  paint(s.face('rightLeg', 'top'), Array(4).fill(Lg.side[0][1].repeat(4)));
  paint(s.face('rightLeg', 'bottom'), Array(4).fill(Lg.front[11][1].repeat(4)));

  // Helpers for the details: c('r') base colour, c('r', 4) highlight …; map('rk') → { r: …, k: … }
  const c = (k, i = 3) => (mats[k] || [])[i] ?? headMap[k];
  const map = (keys, i = 3) => Object.fromEntries([...keys].map(k => [k, c(k, i)]));
  const h = { s, c, map, mats, headMap, paint, fillRows, color };
  if (o.inner) o.inner(s, h);
  if (o.over) o.over(s, h);
  s.mirrorLimbs();
  if (o.finish) o.finish(s, h);
  return s;
}

// Tie-dye spiral: rows of colour keys around a centre.
function spiral(w, h, keys, { cx = (w - 1) / 2, cy = (h - 1) / 2, turns = 0.22, offset = 0 } = {}) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const a = Math.atan2(y - cy, x - cx) / (2 * Math.PI) + 1;
      const v = (a + Math.hypot(x - cx, y - cy) * turns + offset) % 1;
      r += keys[Math.floor(v * keys.length) % keys.length];
    }
    rows.push(r);
  }
  return rows;
}

const SIDES4 = ['front', 'right', 'left', 'back'];

// ── Updates ───────────────────────────────────────────────────────────────────────────────────

export default {
  style: 'hair',
  updates: [
    {
      title: 'Back to School Fits',
      note: 'The first bell rings and the crew shows up in their best school-day layers: a cherry varsity jacket, a cosy knit with big headphones and a green flannel tied around the waist.',
      skins: [
        {
          name: 'Cherry Varsity', slim: true,
          story: 'She cheers louder than anyone in the bleachers, so the school gave her a cherry varsity jacket with a cream star on the chest to prove it.',
          build: kit => youth(kit, {
            skin: '#ecc4a0', hair: { color: '#3c2418', style: 'long' }, eyes: '#4a2a1a', lashes: true,
            mats: { r: '#b3202e', k: '#6a1420', w: '#efe4c8', S: '#f8f0dc', c: '#e8dcbc', j: '#2e4a7a', J: '#5878ac', n: '#f2f2f2', g: '#b4b4ba' },
            body: {
              front: ['rwkwwkwr', 'rrkwwkrr', 'rrrSrrrr', 'rSSSSSrr', 'rrSSSrrr', 'rrSrSrrr', 'rrrrrrrr', 'rrrrrrrr', 'wwwwwwww', 'kkkkkkkk', 'jjjjjjjj', 'jjjjjjjj'],
              back: ['rwkwwkwr', 'rrrwwrrr', 'rrrSSrrr', 'rSSSSSSr', 'rrSSSSrr', 'rrSrrSrr', 'rrrrrrrr', 'rrrrrrrr', 'wwwwwwww', 'kkkkkkkk', 'jjjjjjjj', 'jjjjjjjj'],
              side: stack([['w', 1], ['r', 7], ['w', 1], ['k', 1], ['j', 2]])
            },
            arm: { front: stack([['c', 8], ['k', 1], ['w', 1], ['s', 2]], 3), side: stack([['c', 8], ['k', 1], ['w', 1], ['s', 2]]) },
            leg: { front: stack([['j', 8], ['J', 1], ['n', 2], ['g', 1]]), side: stack([['j', 8], ['J', 1], ['n', 2], ['g', 1]]) },
            over: (s, { map, headMap }) => {
              s.face('body', 'front', 'outer').paint(['ww....ww'], map('w', 4));
              s.face('body', 'back', 'outer').paint(['BEEEEEEB', '.BEBBEB.'], headMap);
            }
          })
        },
        {
          name: 'Mocha Beats', slim: true,
          story: 'He walks to class with his mint headphones on and his knit sleeves pulled over his hands, nodding along to beats only he can hear.',
          build: kit => youth(kit, {
            skin: '#eec39c', hair: { color: '#1c1410', style: 'messy' }, eyes: '#2a1a12',
            mats: { m: '#7c5238', M: '#9c6c4a', d: '#4e3222', N: '#f2e6cc', p: '#e2d8c0', P: '#c4b89e', b: '#4a3020', g: '#e8e0cc' },
            body: {
              front: ['mddssddm', 'mmmddmmm', 'mmmmmmmm', 'mmNNNNmm', 'mmNmmNmm', 'mmNmmNmm', 'mNNmNNmm', 'mNNmNNmm', 'mmmmmmmm', 'dmdmdmdm', 'dmdmdmdm', 'pppppppp'],
              back: ['mddddddm', ...[1, 2, 3, 4, 5, 6, 7, 8].map(y => 'm' + (y % 2 ? 'Md' : 'dM') + 'mm' + (y % 2 ? 'dM' : 'Md') + 'm'), 'dmdmdmdm', 'dmdmdmdm', 'pppppppp'],
              side: stack([['m', 9], ['dmdm', 2], ['p', 1]])
            },
            arm: {
              front: stack([['m', 1], ['mMm', 1], ['m', 1], ['mMm', 1], ['m', 1], ['mMm', 1], ['m', 1], ['mMm', 1], ['m', 1], ['dmd', 2], ['s', 1]], 3),
              side: stack([['m', 1], ['mMmm', 1], ['m', 1], ['mMmm', 1], ['m', 1], ['mMmm', 1], ['m', 1], ['mMmm', 1], ['m', 1], ['dmdm', 2], ['s', 1]])
            },
            leg: { front: stack([['ppPp', 9], ['b', 2], ['g', 1]]), side: stack([['p', 9], ['b', 2], ['g', 1]]) },
            over: (s, { color }) => { // over-ear headphones: band across the crown, mint cups on the ears
              const k = color.hex('#26262c'), K = color.hex('#3c3c46'), C = color.hex('#6ad6bc'), q = color.hex('#3a9a86');
              s.face('head', 'top', 'outer').paint(['........', '........', '........', 'KKKKKKKK', 'kkkkkkkk'], { k, K });
              const cup = ['...Kk...', '...Kk...', '..kkkk..', '.kCCCCk.', '.kCqqCk.', '.kCCCCk.', '..kkkk..'];
              s.face('head', 'right', 'outer').paint(cup, { k, K, C, q });
              s.face('head', 'left', 'outer').paint(flip(cup), { k, K, C, q });
            }
          })
        },
        {
          name: 'Plaid Wrap', slim: true,
          story: 'She never actually wears her green flannel, she just knots it around her waist and pushes up her round glasses whenever she has a better idea.',
          build: kit => youth(kit, {
            skin: '#f2cfae', hair: { color: '#a8481e', style: 'curtain' }, eyes: '#2e6a3e', lashes: true, glasses: '#5a3420',
            mats: { t: '#eeeee6', T: '#c8c8be', p: '#ec7a36', R: '#3a7ac8', g: '#3a7a46', G: '#1c3222', y: '#d8c050', K: '#244a2c', j: '#86a6d0', J: '#6684b4', n: '#222228', o: '#f0f0f0', b: '#e05a8a' },
            body: {
              front: ['tttssttt', 'tttttttt', 'ttpppptt', 'tpppppRR', 'tppRRRpt', 'RRRppppt', 'ttpppptt', 'gGgKKgGg', 'yGyKKyGy', 'gGgKKgGg', 'jjjgGjjj', 'jjjgGjjj'],
              back: ['tttttttt', 'tttttttt', 'tttttttt', 'tttttttt', 'tttttttt', 'gGgggGgg', 'GGGGGGGG', 'gGgggGgg', 'yGyyyGyy', 'gGgggGgg', 'GGGGGGGG', 'gGgggGgg'],
              side: stack([['t', 7], ['gGgg', 1], ['yGyy', 1], ['gGgg', 1], ['j', 2]])
            },
            arm: { front: stack([['t', 3], ['T', 1], ['s', 5], ['b', 1], ['s', 2]], 3), side: stack([['t', 3], ['T', 1], ['s', 5], ['b', 1], ['s', 2]]) },
            leg: { front: stack([['jjjg', 4], ['j', 5], ['n', 2], ['o', 1]]), side: stack([['j', 9], ['n', 2], ['o', 1]]) },
            over: (s, { map }) => { // the knot stands off the belly
              s.face('body', 'front', 'outer').paint(['...KK...', '..KggK..'], map('Kg'), { y: 7 });
            }
          })
        }
      ]
    },
    {
      title: 'Skatepark Summer',
      note: 'School is out and the crew takes over the skatepark: a kickflip kid in checkerboard shoes, a tie-dye dreamer with sunglasses in his hair and an overall girl with pink space buns.',
      skins: [
        {
          name: 'Checker Flip', slim: true,
          story: 'He has landed exactly one kickflip in his life, but he wears his teal cap backwards and his checker shoes like he lands them every day.',
          build: kit => youth(kit, {
            skin: '#c69466', hair: { color: '#3a2414', style: 'under' }, eyes: '#2a1a10',
            mats: { y: '#e0aa2a', Y: '#a87c18', k: '#1e1e22', w: '#ececec', o: '#6a6a3e', O: '#4c4c2a', b: '#2a2a2e', c: '#1f7a78', x: '#f0f0f0', z: '#1f7a78' },
            body: {
              front: ['yyyssyyy', 'yyyyyyyy', 'yyyyyyyy', 'kwkwkwkw', 'wkwkwkwk', 'yyyyyyyy', 'yyyyyyyy', 'yyyyyyyy', 'bbbbbbbb', 'oooooooo', 'oooooooo', 'oooooooo'],
              back: ['yyyyyyyy', 'yyyyyyyy', 'yyyyyyyy', 'kwkwkwkw', 'wkwkwkwk', 'yyyyyyyy', 'yyyyyyyy', 'yyyyyyyy', 'bbbbbbbb', 'oooooooo', 'oooooooo', 'oooooooo'],
              side: stack([['y', 3], ['kwkw', 1], ['wkwk', 1], ['y', 3], ['b', 1], ['o', 3]])
            },
            arm: { front: stack([['y', 3], ['Y', 1], ['s', 4], ['k', 2], ['s', 2]], 3), side: stack([['y', 3], ['Y', 1], ['s', 4], ['k', 2], ['s', 2]]) },
            leg: {
              front: stack([['o', 4], ['O', 1], ['s', 2], ['z', 1], ['x', 1], ['kwkw', 1], ['wkwk', 1], ['w', 1]]),
              side: stack([['o', 4], ['O', 1], ['s', 2], ['z', 1], ['x', 1], ['kwkw', 1], ['wkwk', 1], ['w', 1]]),
              outer: stack([['o', 1], ['oOOo', 2], ['o', 1], ['O', 1], ['s', 2], ['z', 1], ['x', 1], ['kwkw', 1], ['wkwk', 1], ['w', 1]])
            },
            inner: (s, { paint }) => { // cap crown on the inner head
              paint(s.face('head', 'top'), Array(8).fill('cccccccc'));
              for (const f of SIDES4) paint(s.face('head', f), ['cccccccc']);
            },
            over: (s, { c, headMap }) => { // backwards snapback: strap gap at the front, brim at the back
              const m = { c: c('c'), C: c('c', 1), d: c('c', 0), K: c('k'), E: headMap.E };
              s.face('head', 'top', 'outer').paint(['cccccccc', 'cccccccc', 'cccccccc', 'cccCCccc', 'cccCCccc', 'cccccccc', 'cccccccc', 'cccccccc'], m);
              s.face('head', 'front', 'outer').paint(['cccccccc', 'ccKEEKcc'], m);
              s.face('head', 'right', 'outer').paint(['cccccccc', 'Cccccc..'], m);
              s.face('head', 'left', 'outer').paint(flip(['cccccccc', 'Cccccc..']), m);
              s.face('head', 'back', 'outer').paint(['cccccccc', 'cccccccc', 'CCCCCCCC', 'dddddddd'], m);
            }
          })
        },
        {
          name: 'Tie-Dye Sky', slim: true,
          story: 'He dyed the shirt himself in the backyard and swears the spiral is a map of the sky on the night he got his first skateboard.',
          build: kit => {
            const front = spiral(8, 9, 'abcd', { cy: 4.2 });
            front[0] = front[0].slice(0, 3) + 'ss' + front[0].slice(5);
            const back = spiral(8, 9, 'abcd', { cy: 3.5, offset: 0.4 });
            const side = spiral(4, 9, 'abcd', { cx: -2, cy: 5, turns: 0.3 });
            const sleeve = spiral(3, 4, 'abcd', { cx: 1, cy: -1, turns: 0.4 });
            const sleeveSide = spiral(4, 4, 'abcd', { cx: 1.5, cy: -1, turns: 0.4, offset: 0.25 });
            return youth(kit, {
              skin: '#f0c8a0', hair: { color: '#e2b452', style: 'wavy' }, eyes: '#2a6ac8',
              mats: { a: '#ff6aa8', b: '#ffd44a', c: '#4ab4ff', d: '#9a6aee', q: '#c8b080', Q: '#9c8658', x: '#f0f0f0', e: '#22a898', w: '#f4f4f4' },
              body: { front: [...front, 'QQQQQQQQ', 'qqqqqqqq', 'qqqqqqqq'], back: [...back, 'QQQQQQQQ', 'qqqqqqqq', 'qqqqqqqq'], side: [...side, 'QQQQ', 'qqqq', 'qqqq'] },
              arm: { front: [...sleeve, ...stack([['s', 5], ['abc', 1], ['s', 2]], 3)], side: [...sleeveSide, ...stack([['s', 5], ['dabc', 1], ['s', 2]])] },
              leg: { front: stack([['q', 5], ['Q', 1], ['s', 2], ['x', 1], ['e', 1], ['ewwe', 1], ['w', 1]]), side: stack([['q', 5], ['Q', 1], ['s', 2], ['x', 1], ['e', 2], ['w', 1]]) },
              over: (s, { color }) => { // sunglasses pushed up into the hair
                const k = color.hex('#18181e'), L = color.hex('#3a2a5e'), l = color.hex('#8c7cc0');
                s.face('head', 'front', 'outer').paint(['........', 'kLlkkLlk', '.LL..LL.'], { k, L, l });
                s.face('head', 'right', 'outer').paint(['........', '...kkkkk'], { k });
                s.face('head', 'left', 'outer').paint(['........', 'kkkkk...'], { k });
              }
            });
          }
        },
        {
          name: 'Peach Overalls', slim: true,
          story: 'She keeps one strap undone on purpose, twists her pink hair into two space buns and paints daisies on everybody\'s skateboard.',
          build: kit => youth(kit, {
            skin: '#6a4430', hair: { color: '#ff86bc', style: 'buns' }, eyes: '#1a1010', lashes: true,
            mats: { o: '#f2a07e', O: '#c47658', l: '#b8a0e8', W: '#f6f2fa', B: '#e8c050', d: '#ffffff', Y: '#ffc830', P: '#f8c8b0', n: '#f2f2f2', p: '#ff86bc', z: '#ff86bc' },
            body: {
              front: ['lollllll', 'WoWWWWWW', 'lollllll', 'WBooooBW', 'loooooOl', 'WooodoOW', 'loodYdOl', 'WooodooW', 'oooooooo', 'oOooooOo', 'oooooooo', 'oooooooo'],
              back: ['llllllol', 'WWWWWoWW', 'llllolll', 'WWWoWWWW', 'oooooooo', 'oooooooo', 'oOOooOOo', 'oOOooOOo', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo'],
              side: stack([['l', 1], ['W', 1], ['l', 1], ['W', 1], ['l', 1], ['W', 1], ['l', 1], ['W', 1], ['o', 4]])
            },
            arm: { front: stack([['l', 1], ['W', 1], ['l', 1], ['W', 1], ['s', 5], ['z', 1], ['s', 2]], 3), side: stack([['l', 1], ['W', 1], ['l', 1], ['W', 1], ['s', 5], ['z', 1], ['s', 2]]) },
            leg: { front: stack([['o', 8], ['P', 1], ['n', 2], ['p', 1]]), side: stack([['o', 8], ['P', 1], ['n', 2], ['p', 1]]) },
            over: (s, { map }) => { // the undone strap flaps off the bib
              s.face('body', 'front', 'outer').paint(['......O.', '......O.', '......B.'], map('OB'), { y: 3 });
            }
          })
        }
      ]
    },
    {
      title: 'After Dark Drip',
      note: 'When the streetlights come on, the crew heads out in their night fits: an ice-blue puffer with a pompom beanie, a runner with reflective stripes and a colour-block windbreaker under a bucket hat.',
      skins: [
        {
          name: 'Frost Puffer', slim: true,
          story: 'She zips her ice-blue puffer up to her chin the moment the sun goes down and never leaves the house without her navy pompom beanie.',
          build: kit => youth(kit, {
            skin: '#f4d4bc', hair: { color: '#2a1a14', style: 'long', overlay: false }, eyes: '#3a6aa8', lashes: true,
            mats: { q: '#3a86b8', p: '#7cc4ee', P: '#b0e0f8', z: '#e2e6ec', k: '#202028', K: '#34343e', f: '#f2eee6', F: '#d6c8b0', g: '#a8a090', w: '#eef2f6', b: '#34449a', N: '#4454aa', o: '#ffffff' },
            body: {
              front: ['PPPzPPPP', 'pppzpppp', 'qqqzqqqq', 'PPPzPPPP', 'pppzpppp', 'qqqzqqqq', 'PPPzPPPP', 'pppzpppp', 'qqqqqqqq', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk'],
              back: ['PPPPPPPP', 'pppppppp', 'qqqqqqqq', 'PPPPPPPP', 'pppppppp', 'qqqqqqqq', 'PPPPPPPP', 'pppppppp', 'qqqqqqqq', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk'],
              side: stack([['P', 1], ['p', 1], ['q', 1], ['P', 1], ['p', 1], ['q', 1], ['P', 1], ['p', 1], ['q', 1], ['k', 3]])
            },
            arm: {
              front: stack([['P', 1], ['p', 1], ['q', 1], ['P', 1], ['p', 1], ['q', 1], ['P', 1], ['p', 1], ['q', 1], ['K', 1], ['w', 2]], 3),
              side: stack([['P', 1], ['p', 1], ['q', 1], ['P', 1], ['p', 1], ['q', 1], ['P', 1], ['p', 1], ['q', 1], ['K', 1], ['w', 2]])
            },
            leg: { front: stack([['k', 7], ['K', 1], ['F', 1], ['f', 2], ['g', 1]]), side: stack([['k', 7], ['K', 1], ['F', 1], ['f', 2], ['g', 1]]) },
            inner: (s, { paint }) => {
              paint(s.face('head', 'top'), Array(8).fill('bbbbbbbb'));
              for (const f of SIDES4) paint(s.face('head', f), ['bbbbbbbb']);
            },
            over: (s, { map, headMap }) => {
              const m = { ...map('bNo'), O: map('o', 2).o };
              s.face('head', 'top', 'outer').paint(['bbbbbbbb', 'bbbbbbbb', 'bbbOobbb', 'bbOooObb', 'bboooObb', 'bbbOObbb', 'bbbbbbbb', 'bbbbbbbb'], m);
              for (const f of SIDES4) s.face('head', f, 'outer').paint(['bNbNbNbN', 'bNbNbNbN', 'NNNNNNNN'], m);
              // long hair falling out under the beanie
              s.face('head', 'front', 'outer').paint(['E......E', 'B......B'], headMap, { y: 3 });
              s.face('head', 'right', 'outer').paint(['BEEB....', 'BEB.....', 'BE......'], headMap, { y: 3 });
              s.face('head', 'left', 'outer').paint(['....BEEB', '.....BEB', '......EB'], headMap, { y: 3 });
              s.face('head', 'back', 'outer').paint(['BEEEEEEB', 'BEEBBEEB', '.B.BB.B.'], headMap, { y: 3 });
              for (const f of SIDES4) s.face('body', f, 'outer').paint([f === 'front' || f === 'back' ? 'pppppppp' : 'pppp'], map('p', 4));
            }
          })
        },
        {
          name: 'Night Runner', slim: true,
          story: 'He runs the same loop around the block every night, and his reflective stripes flash in the headlights like a tiny comet.',
          build: kit => youth(kit, {
            skin: '#5a3a28', hair: { color: '#141010', style: 'fade' }, eyes: '#140c08',
            mats: { k: '#1e1e26', K: '#30303c', r: '#d4d8e0', n: '#ff7a1e', z: '#9a9aa6', w: '#f0f0f0' },
            body: {
              front: ['nnnnznnn', 'kkkkzkkk', 'kkkkzkkk', 'rrrrzrrr', 'nnnnznnn', 'kkkkzkkk', 'kkkkzkkk', 'kkkkzkkk', 'KKKKKKKK', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk'],
              back: ['nnnnnnnn', 'kkkkkkkk', 'kkkkkkkk', 'rrrrrrrr', 'nnnnnnnn', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'KKKKKKKK', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk'],
              side: stack([['n', 1], ['k', 2], ['r', 1], ['n', 1], ['k', 3], ['K', 1], ['krnk', 3]])
            },
            arm: { front: stack([['k', 9], ['n', 1], ['s', 2]], 3), side: stack([['k', 9], ['n', 1], ['s', 2]]), outer: stack([['krnk', 9], ['n', 1], ['s', 2]]) },
            leg: { front: stack([['k', 8], ['K', 1], ['n', 1], ['nwwn', 1], ['w', 1]]), side: stack([['k', 8], ['K', 1], ['n', 2], ['w', 1]]), outer: stack([['krnk', 8], ['K', 1], ['n', 2], ['w', 1]]) },
            inner: (s, { paint }) => { for (const f of SIDES4) paint(s.face('head', f), ['........', 'nnnnnnnn']); },
            over: (s, { map }) => { // sweatband
              for (const f of SIDES4) s.face('head', f, 'outer').paint(['........', 'nnnnnnnn'], map('n', 4));
              s.face('head', 'front', 'outer').paint(['........', '...ww...'], map('w'));
            }
          })
        },
        {
          name: 'Retro Breaker', slim: true,
          story: 'His windbreaker is louder than his music, three colours crashing across it, and his yellow bucket hat has never once seen rain.',
          build: kit => youth(kit, {
            skin: '#d8a47a', hair: { color: '#3a2616', style: 'under' }, eyes: '#2a1a10',
            mats: { a: '#1fa3a0', c: '#f0f0ec', b: '#7a4ac8', y: '#f2c63a', Y: '#c89a1e', z: '#3a3a44', k: '#262630', w: '#e8e8e8' },
            body: {
              front: ['aaaazaaa', 'aaaazacc', 'aaaazccb', 'aaaaccbb', 'aaaccbbb', 'aaccbbbb', 'accbbbbb', 'ccbbbbbb', 'cbbbbbbb', 'yyyyyyyy', 'kkkkkkkk', 'kkkkkkkk'],
              back: flip(['aaaaaaaa', 'aaaaaacc', 'aaaaaccb', 'aaaaccbb', 'aaaccbbb', 'aaccbbbb', 'accbbbbb', 'ccbbbbbb', 'cbbbbbbb', 'yyyyyyyy', 'kkkkkkkk', 'kkkkkkkk']),
              side: stack([['a', 4], ['c', 1], ['b', 4], ['y', 1], ['k', 2]])
            },
            arm: { front: stack([['a', 3], ['c', 2], ['b', 4], ['y', 1], ['s', 2]], 3), side: stack([['a', 3], ['c', 2], ['b', 4], ['y', 1], ['s', 2]]) },
            leg: { front: stack([['k', 9], ['c', 2], ['b', 1]]), side: stack([['k', 9], ['c', 2], ['b', 1]]), outer: stack([['kwkk', 9], ['c', 2], ['b', 1]]) },
            inner: (s, { paint }) => {
              paint(s.face('head', 'top'), Array(8).fill('yyyyyyyy'));
              for (const f of SIDES4) paint(s.face('head', f), ['yyyyyyyy']);
            },
            over: (s, { c }) => { // bucket hat: soft crown, brim all around
              const m = { y: c('y'), u: c('y', 4), Y: c('Y'), b: c('b') };
              s.face('head', 'top', 'outer').paint(['yyyyyyyy', 'yuuyyuuy', 'yuyyyyuy', 'yyyuuyyy', 'yyyuuyyy', 'yuyyyyuy', 'yuuyyuuy', 'yyyyyyyy'], m);
              for (const f of SIDES4) s.face('head', f, 'outer').paint(['yyyyyyyy', 'bbbbbbbb', 'uuuuuuuu'], m);
            }
          })
        }
      ]
    }
  ]
};
