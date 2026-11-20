// Yubi's Easter Skins. Existing: Easter Bunny, Baby Chick, Chocolate Knight, Spring Fairy.
// The pack's look: clean, noise-free pillow shading in four tones per material (darkest edge, mid,
// base, light centre on the head), limbs shaded in vertical columns (dark | mid | light | dark), a tiny
// face in the middle of the head front, soft Easter pastels, and an almost empty overlay (≈ 94 %
// transparent: bunny ears, an egg-shell collar, a flower crown). Only the knight uses more overlay.
// The new skins keep that material language with their own builder: you paint MATERIAL letters
// (uppercase, shaded automatically by position) and FLAT letters (exact colours for eyes, dots, …).

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
const mul = (c, f) => [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f), 255];
const rep = (row, n) => Array(n).fill(row);
const rev = r => [...r].reverse().join('');
const flip = spec => (Array.isArray(spec) ? spec.map(rev) : Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, rev(v)])));

// Skin tones as the pack paints them (edge → centre).
const SKIN = {
  light: ['#c39473', '#dcb28e', '#f0c8a5', '#fcdcb9'],
  tan: ['#a8744e', '#c48c62', '#dca67a', '#ecbe94'],
  brown: ['#5e3a22', '#7a4e30', '#966240', '#ae7852']
};
// Default flat letters: eye, eye white, lips, smile line, blush, nose.
const FACE = { e: '#2a1e32', w: '#f5f3fc', m: '#d8788e', l: '#9a4054', b: '#f4a0b0', n: '#e87890' };

// Four tones from a base colour (or four explicit colours).
function tones(color, v) {
  if (Array.isArray(v)) return v.map(c => color.hex(c));
  const b = color.hex(v);
  return [mul(b, 0.68), mul(b, 0.84), b, color.shade(b, 1.2)];
}

// Which tone a pixel gets, like the hand-made skins: pillow on the head and on every top/bottom face,
// columns on the body (darker bottom row) and dark | mid | light | dark on 4-wide faces.
function toneAt(part, face, w, h, x, y) {
  const ex = Math.min(x, w - 1 - x);
  if (part === 'head' || face === 'top' || face === 'bottom') {
    const bonus = y === 0 ? 0 : y === h - 1 ? -1 : y === h - 2 ? 0 : 1;
    return Math.max(0, Math.min(3, Math.min(ex, 2) + bonus));
  }
  if (w === 8) return Math.max(0, Math.min(ex, 2) - (y === h - 1 ? 1 : 0));
  if (y === h - 1) return [0, 0, 1, 0][x];
  if (y === h - 2) return [0, 1, 1, 0][x];
  return [0, 1, 2, 0][x];
}

// The builder. o: {
//   mat:  { LETTER: base colour | [4 colours] }   shaded materials (uppercase),
//   flat: { letter: colour }                       exact colours (lowercase; e w m b n are preset),
//   fill: { head, body, rightArm, rightLeg }       default material per part (S, T, T, P),
//   face: 8 rows on the head front,
//   head/body/arm/leg:     { all, sides, top, bottom, front, back, right, left } inner templates,
//   headO/bodyO/armO/legO: the same for the overlay ('.' keeps, ' ' clears),
//   finish(ctx)            after mirroring: ctx.put(part, face, layer, rows, { x, y }) }
// Rows are arrays or { rowIndex: 'row' } and must be exactly as wide as the face. A missing 'left'
// is the mirrored 'right'. Arms and legs are painted on the right side and mirrored.
const PART_KEY = { head: 'head', body: 'body', rightArm: 'arm', rightLeg: 'leg' };
const FACES = ['top', 'bottom', 'right', 'front', 'left', 'back'];

function egg({ Skin, color }, o) {
  const s = new Skin({ slim: false });
  const MAT = {}, FL = {};
  for (const [k, v] of Object.entries(o.mat)) MAT[k] = tones(color, v);
  for (const [k, v] of Object.entries({ ...FACE, ...o.flat })) { if (MAT[k]) throw new Error(`egg: "${k}" is material and flat`); FL[k] = color.hex(v); }
  const fill = { head: 'S', body: 'T', rightArm: 'T', rightLeg: 'P', ...o.fill };
  const colourOf = (ch, f, x, y, seam = 0) => {
    if (MAT[ch]) return MAT[ch][Math.max(0, toneAt(f.part, f.face, f.w, f.h, x, y) - seam)];
    if (FL[ch]) return FL[ch];
    throw new Error(`egg: no colour for "${ch}" on ${f.part}.${f.face}`);
  };
  const apply = (grid, f, spec) => {
    const rows = Array.isArray(spec) ? spec.map((r, y) => [y, r]) : Object.entries(spec).map(([y, r]) => [+y, r]);
    for (const [y, row] of rows) {
      if (y >= f.h) continue;
      if (row.length !== f.w) throw new Error(`egg: row "${row}" is ${row.length} wide, ${f.part}.${f.face}.${f.layer} needs ${f.w}`);
      [...row].forEach((ch, x) => { if (ch !== '.') grid[y][x] = ch; });
    }
  };
  const specsFor = (spec, face) => {
    if (!spec) return [];
    const out = [];
    if (spec.all) out.push(spec.all);
    if (spec.sides && face !== 'top' && face !== 'bottom') out.push(spec.sides);
    const own = spec[face] || (face === 'left' && spec.right ? flip(spec.right) : null);
    if (own) out.push(own);
    return out;
  };

  for (const layer of ['inner', 'outer']) for (const part of Object.keys(PART_KEY)) for (const face of FACES) {
    const f = s.face(part, face, layer);
    const grid = Array.from({ length: f.h }, () => Array(f.w).fill(layer === 'inner' ? fill[part] : ' '));
    for (const sp of specsFor(o[PART_KEY[part] + (layer === 'outer' ? 'O' : '')], face)) apply(grid, f, sp);
    if (layer === 'inner' && part === 'head' && face === 'front' && o.face) apply(grid, f, o.face);
    const side = face !== 'top' && face !== 'bottom';
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const ch = grid[y][x];
      if (ch === ' ') { if (layer === 'inner') throw new Error(`egg: hole in ${part}.${face}`); f.set(x, y, color.T); continue; }
      // Where one material sits on another, its last row steps one tone darker (the pack's hems).
      const below = y + 1 < f.h ? grid[y + 1][x] : null;
      const seam = layer === 'inner' && side && o.seams !== false && MAT[ch] && MAT[below] && below !== ch ? 1 : 0;
      f.set(x, y, colourOf(ch, f, x, y, seam));
    }
  }
  s.mirrorLimbs();
  const put = (part, face, layer, rows, { x = 0, y = 0 } = {}) => {
    const f = s.face(part, face, layer);
    rows.forEach((row, j) => {
      if (x + row.length > f.w) throw new Error(`egg: row "${row}" too wide for ${part}.${face}`);
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        if (ch === ' ') return f.set(x + i, y + j, color.T);
        f.set(x + i, y + j, colourOf(ch, f, x + i, y + j));
      });
    });
  };
  o.finish?.({ s, put, MAT, FL });
  return s;
}

// Wool curls (two close creams) for the lamb.
const WOOL8 = ['WVWWWVWW', 'WWWVWWWV', 'VWWWWWVW', 'WWVWWWWW', 'WWWWVWWV', 'WVWWWWWW', 'WWWVWWVW', 'VWWWWWWW'];
const WOOL8x12 = [...WOOL8, ...WOOL8.slice(0, 4)];
const WOOL4 = ['WVWW', 'WWWV', 'VWWW', 'WWVW', 'WVWW', 'WWWV', 'VWWW', 'WWVW', 'WVWW', 'WWWV', 'VWWW', 'WWVW'];

// ── Updates ───────────────────────────────────────────────────────────────────────────────────

export default {
  style: 'hair',
  updates: [
    {
      title: 'The Great Egg Hunt',
      note: 'The sun is up and the eggs are hidden: a young egg hunter with a full basket, a knight in painted eggshell armour and a little spring lamb join the Easter crowd.',
      skins: [
        {
          name: 'Egg Hunter',
          story: 'She was first out of the door on Easter morning, and her basket is already so full of painted eggs that she has to carry it with both hands.',
          build: kit => egg(kit, {
            mat: { S: SKIN.light, H: '#8a5a34', Y: '#ffe36a', U: '#6a9ae0', M: '#7fd0a8', C: '#f4f2ee', R: '#e8607a', P: '#f8a8c8', B: '#80b8f0', O: '#c8945a' },
            flat: { q: '#4f9a78', y: '#ffd23a', p: '#ff7aa8', k: '#7a4a24', z: '#ffffff' },
            fill: { body: 'Y', rightArm: 'S', rightLeg: 'S' },
            face: ['HHHHHHHH', 'HSHHHHSH', '........', '..w..w..', '..e..e..', '.b....b.', '..l..l..', '...ll...'],
            head: {
              top: rep('HHHHHHHH', 8),
              right: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHS', 'HHHHHHSS', 'HHHHHSSS', 'HHHH....', 'HHH.....', '........'],
              back: [...rep('HHHHHHHH', 7), '.HHHHHH.']
            },
            headO: { // mint bucket hat with a flower on the left
              top: rep('MMMMMMMM', 8),
              front: ['MMMMMMMM', 'MMMMMMMM', 'qqqqqqqq'],
              right: ['MMMMMMMM', 'MMMMMMMM', 'qqqqqqqq'],
              left: ['MpMMMMMM', 'pypMMMMM', 'qpqqqqqq'],
              back: ['MMMMMMMM', 'MMMMMMMM', 'qqqqqqqq']
            },
            body: { // yellow tee with a big painted egg, denim shorts
              front: ['YYYYYYYY', 'YYYYYYYY', '...PP...', '..PPPP..', '..BBBB..', '..PzPz..', '..PPPP..', '...PP...', 'UUUUUUUU', 'UUUUUUUU', 'UUUUUUUU', 'UUUUUUUU'],
              back: [...rep('YYYYYYYY', 8), 'UUUUUUUU', 'UUUUUUUU', 'UkUUUUkU', 'UUUUUUUU'],
              right: [...rep('YYYY', 8), ...rep('UUUU', 4)],
              bottom: rep('UUUUUUUU', 4)
            },
            arm: { sides: { 0: 'YYYY', 1: 'YYYY', 2: 'YYYY', 3: 'YYYY' }, top: rep('YYYY', 4) },
            leg: {
              sides: { 0: 'UUUU', 1: 'UUUU', 2: 'UUUU', 3: 'UUUU', 8: 'CCCC', 9: 'RRRR', 10: 'RRRR', 11: 'CCCC' },
              top: rep('UUUU', 4), bottom: rep('CCCC', 4)
            },
            armO: { sides: { 3: 'YYYY' } },
            finish: ({ put }) => { // the basket in her left hand, eggs peeking out
              put('leftArm', 'front', 'outer', ['k..k', 'k..k', 'PyBp', 'OkOk', 'kOkO', 'OOOO'], { y: 6 });
              put('leftArm', 'left', 'outer', ['....', '....', 'BpPy', 'OkOk', 'kOkO', 'OOOO'], { y: 6 });
            }
          })
        },
        {
          name: 'Eggshell Knight',
          story: 'He guards the hidden eggs in armour painted like the finest Easter egg, and the zigzag on his helmet is his family crest.',
          build: kit => egg(kit, {
            mat: { C: '#f4ead2', P: '#f4a0bc', B: '#88b4ec', M: '#7fd8b0', L: '#b4a0dc', G: '#e8c24a', V: '#4a3e5a' },
            flat: { y: '#ffe680' },
            fill: { head: 'C', body: 'C', rightArm: 'B', rightLeg: 'L' },
            seams: false,
            face: ['CCCCCCCC', 'BCCBBCCB', 'CBBCCBBC', 'VyyVVyyV', 'CCCVVCCC', 'PPPPPPPP', 'CCCCCCCC', 'CCCCCCCC'],
            head: {
              top: ['CCCCCCCC', 'CCPCCCCC', 'CCCCCPCC', 'CCCCCCCC', 'CPCCCCCC', 'CCCCCCPC', 'CCCPCCCC', 'CCCCCCCC'],
              right: ['CCCCCCCC', 'BCCBBCCB', 'CBBCCBBC', 'CCCCCVVV', 'CCCCCCCC', 'PPPPPPPP', 'CMCCCMCC', 'CCCCCCCC'],
              back: ['CCCCCCCC', 'BCCBBCCB', 'CBBCCBBC', 'CCCCCCCC', 'CCCCCCCC', 'PPPPPPPP', 'CMCCMCCM', 'CCCCCCCC']
            },
            headO: { // a pink plume running over the egg helmet
              top: rep('...PP...', 8),
              front: ['...PP...'],
              back: ['...PP...', '...PP...', '...PP...']
            },
            body: {
              front: ['CCCCCCCC', 'CCCCCCCC', 'PPPPPPPP', 'BCCBBCCB', 'CBBCCBBC', 'PPPPPPPP', 'CCCMMCCC', 'CCCMMCCC', 'GGGGGGGG', 'LLLLLLLL', 'LLLLLLLL', 'LLLLLLLL'],
              back: ['CCCCCCCC', 'CCCCCCCC', 'PPPPPPPP', 'BCCBBCCB', 'CBBCCBBC', 'PPPPPPPP', 'CCCCCCCC', 'CCCCCCCC', 'GGGGGGGG', 'LLLLLLLL', 'LLLLLLLL', 'LLLLLLLL'],
              right: ['CCCC', 'CCCC', 'PPPP', 'BCCB', 'CBBC', 'PPPP', 'CCCC', 'CCCC', 'GGGG', 'LLLL', 'LLLL', 'LLLL'],
              bottom: rep('LLLLLLLL', 4)
            },
            bodyO: { front: { 8: '...GG...' } },
            arm: { sides: { 0: 'CCCC', 1: 'CCCC', 2: 'PPPP', 9: 'CCCC', 10: 'CCCC', 11: 'CCCC' }, top: rep('CCCC', 4), bottom: rep('CCCC', 4) },
            armO: { sides: { 0: 'CCCC', 1: 'CCCC', 2: 'PPPP', 9: 'GGGG' }, top: rep('CCCC', 4) },
            leg: { sides: { 6: 'CCCC', 7: 'CCCC', 8: 'CCCC', 9: 'CCCC', 10: 'CCCC', 11: 'BBBB' }, bottom: rep('BBBB', 4) },
            legO: { front: { 4: '.PP.', 5: 'CCCC' } }
          })
        },
        {
          name: 'Spring Lamb',
          story: 'She was born on the first warm morning of spring, and the pink ribbon and the little golden bell were a present from the whole meadow.',
          build: kit => egg(kit, {
            mat: { W: '#f6f0e2', V: '#e4d8c0', F: '#f0d8cc', A: '#e2cfc2', I: '#f0b0c0', D: '#6a5a5a', R: '#f08aa8', G: '#f0c43a' },
            flat: { g: '#b8901e' },
            fill: { head: 'W', body: 'W', rightArm: 'W', rightLeg: 'W' },
            face: ['........', '.FFFFFF.', '.FFFFFF.', '.FeFFeF.', '.bFFFFb.', '.FFnnFF.', '.FlFFlF.', '..FllF..'],
            head: { all: WOOL8, front: WOOL8 },
            headO: { // a cap of wool curls, floppy ears on both sides
              top: ['W.W.W.W.', '.W.W.W.W', 'W.W.W.W.', '.W.W.W.W', 'W.W.W.W.', '.W.W.W.W', 'W.W.W.W.', 'WVWWVWWV'],
              front: ['WVWWVWWV', 'W.W..W.W'],
              right: ['WVWWWVWW', '.W.W.W.W', '...AAA..', '...AIA..', '...AIA..', '....A...'],
              back: ['WVWWVWWV', 'W.W.W.W.', '.W..W..W']
            },
            body: {
              front: ['RRRRRRRR', '..RGGR..', '...gg...', ...WOOL8x12.slice(3)],
              back: ['RRRRRRRR', '...RR...', '..R..R..', ...WOOL8x12.slice(3)],
              right: ['RRRR', ...WOOL4.slice(1)],
              top: WOOL8, bottom: WOOL8
            },
            bodyO: {
              front: { 4: 'W......W', 7: '.W....W.', 10: 'W..W..W.' },
              back: { 5: '.W..W..W', 8: 'W..W..W.' }
            },
            arm: { all: WOOL4, sides: { 9: 'DDDD', 10: 'DDDD', 11: 'DDDD' }, bottom: rep('DDDD', 4) },
            armO: { sides: { 8: 'WVWV' } },
            leg: { all: WOOL4, sides: { 8: 'DDDD', 9: 'DDDD', 10: 'DDDD', 11: 'DDDD' }, bottom: rep('DDDD', 4) },
            legO: { sides: { 7: 'VWVW' } }
          })
        }
      ]
    },
    {
      title: 'The Garden Wakes Up',
      note: 'Spring has reached the vegetable patch and the flower beds: a carrot pulled fresh from the soil, a tulip in full bloom and a busy honey bee come out to play.',
      skins: [
        {
          name: 'Carrot Patch',
          story: 'He was the biggest carrot in the Easter garden until the bunnies tried to pull him up, so he simply climbed out by himself, soil still on his boots.',
          build: kit => egg(kit, {
            mat: { O: '#f58a2a', L: '#5ac24a', K: '#3a8a2a', D: '#7a5232' },
            flat: { r: '#c2600e' },
            fill: { head: 'O', body: 'O', rightArm: 'O', rightLeg: 'O' },
            face: ['........', 'rr....rr', '........', '..w..w..', '..e..e..', '.b....b.', '..m..m..', '...mm...'],
            head: {
              top: ['LKLLKLLK', 'KLLKLLKL', 'LLKLKLLL', 'LKLLLKLK', 'KLLKLLKL', 'LLKLLKLL', 'LKLLKLLK', 'KLLKLLKL'],
              right: ['........', '.rr.....', '......rr', '...rr...', '........', 'rr....r.', '....rr..', '........'],
              back: ['........', '.rr..rr.', '........', '...rr...', 'rr......', '.....rr.', '........', '..rr....']
            },
            headO: { // the carrot greens
              top: ['.L..K.L.', 'LKL.LKL.', '.L.KLK.L', '..LKL.K.', '.LKLK.L.', 'LK.L.KL.', '.L.KL.K.', 'L.KL.LK.'],
              front: ['L.KL.LK.', '.L..L..K'],
              right: ['L.L.K.L.'],
              back: ['L.K.L.LK', '.L...K..']
            },
            body: {
              front: ['........', '.rr.....', '......rr', '........', '...rr...', '........', 'rr......', '.....rr.', '........', '..rr....', '........', '........'],
              back: ['........', '.....rr.', '........', 'rr......', '....rr..', '........', '.rr.....', '......rr', '........', '...rr...', '........', '........'],
              right: ['....', '.rr.', '....', '....', 'rr..', '....', '..rr', '....', '....', '.rr.', '....', '....']
            },
            bodyO: { // a collar of carrot leaves
              front: ['LKLLKLLK', 'L.K..K.L'],
              back: ['KLLKLLKL', '.L.K.L.K'],
              right: ['LKLK', 'K..L']
            },
            arm: { sides: { 2: 'rr..', 5: '..rr', 10: 'LLLL', 11: 'LLLL' }, bottom: rep('LLLL', 4) },
            armO: { sides: { 9: 'KLKL' } },
            leg: { sides: { 3: '.rr.', 6: 'DOOD', 7: 'DDOD', 8: 'DDDD', 9: 'DDDD', 10: 'DDDD', 11: 'DDDD' }, bottom: rep('DDDD', 4) },
            legO: { sides: { 7: 'D..D' } }
          })
        },
        {
          name: 'Tulip Bloom',
          story: 'She sleeps curled up in a tulip bud all winter, and on the first sunny day of spring the red petals open around her face like a bonnet.',
          build: kit => egg(kit, {
            mat: { S: SKIN.tan, R: '#e0405a', Y: '#f8d860', G: '#4aa060', J: '#9ae08e', K: '#2e7a3e', H: '#5a3a28' },
            flat: { q: '#a82640', r: '#f8889c' },
            fill: { head: 'R', body: 'G', rightArm: 'S', rightLeg: 'S' },
            face: ['RRRRRRRR', 'RHHHHHHR', 'RSSSSSSR', 'RSeSSeSR', 'RbSSSSbR', 'RSlSSlSR', 'YSSllSSY', 'YYSSSSYY'],
            head: {
              top: ['RRRqqRRR', 'RRqRRqRR', 'RqRRRRqR', 'qRRRRRRq', 'qRRRRRRq', 'RqRRRRqR', 'RRqRRqRR', 'RRRqqRRR'],
              right: ['RRRqRRRR', 'RRRqRRRR', 'RRqRRRRR', 'RRqRRRRR', 'RqRRRRRR', 'RqRRRRRR', 'YYYYYYYY', 'YYYYYYYY'],
              back: ['RRRqRRRR', 'RRRqRRRR', 'RRRRqRRR', 'RRRRqRRR', 'RRRRqRRR', 'RRRqRRRR', 'YYYYYYYY', 'YYYYYYYY']
            },
            headO: { // petal tips around the face
              top: ['.RR..RR.', 'R......R', 'R......R', '........', '........', 'R......R', 'R......R', '.RR..RR.'],
              front: ['rR.Rr.Rr', 'R......R', 'r......r', 'R......R', 'q......q'],
              right: ['r.Rr.Rr.', 'RR....RR'],
              back: ['RR.RR.RR', '.R....R.']
            },
            body: { // a leaf-green dress with two leaves on a stem
              front: ['GGGGGGGG', 'GGGGGGGG', 'JGGGGGGJ', 'JJGGGGJJ', 'GJJGGJJG', 'GGJGGJGG', 'GGGKKGGG', 'GGGKKGGG', 'GGGKKGGG', 'GGGGGGGG', 'GGGGGGGG', 'GGGGGGGG'],
              back: ['GGGGGGGG', 'GGGGGGGG', 'GGGGGGGG', 'GGGJJGGG', 'GGJJJJGG', 'GGGJJGGG', 'GGGKKGGG', 'GGGKKGGG', 'GGGKKGGG', 'GGGGGGGG', 'GGGGGGGG', 'GGGGGGGG'],
              right: rep('GGGG', 12)
            },
            arm: { sides: { 0: 'JJJJ', 1: 'JJJJ', 2: 'JJJJ' }, top: rep('JJJJ', 4) },
            armO: { sides: { 0: 'JJJJ', 3: 'J..J' } },
            leg: { sides: { 0: 'GGGG', 1: 'GGGG', 2: 'GGGG', 3: 'GGGG', 10: 'RRRR', 11: 'RRRR' }, top: rep('GGGG', 4), bottom: rep('RRRR', 4) },
            legO: { sides: { 3: 'GGGG' } }
          })
        },
        {
          name: 'Honey Bee',
          story: 'He is the busiest bee in the Easter garden and still finds time to dip into the honey pot, which is why there is always a sticky drop on his hood.',
          build: kit => egg(kit, {
            mat: { S: SKIN.light, Y: '#ffd23a', K: '#3a3440', A: '#f0a020', U: '#dceeff' },
            flat: { u: '#a8c8e8' },
            fill: { head: 'Y', body: 'Y', rightArm: 'Y', rightLeg: 'K' },
            face: ['KAKKKKKK', 'YAYYYYYY', 'YSSSSSSY', 'KSeSSeSK', 'KbSSSSbK', 'YSlSSlSY', 'YSSllSSY', 'KKSSSSKK'],
            head: {
              top: rep('KKKKKKKK', 8),
              right: ['KKKKKKKK', 'YYYYYYYY', 'YYYYYYYY', 'KKKKKKKK', 'KKKKKKKK', 'YYYYYYYY', 'YYYYYYYY', 'KKKKKKKK'],
              back: ['KKKKKKKK', 'YYYYYYYY', 'YYYYYYYY', 'KKKKKKKK', 'KKKKKKKK', 'YYYYYYYY', 'YYYYYYYY', 'KKKKKKKK']
            },
            headO: { // antennae and a fuzzy hood rim
              top: { 4: '..Y..Y..', 5: '..K..K..', 6: '..K..K..', 7: '..K..K..' },
              front: ['..K..K..', '........', 'Y......Y', 'K......K', 'K......K', 'Y......Y', 'Y......Y', 'KK....KK']
            },
            body: {
              front: ['KKKKKKKK', 'YYYYYYYY', 'YYYYYYYY', 'KKKKKKKK', 'KKKKKKKK', 'YYYYYYYY', 'YYYYYYYY', 'KKKKKKKK', 'KKKKKKKK', 'YYYYYYYY', 'KKKKKKKK', 'KKKKKKKK'],
              back: ['KKKKKKKK', 'YYYYYYYY', 'YYYYYYYY', 'KKKKKKKK', 'KKKKKKKK', 'YYYYYYYY', 'YYYYYYYY', 'KKKKKKKK', 'KKKKKKKK', 'YYYYYYYY', 'KKKKKKKK', 'KKKKKKKK'],
              right: ['KKKK', 'YYYY', 'YYYY', 'KKKK', 'KKKK', 'YYYY', 'YYYY', 'KKKK', 'KKKK', 'YYYY', 'KKKK', 'KKKK'],
              bottom: rep('KKKKKKKK', 4)
            },
            bodyO: { // little wings on the back, their tips show at the sides
              back: { 1: '.UU..UU.', 2: 'UUUuuUUU', 3: 'UuUUUUuU', 4: '.UUUUUU.', 5: '..U..U..' },
              right: { 1: 'UU..', 2: 'Uu..', 3: 'U...' }
            },
            arm: { sides: { 2: 'KKKK', 3: 'KKKK', 6: 'KKKK', 7: 'KKKK', 9: 'KKKK', 10: 'KKKK', 11: 'KKKK' }, bottom: rep('KKKK', 4) },
            armO: { sides: { 8: 'YYYY' } },
            leg: { sides: { 10: 'AAAA', 11: 'AAAA' }, bottom: rep('AAAA', 4) },
            legO: { sides: { 9: 'AAAA' } }
          })
        }
      ]
    },
    {
      title: 'The Easter Parade',
      note: 'The whole town walks the Easter parade: a lady in her Sunday bonnet, a dreamer in a rainbow jumper with a cloud for hair and the egg painter who decorated every egg of the hunt.',
      skins: [
        {
          name: 'Sunday Bonnet',
          style: 'accent', // the straw bonnet covers the whole head overlay (like the Chocolate Knight's 79 %)
          story: 'Every year she weaves a new straw bonnet for the parade, and this year she tucked the first pink and blue flowers of the garden into its ribbon.',
          build: kit => egg(kit, {
            mat: { S: SKIN.light, H: '#b8643a', L: '#c8a8e8', W: '#fbf8f2', N: '#ecd08a', R: '#9a78d0', P: '#f498b8', B: '#8ac0f0' },
            flat: { y: '#ffe066' },
            fill: { body: 'L', rightArm: 'S', rightLeg: 'W' },
            face: ['HHHHHHHH', 'HHSSSSHH', 'H......H', 'H.e..e.H', 'Hb....bH', 'H..mm..H', 'H......H', 'HH....HH'],
            head: {
              top: rep('HHHHHHHH', 8),
              right: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHS', 'HHHHHHSS', 'HHHHHHSS', 'HHHHHHSS', 'HHHHHHSS', 'HHHHHHHS'],
              back: rep('HHHHHHHH', 8)
            },
            headO: { // the straw bonnet: flowers on the left, a ribbon that ties under the chin
              top: rep('NNNNNNNN', 8),
              front: ['NNNNNNNN', 'N......N', 'N......N', 'N......N', 'R......R', 'R......R'],
              right: ['NNNNNNNN', 'NNNNNNNN', 'NNNNNNNN', 'NNNNNNNN', 'RRRRRRRR', '.......R'],
              left: ['NNNNNNNN', 'NPNNBNNN', 'PyPByBNN', 'NPNNBNNN', 'RRRRRRRR', 'R.......'],
              back: ['NNNNNNNN', 'NNNNNNNN', 'NNNNNNNN', 'NNNNNNNN', 'RRRRRRRR', '...RR...', '..R..R..']
            },
            body: { // lilac dress, lace collar, a flower brooch and a ribbon sash
              front: ['WWWWWWWW', '.WWWWWW.', '...PP...', '........', '........', '........', 'RRRRRRRR', '........', '........', '........', '........', '........'],
              back: ['WWWWWWWW', '........', '........', '........', '........', '........', 'RRRRRRRR', '..R..R..', '..R..R..', '........', '........', '........'],
              right: { 0: 'WWWW', 6: 'RRRR' }
            },
            bodyO: { front: { 0: '..RRRR..', 1: '...RR...', 2: '...PP...' } },
            arm: { sides: { 0: 'LLLL', 1: 'LLLL', 2: 'LLLL', 8: 'WWWW', 9: 'WWWW', 10: 'WWWW', 11: 'WWWW' }, top: rep('LLLL', 4), bottom: rep('WWWW', 4) },
            armO: { sides: { 0: 'LLLL', 8: 'WWWW' } },
            leg: { sides: { 0: 'LLLL', 1: 'LLLL', 2: 'LLLL', 3: 'WWWW', 10: 'RRRR', 11: 'RRRR' }, top: rep('LLLL', 4), bottom: rep('RRRR', 4) },
            legO: { front: { 3: 'WWWW' } }
          })
        },
        {
          name: 'Rainbow Cloud',
          story: 'After every April shower he is the first one outside, with a fluffy cloud for hair and a jumper knitted in every colour of the rainbow.',
          build: kit => egg(kit, {
            mat: { S: SKIN.brown, C: '#f2f5fa', D: '#d2dcec', R: '#f07a80', O: '#f8a860', Y: '#f8dc68', G: '#80cc8a', B: '#7ab0ee', V: '#b490e0', P: '#9ad0f0' },
            fill: { body: 'R', rightArm: 'R', rightLeg: 'P' },
            face: ['CCCCCCCC', 'C.CCC.CC', '........', '..w..w..', '..e..e..', '.b....b.', '..l..l..', '...ll...'],
            head: {
              top: ['CCDCCCCC', 'CCCCCDCC', 'CDCCCCCC', 'CCCCCCDC', 'CCCDCCCC', 'CCCCCCCC', 'CDCCCDCC', 'CCCCCCCC'],
              right: ['CCDCCCCC', 'CCCCCDCC', 'CDCCCCCC', 'CCCCC...', 'CCC.....', '........', '........', '........'],
              back: ['CCDCCCCC', 'CCCCCDCC', 'CDCCCCCC', 'CCCCDCCC', 'CCCCCCCC', '.CC.CC.C', '........', '........']
            },
            headO: { // the cloud, with one raindrop falling on the left
              top: ['.CC..CC.', 'CCCCCCCC', 'CCDCCCCC', 'CCCCCDCC', 'CCCCCCCC', 'CDCCCCCC', 'CCCCCCCC', '.CC.CCC.'],
              front: ['CCCCCCCC', 'C.C..C.C'],
              right: ['CCCCCCCC', 'CC.CCC.C', '.C....C.'],
              left: ['CCCCCCCC', 'C.CCC.CC', '.C....C.', '.B......', '........', '..B.....'],
              back: ['CCCCCCCC', 'CCCCCCCC', 'C.CC.CC.']
            },
            body: {
              front: ['RRRRRRRR', 'RRRRRRRR', 'OOOOOOOO', 'OOOOOOOO', 'YYYYYYYY', 'YYYYYYYY', 'GGGGGGGG', 'GGGGGGGG', 'BBBBBBBB', 'BBBBBBBB', 'VVVVVVVV', 'VVVVVVVV'],
              back: ['RRRRRRRR', 'RRRRRRRR', 'OOOOOOOO', 'OOOOOOOO', 'YYYYYYYY', 'YYYYYYYY', 'GGGGGGGG', 'GGGGGGGG', 'BBBBBBBB', 'BBBBBBBB', 'VVVVVVVV', 'VVVVVVVV'],
              right: ['RRRR', 'RRRR', 'OOOO', 'OOOO', 'YYYY', 'YYYY', 'GGGG', 'GGGG', 'BBBB', 'BBBB', 'VVVV', 'VVVV'],
              bottom: rep('VVVVVVVV', 4)
            },
            arm: { sides: ['RRRR', 'RRRR', 'OOOO', 'OOOO', 'YYYY', 'YYYY', 'GGGG', 'GGGG', 'BBBB', 'VVVV', 'SSSS', 'SSSS'], bottom: rep('SSSS', 4) },
            leg: { sides: { 8: 'CCCC', 9: 'CCCC', 10: 'CCCC', 11: 'DDDD' }, bottom: rep('DDDD', 4) },
            legO: { sides: { 7: '.C.C', 8: 'CCCC' } }
          })
        },
        {
          name: 'Egg Painter',
          story: 'He painted every single egg for the hunt this year, and you can tell, because there is paint on his smock, his trousers, his cheek and the egg he is still holding.',
          build: kit => egg(kit, {
            mat: { S: SKIN.light, H: '#3a3040', Q: '#c83a6a', A: '#f4efe4', D: '#e0d4bc', T: '#6a8ad0', N: '#4a5a8a', U: '#7a4e2e', E: '#f8a8c8', F: '#80c0f0' },
            flat: { p: '#f47ab0', c: '#5ab8f0', y: '#f8d84a', g: '#5ad0a0', k: '#8a5a34', o: '#5a2034' },
            fill: { body: 'A', rightArm: 'S', rightLeg: 'N' },
            face: ['HHHHHHHH', 'HHHHHSHH', '........', '..w..w..', '..e..e..', '.b....b.', '..l..l..', '...ll...'],
            head: {
              top: rep('HHHHHHHH', 8),
              right: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHS', 'HHHHHSSS', 'HHHHSSSS', 'HHH.....', 'HH......', '........'],
              left: ['HHHHHHHH', 'HHHHHHHH', 'SHHHHHHH', 'SSSHHHHH', 'SSSSHHHH', '.pc..HHH', '..p...HH', '........'],
              back: [...rep('HHHHHHHH', 6), '.HHHHHH.', '........']
            },
            headO: { // a raspberry beret, tipped to the left
              top: ['.QQQQQ..', 'QQQQQQQ.', 'QQQQQQQQ', 'QQQoQQQQ', 'QQQQQQQQ', 'QQQQQQQQ', 'QQQQQQQQ', '.QQQQQQQ'],
              front: ['QQQQQQQQ', '.....QQQ'],
              right: ['QQQQQQQ.'],
              left: ['QQQQQQQQ', 'QQQQQQQQ', 'QQQQ....'],
              back: ['QQQQQQQQ', 'QQQQ....']
            },
            body: { // a cream smock full of paint, a brush in the pocket
              front: ['AATTTTAA', 'AAATTAAA', '......c.', '.y......', '.....p..', '..p.....', '..k...g.', '.DkDD...', '.DDDD..c', '.DDDD...', '....y...', '........'],
              back: ['AAAAAAAA', '........', '.....p..', '........', '..c.....', '........', 'TTTTTTTT', '...TT...', '......y.', '.g......', '........', '........'],
              right: { 2: '..p.', 7: '.c..' },
              bottom: rep('NNNNNNNN', 4)
            },
            bodyO: { front: { 4: '..p.....', 5: '..k.....' } },
            arm: { sides: { 0: 'AAAA', 1: 'AAAA', 2: 'AAAA', 3: 'AAAA', 4: 'AAAA', 5: 'TTTT' }, top: rep('AAAA', 4) },
            armO: { sides: { 5: 'TTTT' } },
            leg: { sides: { 3: '..y.', 7: '.p..', 10: 'UUUU', 11: 'UUUU' }, bottom: rep('UUUU', 4) },
            finish: ({ put }) => { // the last painted egg, still wet, in his left hand
              put('leftArm', 'front', 'outer', ['.EE.', 'EEEE', 'FFFF', 'EyEy', '.EE.'], { y: 7 });
              put('leftArm', 'left', 'outer', ['.EE.', 'EEEE', 'FFFF', 'yEyE', '.EE.'], { y: 7 });
            }
          })
        }
      ]
    }
  ]
};
