// Fantasy Academy Skins — students and staff of the four houses: Emberfell (fire: red + gold),
// Stormleaf (storm/air: navy + silver), Verdanthold (nature: green + bronze), Moonvein (moon: purple + silver).
// Existing (V1.0): Ember Apprentice, Ember Duelist, Ember Firekeeper, Storm Scholar, Storm Skyfarer, Verdant Herbalist,
// Verdant Warden, Moon Enchantress, Moon Seer, Starlight Novice — all Steve model (4 px arms), one template:
// flat colours, every face boxed by a 1 px darker outline (cloth ≈ 0.68 × base, light cloth / skin ≈ 0.85),
// a light shirt with a small house symbol and a belt with a gold buckle on the inner layer, the open house robe
// on the overlay (body, sleeve caps with a trim band, a short skirt over the thighs), the big house crest on the
// robe's back, dark trousers and brown boots, a hair cap on the head overlay and a small face (brows, white +
// pupil, nose shadow, two-pixel mouth). Overlay ≈ 46 % transparent → style 'clothing'.
// The new skins keep that material language but every one wears its own outfit (no open robe template), so the
// distinctness check sees a new hat, body, arms and legs.

import { hex, mix } from '../color.js';

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const FACES6 = ['top', 'bottom', 'right', 'front', 'left', 'back'];
const mul = (c, f) => { const v = hex(c); return [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(v[i] * f)))).concat(255); };
const flip = rows => rows.map(r => [...r].reverse().join(''));
const rep = (row, n) => Array(n).fill(row);
// Outlined box rows (the pack's 1 px face border). top/bottom: draw the edge row.
const ob = (w, h, f, e, { top = true, bottom = true } = {}) =>
  Array.from({ length: h }, (_, y) => (top && y === 0) || (bottom && y === h - 1) ? e.repeat(w) : e + f.repeat(w - 2) + e);
const box = (f, c, e) => { f.fill(c); if (e) f.row(0, e).row(f.h - 1, e).col(0, e).col(f.w - 1, e); return f; };

// Palette: { R: ['#aa2d28', 0.68] } → R = base, r = outline; { Q: '#ebe187' } → single colour. Letters may not repeat.
function pal(spec) {
  const m = {};
  const put = (k, c) => { if (k in m) throw new Error(`palette letter "${k}" used twice`); m[k] = c; };
  for (const [k, v] of Object.entries(spec)) {
    if (Array.isArray(v)) { put(k, hex(v[0])); put(k.toLowerCase(), mul(v[0], v[1] ?? 0.68)); } else put(k, hex(v));
  }
  return m;
}
// Skin keys: S fill, s outline, z under-eye shade, M mouth. Eyes: W white, E pupil.
const skinPal = (c, eye) => ({ S: hex(c), s: mul(c, 0.85), z: mix(mul(c, 0.8), '#a0503c', 0.3), M: mix(mul(c, 0.7), '#a04a4a', 0.5), W: hex('#ffffff'), E: hex(eye) });

// Paint one part from rows per face (right = the outer side of a right limb, left defaults to flip(right)).
function dress(s, part, layer, spec, map) {
  for (const fn of FACES6) {
    let rows = spec[fn];
    if (rows === undefined && fn === 'left' && spec.right) rows = flip(spec.right);
    if (rows === undefined && ['front', 'back', 'right', 'left'].includes(fn)) rows = spec.sides;
    if (!rows) continue;
    const f = s.face(part, fn, layer);
    rows.forEach((r, y) => { if (r.length !== f.w || y >= f.h) throw new Error(`${part}.${fn}.${layer} row ${y} "${r}" does not fit ${f.w}×${f.h}`); });
    f.paint(rows, map);
  }
}
// Fill a whole part with an outlined colour first (inner layer: everything opaque).
const base = (s, part, map, f, e) => { for (const fn of FACES6) box(s.face(part, fn), map[f], map[e]); };

// A new skin with skin-coloured boxes everywhere and the face painted from rows.
function student({ Skin }, map, face) {
  const s = new Skin({ slim: false });
  for (const p of ['head', 'body', 'rightArm', 'rightLeg']) base(s, p, map, 'S', 's');
  s.face('head', 'front').paint(face, map);
  return s;
}
// Hands: rows 8–11 of an arm in the pack (outline row, then skin).
const HAND = ['ssss', 'sSSs', 'sSSs', 'sSSs'];

// ── 1 · The Staff Room ────────────────────────────────────────────────────────────────────────

// Old professor: deep red hat with a gold band and flame, half-moon spectacles, a long grey beard over a red
// mantle, a closed floor-length robe with a gold stole that ends in flames, wide sleeves.
function flameProfessor(kit) {
  const map = { ...skinPal('#ecc6a2', '#4a2a18'), ...pal({ H: ['#b4b4b8', 0.72], V: ['#e2e2e2', 0.74], R: ['#aa2d28', 0.68], Y: ['#e1b946', 0.82], F: '#f0882a', D: '#dc3c37', B: ['#462d1e', 0.64], X: '#140300', K: ['#5a2a14', 0.7] }) };
  const s = student(kit, map, [
    'RRRRRRRR',
    'RRRRRRRR',
    'Hvv..vvH',
    'sWEYYEWs',
    '.YY..YY.',
    'VV.ss.VV',
    'VVVMMVVV',
    'VVVVVVVV'
  ]);
  // Head: hat on top, grey hair behind, beard on the sides.
  box(s.face('head', 'top'), map.R, map.r);
  box(s.face('head', 'back'), map.H, map.h);
  s.face('head', 'back').paint(['RRRRRRRR', 'RRRRRRRR', 'YYYYYYYY'], map);
  const sideIn = ['RRRRRRRR', 'RRRRRRRR', 'YYYYYYYY', 'HHHh....', 'HHh.....', 'Hh....VV', 'h....VVV', '....VVVV'];
  s.face('head', 'right').paint(sideIn, map); s.face('head', 'left').paint(flip(sideIn), map);
  dress(s, 'head', 'outer', {
    top: ['rrrrrrrr', 'rRRRRRRr', 'rRRDDRRr', 'rRDFFDRr', 'rRDFFDRr', 'rRRDDRRr', 'rRRRRRRr', 'rrrrrrrr'],
    front: ['rRRRRRRr', 'RRRDDRRR', 'YYYFFYYY', '        ', '        ', 'V      V', 'VV    VV', 'VvV  VvV'],
    right: ['rRRRRRRR', 'RRRRRRRR', 'YYYYYYYY', 'HHHh    ', 'HHh     ', 'Hh    VV', '     VVV', '    VVVv'],
    back: ['rRRRRRRr', 'RRRRRRRR', 'YYYYYYYY', 'HHHHHHHH', 'HhHHhHHH', 'HHHHHHHH', ' HhHHhH ', '        ']
  }, map);
  // Body: closed robe, gold stole, leather belt, flame crest on the back; red mantle and the beard on the overlay.
  base(s, 'body', map, 'R', 'r');
  dress(s, 'body', 'inner', {
    front: ['rYrVVrYr', 'rYRVVRYr', 'rYRRVRYr', 'rYRRRRYr', 'rYRRRRYr', 'kYkkkkYk', 'rYRKKRYr', 'rYRRRRYr', 'rYRRRRYr', 'rYRRRRYr', 'rYRRRRYr', 'rYrrrrYr'],
    back: ['rrrrrrrr', 'rRRRRRRr', 'rRRRRRRr', 'rRRRFRRr', 'rRRFFRRr', 'rRFFDFRr', 'rFDYYDFr', 'rFYYYYFr', 'rRFYYFRr', 'rRRFFRRr', 'rRRRRRRr', 'rrrrrrrr'],
    sides: ['rrrr', 'rRRr', 'rRRr', 'rRRr', 'rRRr', 'kkkk', 'rRRr', 'rRRr', 'rRRr', 'rRRr', 'rRRr', 'rrrr']
  }, map);
  dress(s, 'body', 'outer', {
    top: ['rRRRRRRr', 'RRRRRRRR', 'RRRRRRRR', 'rRRRRRRr'],
    front: ['RRVVVVRR', 'RRVvVVRR', 'RRVVvVRR', 'YY VV YY', '   V    '],
    sides: ['rRRr', 'RRRR', 'RRRR', 'YYYY'],
    back: ['rRRRRRRr', 'RRRRRRRR', 'RRRRRRRR', 'YYYYYYYY']
  }, map);
  // Wide sleeves to the wrist, gold hem.
  base(s, 'rightArm', map, 'R', 'r');
  dress(s, 'rightArm', 'inner', { sides: [...ob(4, 9, 'R', 'r', { bottom: false }), 'YYYY', 'sSSs', 'sSSs'], bottom: ['ssss', 'sSSs', 'sSSs', 'ssss'] }, map);
  dress(s, 'rightArm', 'outer', { top: ['rRRr', 'RRRR', 'RRRR', 'rRRr'], sides: ['rRRr', ...rep('rRRr', 6), 'YYYY', 'rrrr'] }, map);
  // Floor-length robe, the stole ends in a flame, boots under the hem.
  base(s, 'rightLeg', map, 'R', 'r');
  dress(s, 'rightLeg', 'inner', {
    front: ['rYRr', 'rYRr', 'rYRr', 'rFRr', 'rDRr', 'rRRr', 'rRRr', 'rRRr', 'rRRr', 'YYYY', 'bBBb', 'XXXX'],
    sides: [...rep('rRRr', 9), 'YYYY', 'bBBb', 'XXXX'], bottom: rep('XXXX', 4)
  }, map);
  dress(s, 'rightLeg', 'outer', {
    front: ['rYRr', 'rYRr', 'rFRr', 'rDFr', 'rRDr', 'rRRr', 'rRRr', 'rRRr', 'YYYY'],
    sides: [...rep('rRRr', 8), 'YYYY']
  }, map);
  s.mirrorLimbs();
  return s;
}

// Librarian: dark hair in a high bun with a white quill, round silver glasses on a chain, a knitted blue-grey shawl
// pinned with a silver lightning brooch, a long navy dress with a white collar, and a navy book under the left arm.
function stormLibrarian(kit) {
  const map = { ...skinPal('#c99366', '#2a3a6a'), ...pal({ H: ['#4a2c1c', 0.62], N: ['#283773', 0.58], C: ['#ebebf0', 0.84], T: ['#8c9bc3', 0.78], G: ['#d2d2dc', 0.7], L: '#f4f6ff', K: ['#3a5c9a', 0.62], B: ['#2a2430', 0.6], X: '#100c14', Q: ['#f2e6c8', 0.8] }) };
  const s = student(kit, map, [
    'HHHHHHHH',
    'HHhSShHH',
    'Hhh..hhH',
    'gWEggEWg',
    'sggssggs',
    'sz.ss.zs',
    '...MM...',
    '........'
  ]);
  box(s.face('head', 'top'), map.H, map.h);
  box(s.face('head', 'back'), map.H, map.h);
  const sideIn = ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHH....', 'HHH.....', 'HH......', 'H.......', '........'];
  s.face('head', 'right').paint(sideIn, map);
  s.face('head', 'left').paint([...flip(sideIn).slice(0, 3), 'G...HHHH', '.G...HHH', '.G....HH', '..G....H', '..G.....'], map); // glasses chain
  dress(s, 'head', 'outer', {
    top: ['hHHHHHHh', 'HHHHHCHH', 'HHhhCcHH', 'HhHHChHH', 'HhHHHhHH', 'HHhhhhHH', 'HHHHHHHH', 'hHHHHHHh'],
    front: ['HHHHHHHH', 'HH    HH', 'H      H'],
    right: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'hHHH    ', 'hHH     ', 'hH      '],
    left: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', ' QQQQqH ', '    HHh ', '     Hh '], // quill behind the left ear
    back: ['HHhhhhHH', 'HhHHHHhH', 'HHhhhhHH', 'HHHHHHHH', 'hHHHHHHh', 'HHHHHHHH', ' hHHHHh ']
  }, map);
  // Body: navy dress, white collar, silver buttons; the shawl on the overlay.
  base(s, 'body', map, 'N', 'n');
  dress(s, 'body', 'inner', {
    front: ['nCCCCCCn', 'nNCnnCNn', 'nNNNGNNn', 'nNNNNNNn', 'nNNNGNNn', 'nNNNNNNn', 'nNNNGNNn', 'nnnnnnnn', 'nNNNNNNn', 'nNNNNNNn', 'nNNNNNNn', 'nnnnnnnn'],
    back: ['nCCCCCCn', ...rep('nNNNNNNn', 6), 'nnnnnnnn', ...rep('nNNNNNNn', 3), 'nnnnnnnn']
  }, map);
  dress(s, 'body', 'outer', {
    top: ['tTTTTTTt', 'TTtTTtTT', 'TtTTtTTT', 'tTTTTTTt'],
    front: ['TTT  TTT', 'tTTLLTTt', 'tTT L TT', 'tT     T', 'T      t', 't      T'],
    right: ['TtTT', 'TTtT', 'tTTt', 'TtTT', 'T  t'],
    back: ['TtTTtTTt', 'TTtTTtTT', 'tTTtTTtT', ' TtTTtT ', '  TTtT  ', '   tT   ']
  }, map);
  // Arms: navy sleeves, lace cuff, shawl-coloured puff at the shoulder.
  base(s, 'rightArm', map, 'N', 'n');
  dress(s, 'rightArm', 'inner', { sides: [...ob(4, 7, 'N', 'n', { bottom: false }), 'CCCC', ...HAND], bottom: ['ssss', 'sSSs', 'sSSs', 'ssss'] }, map);
  dress(s, 'rightArm', 'outer', { top: ['tTTt', 'TTtT', 'TtTT', 'tTTt'], sides: ['TTtT', 'tTTt', '    ', '    ', '    ', '    ', '    ', 'CcCc'] }, map);
  // Long skirt with a silver hem, black shoes.
  base(s, 'rightLeg', map, 'N', 'n');
  dress(s, 'rightLeg', 'inner', { sides: [...rep('nNNn', 9), 'nnnn', 'bBBb', 'XXXX'], bottom: rep('XXXX', 4) }, map);
  dress(s, 'rightLeg', 'outer', { sides: [...rep('nNNn', 8), 'GGGG'] }, map);
  s.mirrorLimbs();
  // The book under the left arm: navy cover with a silver bolt, cream page edges at the back.
  for (const layer of ['inner', 'outer']) {
    s.face('leftArm', 'front', layer).paint(['....', '....', '....', 'kkkk', 'kKKk', 'kKLk', 'kLKk', 'kKLk', 'kKKk', 'kkkk'], map);
    s.face('leftArm', 'left', layer).paint(['....', '....', '....', 'kkkk', 'QQQk', 'QQQk', 'QQQk', 'QQQk', 'QQQk', 'kkkk'], map);
  }
  return s;
}

// Astronomer: a star-dotted purple hood, silver hair, a brass monocle on the left eye, a midnight tunic with a
// gold constellation, a cloak with a silver crescent on the back, brass bracers and tall boots.
function moonAstronomer(kit) {
  const map = { ...skinPal('#8c5a3c', '#7a4ab0'), ...pal({ U: ['#4a3278', 0.6], H: ['#e1e1eb', 0.8], O: ['#c8963c', 0.68], J: '#a8dcf4', N: ['#262c58', 0.6], Q: '#ebe187', L: ['#dcdceb', 0.72], P: ['#3a3048', 0.65], B: ['#2c2240', 0.6], X: '#0e0a16' }) };
  const s = student(kit, map, [
    'UUUUUUUU',
    'HHHhHHHH',
    'shh..oos',
    'sWE.oEJo',
    '.z.z.oo.',
    '...ss...',
    '...MM...',
    '........'
  ]);
  box(s.face('head', 'top'), map.U, map.u);
  box(s.face('head', 'back'), map.U, map.u);
  for (const fn of ['right', 'left']) box(s.face('head', fn), map.U, map.u);
  const star = (rows) => rows.map(r => r.replace(/\*/g, 'Q'));
  dress(s, 'head', 'outer', {
    top: star(['uUUUUUUu', 'UU*UUUUU', 'UUUUU*UU', 'UUUUUUUU', 'U*UUUUUU', 'UUUU*UUU', 'UUUUUUUU', 'uUUUUUUu']),
    front: ['uUUUUUUu', 'U      U', 'U      U', 'U      O', 'U      U', 'U      U', 'u      u'],
    right: star(['UUUUUUUu', 'UU*UUUUU', 'UUUUUUUU', 'UUUU*UUU', 'U*UUUUUU', 'UUUUUU*U', 'uUUUUUUU', ' uUUUUUu']),
    left: star(['uUUUUUUU', 'UUUUU*UU', 'UUUUUUUU', 'OUU*UUUU', 'UOUUUU*U', 'U*OUUUUU', 'UUUOUUUu', 'uUUUUUu ']),
    back: star(['uUUUUUUu', 'UUUU*UUU', 'U*UUUUUU', 'UUUUUU*U', 'UUU*UUUU', 'UUUUUUUU', 'UU*UUU*U', ' uUUUUu '])
  }, map);
  // Body: midnight tunic with a gold constellation and a silver sash; cloak on the overlay (back, sides, front edges).
  base(s, 'body', map, 'N', 'n');
  dress(s, 'body', 'inner', {
    front: ['nnnnnnnn', 'nNNNNNNn', 'nQNNNNNn', 'nNNNQNNn', 'nNNQLQNn', 'nNNNQNNn', 'nNNNNNQn', 'nNQNNNNn', 'LLLLOLLL', 'nNNNNNNn', 'nNNNNNNn', 'nnnnnnnn'],
    back: [...ob(8, 8, 'N', 'n', { bottom: false }), 'LLLLLLLL', 'nNNNNNNn', 'nNNNNNNn', 'nnnnnnnn'],
    sides: [...ob(4, 8, 'N', 'n', { bottom: false }), 'LLLL', 'nNNn', 'nNNn', 'nnnn']
  }, map);
  dress(s, 'body', 'outer', {
    top: ['uUUUUUUu', 'UUUUUUUU', 'UUUUUUUU', 'uUUUUUUu'],
    front: ['UULQQLUU', 'U      U', 'U      U', 'U      U', 'U      U', 'U      U', 'U      U', 'U      U', 'U      U', 'U      U', 'U      U', 'L      L'],
    sides: ['uUUu', 'uUUu', 'uUQu', 'uUUu', 'uUUu', 'uQUu', 'uUUu', 'uUUu', 'uUUu', 'uUUu', 'uUUu', 'LLLL'],
    back: ['uUUUUUUu', 'uUUUUQUu', 'uULLLUUu', 'uLLUUUUu', 'uLLUUQUu', 'uLLUUUUu', 'uULLLUUu', 'uUUUUUUu', 'uQUUUUUu', 'uUUUQUUu', 'uUUUUUUu', 'LLLLLLLL']
  }, map);
  // Arms: midnight sleeves, brass bracers on the overlay.
  base(s, 'rightArm', map, 'N', 'n');
  dress(s, 'rightArm', 'inner', { sides: [...ob(4, 8, 'N', 'n', { bottom: false }), ...HAND], bottom: ['ssss', 'sSSs', 'sSSs', 'ssss'] }, map);
  dress(s, 'rightArm', 'outer', { top: ['uUUu', 'UUUU', 'UUUU', 'uUUu'], sides: ['uUUu', 'uUUu', '    ', '    ', '    ', 'oooo', 'OQOO', 'oooo'] }, map);
  // Trousers and tall boots with a silver buckle; the cloak hangs behind the legs.
  base(s, 'rightLeg', map, 'P', 'p');
  dress(s, 'rightLeg', 'inner', { sides: [...ob(4, 5, 'P', 'p', { bottom: false }), 'bbbb', 'bBBb', 'bLBb', 'bBBb', 'bBBb', 'bBBb', 'XXXX'], bottom: rep('XXXX', 4) }, map);
  dress(s, 'rightLeg', 'outer', { sides: ['    ', '    ', '    ', '    ', '    ', 'bBBb'], back: ['uUUu', 'uUUu', 'uUQu', 'uUUu', 'uUUu', 'LLLL'] }, map);
  s.mirrorLimbs();
  return s;
}

// ── 2 · Prefects and Champions ────────────────────────────────────────────────────────────────

// Duel champion: spiky fire-red hair under a red headband with a flame gem, a scar, a sleeveless red tunic with a
// gold sash and medal, bare arms with leather bracers, one leather pauldron with a flame, tall boots.
function emberChampion(kit) {
  const map = { ...skinPal('#d8a27a', '#3a2010'), q: hex('#f0c8a8'), ...pal({ H: ['#c8461e', 0.7], R: ['#aa2d28', 0.68], Y: ['#e1b946', 0.78], F: '#f0882a', L: ['#7a4a26', 0.68], P: ['#3a2a22', 0.68], B: ['#462d1e', 0.64], X: '#140300' }) };
  const s = student(kit, map, [
    'HHHHHHHH',
    'RRRYYRRR',
    '.hh..hh.',
    '.WE..EW.',
    '.z.z..q.',
    '...ss.q.',
    '..MWWM..',
    '........'
  ]);
  box(s.face('head', 'top'), map.H, map.h);
  box(s.face('head', 'back'), map.H, map.h);
  s.face('head', 'back').row(1, map.R);
  const sideIn = ['HHHHHHHH', 'RRRRRRRR', 'HHHHH...', 'HHH.....'];
  s.face('head', 'right').paint(sideIn, map); s.face('head', 'left').paint(flip(sideIn), map);
  dress(s, 'head', 'outer', {
    top: ['HhHHhHHh', 'hHHhHHhH', 'HHhHHhHH', 'HhHHhHHh', 'hHHhHHhH', 'HHhHHhHH', 'HhHHhHHh', 'hHHhHHhH'],
    front: ['H HH H H', 'RRYFFYRR'],
    right: ['HHHHHHH ', 'RRRRRRRR', 'HHHHH   ', 'HHH     ', 'H       '],
    back: ['HHHHHHHH', 'RRRRRRRR', 'HHHRRHHH', 'HHHRRHHH', ' HHrrHH ', '   RR   ', '   rr   ']
  }, map);
  // Body: sleeveless tunic, belt, gold hem, flame crest on the back; sash, medal and flared hem on the overlay.
  base(s, 'body', map, 'R', 'r');
  dress(s, 'body', 'inner', {
    top: ['rRRRRRRr', 'rRSSSSRr', 'rRSSSSRr', 'rRRRRRRr'],
    front: ['rRrSSrRr', 'rRRrrRRr', ...rep('rRRRRRRr', 6), 'lLLYYLLl', 'rRRRRRRr', 'rRRRRRRr', 'YYYYYYYY'],
    back: ['rrrrrrrr', 'rRRRRRRr', 'rRRRYRRr', 'rRRYYRRr', 'rRYFYYRr', 'rYFFFYRr', 'rYFRFYRr', 'rRYYYRRr', 'lLLLLLLl', 'rRRRRRRr', 'rRRRRRRr', 'YYYYYYYY'],
    sides: [...ob(4, 8, 'R', 'r', { bottom: false }), 'lLLl', 'rRRr', 'rRRr', 'YYYY']
  }, map);
  dress(s, 'body', 'outer', {
    top: ['      YY', '      YY', '      YY', '      YY'],
    front: ['      YY', '     YY ', '    YY  ', '   yYy  ', '   YFY  ', '  YyYy  ', ' YY     ', 'YY      ', 'Y       ', 'rRRRRRRr', 'RRRRRRRR', 'YYYYYYYY'],
    right: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'rRRr', 'RRRR', 'YYYY'],
    left: ['YY  ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'rRRr', 'RRRR', 'YYYY'],
    back: ['YY      ', ' YY     ', '  YY    ', '   YY   ', '    YY  ', '     YY ', '      YY', '       Y', '        ', 'rRRRRRRr', 'RRRRRRRR', 'YYYYYYYY']
  }, map);
  // Bare arms with leather bracers (gold studs).
  dress(s, 'rightArm', 'inner', { sides: [...ob(4, 6, 'S', 's', { bottom: false }), 'lLLl', 'LYLY', 'YLYL', 'lLLl', 'sSSs', 'ssss'] }, map);
  dress(s, 'rightArm', 'outer', { sides: ['    ', '    ', '    ', '    ', '    ', '    ', 'lLLl', 'LYLY', 'YLYL', 'lLLl'] }, map);
  // Trousers, tall boots with a gold cuff.
  base(s, 'rightLeg', map, 'P', 'p');
  dress(s, 'rightLeg', 'inner', { sides: [...ob(4, 6, 'P', 'p', { bottom: false }), 'YYYY', 'bBBb', 'bBBb', 'bBBb', 'bBBb', 'XXXX'], bottom: rep('XXXX', 4) }, map);
  dress(s, 'rightLeg', 'outer', { sides: ['    ', '    ', '    ', '    ', '    ', '    ', 'YYYY', 'bBBb'] }, map);
  s.mirrorLimbs();
  // Leather pauldron on the left shoulder with a flame.
  dress(s, 'leftArm', 'inner', { top: ['lLLl', 'LLLL', 'LLLL', 'lLLl'], sides: ['lLLl', 'LLLL', 'LLLL', 'YYYY'] }, map);
  dress(s, 'leftArm', 'outer', {
    top: ['lLLl', 'LYYL', 'LYYL', 'lLLl'],
    sides: ['lLLl', 'LLLL', 'lLLl', 'YYYY'], left: ['lLYl', 'LYFL', 'lFYl', 'YYYY']
  }, map);
  return s;
}

// Prefect: neat side-swept blond hair, freckles, white shirt, green waistcoat and striped tie, a bronze prefect
// badge with a leaf, a short green cape with a bronze leaf crest, and a green armband on the left arm.
function verdantPrefect(kit) {
  const map = { ...skinPal('#f0d0b0', '#3f7a3a'), ...pal({ H: ['#c89a48', 0.72], C: ['#ece4d0', 0.84], G: ['#375f37', 0.62], O: ['#c08a44', 0.72], T: ['#203e23', 0.7], P: ['#4a5040', 0.68], B: ['#3a2416', 0.62], V: ['#2a4a2c', 0.62], X: '#120c08' }) };
  const s = student(kit, map, [
    'HHHHHHHH',
    'HHHHHHhS',
    '.hh..hh.',
    '.WE..EW.',
    '.zz..zz.',
    '...ss...',
    '...MMM..',
    '........'
  ]);
  box(s.face('head', 'top'), map.H, map.h);
  box(s.face('head', 'back'), map.H, map.h);
  const sideIn = ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHH.', 'HHHH....'];
  s.face('head', 'right').paint(sideIn, map); s.face('head', 'left').paint(flip(sideIn), map);
  dress(s, 'head', 'outer', {
    top: ['hHHHHhHh', 'HHHHHhHH', 'HHHHHhHH', 'HHHHHhHH', 'HHHHHhHH', 'HHHHHhHH', 'HHHHHhHH', 'hHHHHhHh'],
    front: ['HHHHHHHH', 'HHHHHh H'],
    right: ['hHHHHHHH', 'hHHHHHHH', 'hHHHHH  ', 'hHH     '],
    back: ['hHHHHHHh', 'HHHHHHHH', 'HHhHHhHH', 'HHHHHHHH', 'hHHHHHHh', ' hhhhhh ']
  }, map);
  // Body: shirt + waistcoat + tie; on the overlay the cape, its clasps, the badge and the lower waistcoat.
  base(s, 'body', map, 'G', 'g');
  dress(s, 'body', 'inner', {
    top: ['cCCCCCCc', 'CCCCCCCC', 'CCCCCCCC', 'cCCCCCCc'],
    front: ['cCCOOCCc', 'gCCTTCCg', 'gGCOOCGg', 'gGGTTGGg', 'gGGgGGGg', 'gGGgGGGg', 'gGGgGGGg', 'gGGgGGGg', 'gGOgGGGg', 'gGGgGGGg', 'gGgggGGg', 'gggggggg'],
    back: ['cCCCCCCc', ...rep('gGGGGGGg', 5), 'gOOOOOOg', ...rep('gGGGGGGg', 4), 'gggggggg'],
    sides: ['cCCc', ...rep('gGGg', 10), 'gggg']
  }, map);
  dress(s, 'body', 'outer', {
    top: ['vVVVVVVv', 'VVVVVVVV', 'VVVVVVVV', 'OO    OO'],
    front: ['O      O', '        ', '        ', '    oOo ', '    OTO ', '    OTO ', '     O  ', '        ', 'gGGgGGGg', 'gGOgGGGg', 'gGGgGGGg', 'gg gg gg'],
    right: ['vVVO', 'vVV ', 'vV  ', 'vV  ', 'vV  ', 'vV  ', 'vV  ', 'vV  ', 'vVgg', 'vVgg', 'vVgg', 'vVgg'],
    left: ['OVVv', ' VVv', '  Vv', '  Vv', '  Vv', '  Vv', '  Vv', '  Vv', 'ggVv', 'ggVv', 'ggVv', 'ggVv'],
    back: ['vVVVVVVv', 'vVVVVVVv', 'vVVOOVVv', 'vVOGGOVv', 'vVOGGOVv', 'vVVOOVVv', 'vVVVOVVv', 'vVVVVVVv', 'vVVVVVVv', 'vVVVVVVv', 'vVVVVVVv', 'OOOOOOOO']
  }, map);
  // Arms: shirt sleeves with a cuff, cape over the shoulder (outside and back only).
  base(s, 'rightArm', map, 'C', 'c');
  dress(s, 'rightArm', 'inner', { sides: [...ob(4, 7, 'C', 'c', { bottom: false }), 'cccc', ...HAND], bottom: ['ssss', 'sSSs', 'sSSs', 'ssss'] }, map);
  dress(s, 'rightArm', 'outer', { top: ['vVVv', 'VVVV', 'VVVV', 'vVVv'], right: ['vVVV', 'vvvv'], back: ['VVVV', 'vvvv'], front: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'CCCC'], left: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'CCCC'] }, map);
  s.face('rightArm', 'right', 'outer').paint(['....', '....', '....', '....', '....', '....', '....', 'CCCC'], map);
  s.face('rightArm', 'back', 'outer').paint(['....', '....', '....', '....', '....', '....', '....', 'CCCC'], map);
  // Trousers with a crease and a turned-up cuff, brown shoes; the cape reaches the back of the knees.
  base(s, 'rightLeg', map, 'P', 'p');
  dress(s, 'rightLeg', 'inner', { sides: ['pppp', ...rep('pPpp', 8), 'pppp', 'bBBb', 'XXXX'], bottom: rep('XXXX', 4) }, map);
  dress(s, 'rightLeg', 'outer', { sides: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'pPPp'], back: ['vVVv', 'vVVv', 'vVVv', 'vVVv', 'OOOO', '    ', '    ', '    ', '    ', 'pPPp'] }, map);
  s.mirrorLimbs();
  // Prefect armband on the left arm.
  for (const layer of ['inner', 'outer']) dress(s, 'leftArm', layer, { sides: ['....', '....', '....', 'gGGg', 'GGGG'], left: ['....', '....', '....', 'gOOg', 'GOGG'] }, map);
  return s;
}

// Windcaller: windswept sandy hair with flight goggles on the forehead, a long sky-blue scarf (one end down the
// front, one blown over the back), a navy flight jacket with a silver zigzag, fingerless gloves, tall navy boots.
function stormWindcaller(kit) {
  const map = { ...skinPal('#e8b890', '#2f6fc0'), ...pal({ H: ['#d8b860', 0.72], K: ['#3a2a22', 0.7], J: ['#7ad0ff', 0.68], G: ['#c8d0e1', 0.72], A: ['#5aa0e0', 0.68], N: ['#283773', 0.58], L: '#f4f6ff', P: ['#b4b4be', 0.74], B: ['#1e2440', 0.6], D: ['#4a3020', 0.7], X: '#0a0c18' }) };
  const s = student(kit, map, [
    'HHHHHHHH',
    'HHHHHHhh',
    '.hh..hh.',
    '.WE..EW.',
    '.z.z..z.',
    '...ss...',
    '...MM...',
    '........'
  ]);
  box(s.face('head', 'top'), map.H, map.h);
  box(s.face('head', 'back'), map.H, map.h);
  const sideIn = ['HHHHHHHH', 'KKKKKKKK', 'KKKKKKKK', 'HHHHHH..', 'HHHH....'];
  s.face('head', 'right').paint(sideIn, map); s.face('head', 'left').paint(flip(sideIn), map);
  s.face('head', 'back').paint(['........', 'KKKKKKKK', 'KKKKKKKK'], map);
  dress(s, 'head', 'outer', {
    top: ['hHHHHHHh', 'HhHHHhHH', 'HHhHHHhH', 'HHHhHHHh', 'HhHHhHHH', 'HHhHHhHH', 'HHHhHHhH', 'hHHHhHHh'],
    front: ['HHHHHHHH', 'KGJGGJGK', 'KGjGGjGK'],
    right: ['HHHHHHHH', 'KKKKKKKK', 'KKKKKKKK', 'HHHHHH  ', 'HHHH    ', ' HH     '],
    back: ['HHHHHHHH', 'KKKKKKKK', 'KKKKKKKK', 'HHHHHHHH', 'HhHHhHHH', 'HH HH HH', 'H  H  H ']
  }, map);
  // Body: jacket with the zigzag and a belt; scarf + puffed jacket on the overlay.
  base(s, 'body', map, 'N', 'n');
  dress(s, 'body', 'inner', {
    front: ['nnGGGGnn', 'nNNGGNNn', 'nNNNNNNn', 'nLNNNLNn', 'LNLNLNLN', 'nNNLNNNL', 'nNNNNNNn', 'nNNNNNNn', 'KKKGGKKK', 'nNNNNNNn', 'nNNNNNNn', 'nnnnnnnn'],
    back: ['nnnnnnnn', 'nNNNNNNn', 'nNNNNNNn', 'nLNNNLNn', 'LNLNLNLN', 'nNNLNNNL', 'nNNNNNNn', 'nNNNNNNn', 'KKKKKKKK', 'nNNNNNNn', 'nNNNNNNn', 'nnnnnnnn'],
    sides: [...ob(4, 8, 'N', 'n', { bottom: false }), 'KKKK', 'nNNn', 'nNNn', 'nnnn']
  }, map);
  dress(s, 'body', 'outer', {
    top: ['aAAAAAAa', 'AAAAAAAA', 'AAAAAAAA', 'aAAAAAAa'],
    front: ['AAAAAAAA', 'aAAAAAAa', '     AA ', '     Aa ', '     AA ', '     aA ', '     AA ', '     LA ', '     AL ', '     a a'],
    sides: ['AAAA', 'aAAa', 'nNNn', 'nNNn', 'nNNn', 'nNNn', 'nNNn', 'nnnn'],
    back: ['AAAAAAAA', 'aAAAAAAa', 'nAANNNNn', 'nAaNNNNn', 'nNAANNNn', 'nNAaNNNn', 'nNNAANNn', 'nnnALnnn', '    AL  ', '     a  ']
  }, map);
  // Arms: sleeves with the zigzag, fingerless gloves.
  base(s, 'rightArm', map, 'N', 'n');
  dress(s, 'rightArm', 'inner', { sides: ['nnnn', 'nNNn', 'nNNn', 'nLNn', 'LNLN', 'nNLn', 'nNNn', 'nnnn', 'dddd', 'dDDd', 'dDDd', 'sSSs'], bottom: ['ssss', 'sSSs', 'sSSs', 'ssss'] }, map);
  dress(s, 'rightArm', 'outer', { top: ['nNNn', 'NNNN', 'NNNN', 'nNNn'], sides: ['nNNn', 'nNNn', '    ', '    ', '    ', '    ', '    ', 'nnnn', 'dDDd'] }, map);
  // Light trousers, tall navy boots with a silver buckle and a turned-down top.
  base(s, 'rightLeg', map, 'P', 'p');
  dress(s, 'rightLeg', 'inner', {
    sides: [...ob(4, 6, 'P', 'p', { bottom: false }), 'bbbb', 'bBBb', 'bBBb', 'bBBb', 'bBBb', 'XXXX'],
    right: [...ob(4, 6, 'P', 'p', { bottom: false }), 'bbbb', 'bBBb', 'GGGb', 'bBBb', 'bBBb', 'XXXX'], bottom: rep('XXXX', 4)
  }, map);
  dress(s, 'rightLeg', 'outer', { sides: ['    ', '    ', '    ', '    ', '    ', '    ', 'BBBB', 'bbbb'] }, map);
  s.mirrorLimbs();
  return s;
}

// ── 3 · Grounds and Cellars ───────────────────────────────────────────────────────────────────

// Groundskeeper: wide leather hat with a green leaf band, a big brown beard, rust plaid shirt with rolled sleeves,
// green dungarees with bronze buttons and a trowel in the bib pocket, leather work gloves and muddy boots.
function verdantGroundskeeper(kit) {
  const map = { ...skinPal('#a0704a', '#2a1a10'), ...pal({ H: ['#3c2818', 0.66], L: ['#8a6438', 0.68], G: ['#5a9a3a', 0.65], R: ['#a04a2a', 0.7], C: ['#e8d8b8', 0.84], V: ['#375f37', 0.62], O: ['#c08a44', 0.72], D: ['#6a4a2a', 0.7], B: ['#3a2618', 0.62], U: '#6a5638', I: '#b4b4bc', X: '#120a06' }) };
  const s = student(kit, map, [
    'LLLLLLLL',
    'GGGGGGGG',
    'shh..hhs',
    'sWE..EWs',
    'H..zz..H',
    'HHHzzHHH',
    'HHhMMhHH',
    'HHHHHHHH'
  ]);
  box(s.face('head', 'top'), map.L, map.l);
  const sideIn = ['LLLLLLLL', 'GGGGGGGG', 'HHHH....', 'HHH.....', 'HH...HHH', 'H...HHHH', '...HHHHH', '..HHHHHH'];
  s.face('head', 'right').paint(sideIn, map); s.face('head', 'left').paint(flip(sideIn), map);
  box(s.face('head', 'back'), map.H, map.h);
  s.face('head', 'back').paint(['LLLLLLLL', 'GGGGGGGG'], map);
  dress(s, 'head', 'outer', {
    top: ['lLLLLLLl', 'LLLLLLLL', 'LLLlLLLL', 'LLLlLLLL', 'LLLlLLLL', 'LLLlLLLL', 'LLLLLLLL', 'lLLLLLLl'],
    front: ['LLLLLLLL', 'GGgGGOGG', 'llllllll', '        ', '        ', 'H      H', 'HH    HH', 'HHhHHhHH'],
    right: ['LLLLLLLL', 'GGGGGGGG', 'llllllll', 'HHH     ', 'HH      ', 'H    HHH', '    HHHH', '   HHHHh'],
    left: ['LLLLLLLL', 'GGGGGGGG', 'llllllll', '     HHH', '      HH', 'HHH    H', 'HHHH    ', 'hHHHH   '],
    back: ['LLLLLLLL', 'GGGGGGGG', 'llllllll', 'HHHHHHHH', 'HhHHhHHH', ' HHHHHH ']
  }, map);
  // Plaid: rust with cream threads.
  const plaid = (w, h, y0 = 0) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ((x % 3 === 1) && ((y + y0) % 3 === 1)) ? 'C' : (x % 3 === 1 || (y + y0) % 3 === 1) ? 'r' : 'R').join(''));
  base(s, 'body', map, 'R', 'r');
  const bib = ['vVVVVVVv', 'vVvvvvVv', 'vVvVVvVv', 'vVvvvvVv', 'vVVVVVVv', 'vVVVVVVv', 'vVVVVVVv', 'vvvvvvvv'];
  const front = plaid(8, 3).map(r => [...r]);
  for (const y of [0, 1, 2]) { front[y][1] = 'V'; front[y][6] = 'V'; }
  dress(s, 'body', 'inner', {
    top: ['rVrrrrVr', 'RVRRRRVR', 'RVRRRRVR', 'rVrrrrVr'],
    front: [...front.map(r => r.join('')), 'VOVVVVOV', ...bib],
    back: ['RVRRRRVR', 'RRVRRVRR', 'RRRVVRRR', 'RRRVVRRR', 'RRVRRVRR', 'RVRRRRVR', ...rep('vVVVVVVv', 5), 'vvvvvvvv'],
    sides: [...plaid(4, 6), ...rep('vVVv', 5), 'vvvv']
  }, map);
  dress(s, 'body', 'outer', {
    front: [' V    V ', ' V    V ', ' V    V ', 'VOVVDVOV', 'vVvvDvVv', 'vVVVIVVv', 'vVvvvvVv', 'vVvVVvVv', 'vVvvvvVv', 'vVVVVVVv', 'vVVVVVVv', 'vVVVVVVv'],
    sides: ['    ', '    ', '    ', '    ', '    ', '    ', 'vVVv', 'vVVv', 'vVVv', 'vVVv', 'vVVv', 'vvvv'],
    back: [' V    V ', '  V  V  ', '   VV   ', '   VV   ', '  V  V  ', ' V    V ', 'vVVVVVVv', 'vVVVVVVv', 'vVVVVVVv', 'vVVVVVVv', 'vVVVVVVv', 'vvvvvvvv']
  }, map);
  // Arms: plaid sleeves rolled to the elbow, bare forearms, leather work gloves.
  base(s, 'rightArm', map, 'R', 'r');
  dress(s, 'rightArm', 'inner', { sides: [...plaid(4, 4), 'CCCC', 'sSSs', 'sSSs', 'sSSs', 'dddd', 'dDDd', 'dDDd', 'dddd'], bottom: ['dddd', 'dDDd', 'dDDd', 'dddd'] }, map);
  dress(s, 'rightArm', 'outer', { sides: ['    ', '    ', '    ', 'cCCc', 'CCCC', '    ', '    ', '    ', 'DDDD', 'dDDd'] }, map);
  // Dungaree legs with a knee patch, muddy boots.
  base(s, 'rightLeg', map, 'V', 'v');
  dress(s, 'rightLeg', 'inner', {
    sides: [...ob(4, 8, 'V', 'v', { bottom: false }), 'bBBb', 'bBUb', 'UBBU', 'XXXX'],
    front: ['vvvv', 'vVVv', 'vVVv', 'vLLv', 'vLlv', 'vVVv', 'vVVv', 'vVVv', 'bBBb', 'bBUb', 'UBBU', 'XXXX'], bottom: rep('XXXX', 4)
  }, map);
  dress(s, 'rightLeg', 'outer', { sides: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'vvvv', 'BBBB', 'bUBb'] }, map);
  s.mirrorLimbs();
  return s;
}

// Alchemist: wild silver-lilac hair, round violet-lensed goggles over the eyes, a soot smudge, a plum leather apron
// with potion stains, a bandolier of glowing vials, long black gloves, and the apron reaching the knees.
function moonAlchemist(kit) {
  const map = { ...skinPal('#f4d4bc', '#7a4ab0'), ...pal({ H: ['#cfc8e4', 0.74], G: ['#dcdceb', 0.7], J: ['#b07ae0', 0.66], K: '#2a2030', C: ['#9c88c8', 0.74], A: ['#5a2a4a', 0.62], Q: '#6ae0b0', F: '#ebe187', D: '#e05ac8', I: '#eef4ff', L: ['#3a2a24', 0.7], B: ['#2a2236', 0.6], P: ['#3a3048', 0.68], X: '#100c16' }) };
  const s = student(kit, map, [
    'HHHHHHHH',
    'HhHHhHHH',
    '.hh..hh.',
    '.WE..EW.',
    '........',
    '.K.ss...',
    '...MM...',
    '...MM...'
  ]);
  box(s.face('head', 'top'), map.H, map.h);
  box(s.face('head', 'back'), map.H, map.h);
  const sideIn = ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'KKKKKKKK', 'HHHHH...', 'HHHH....', 'HHH.....'];
  s.face('head', 'right').paint(sideIn, map); s.face('head', 'left').paint(flip(sideIn), map);
  s.face('head', 'back').row(3, map.K);
  dress(s, 'head', 'outer', {
    top: ['hHHhHHhH', 'HHhHHHHh', 'hHHHhHHH', 'HHhHHHhH', 'HhHHHhHH', 'HHHhHHHh', 'hHHHHhHH', 'HhHHhHHh'],
    front: ['HHHHHHHH', 'H HH H H', 'KGG  GGK', 'GJjGGJjG', 'KGG  GGK'],
    right: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHK', 'KKKKKKKK', 'HHHHHH  ', 'HhHHH   ', ' H HH   ', '  H     '],
    back: ['HHHHHHHH', 'HhHHHhHH', 'HHHHHHHH', 'KKKKKKKK', 'HHHhHHHH', 'HhHHHHhH', ' HH HHH ', 'H  H  H ']
  }, map);
  // Body: lilac shirt, plum apron with stains; bandolier, vials and the apron's lower half on the overlay.
  base(s, 'body', map, 'C', 'c');
  dress(s, 'body', 'inner', {
    front: ['cCaCCaCc', 'cCaCCaCc', 'caAAAAac', 'caAAAAac', 'caAAAAac', 'caADAAac', 'caAAAAac', 'llllllll', 'caAAAAac', 'caaaaaac', 'caAQAAac', 'caAAAAac'],
    back: [...ob(8, 7, 'C', 'c', { bottom: false }), 'lllLLlll', 'cCClLCCc', ...rep('cCCCCCCc', 2), 'cccccccc'],
    sides: [...ob(4, 7, 'C', 'c', { bottom: false }), 'llll', 'aAAa', 'aAAa', 'aAAa', 'aaaa']
  }, map);
  dress(s, 'body', 'outer', {
    top: ['LL      ', 'LL      ', 'LL      ', 'LL      '],
    front: ['L       ', 'lL      ', ' lLI    ', '  lQ    ', '   lLI  ', '    lF  ', '     lLI', 'llllllLD', ' aAAAAal', ' aaaaaa ', ' aAQAAa ', ' aAAAAa '],
    right: ['LL  ', '    ', '    ', '    ', '    ', '    ', '    ', 'llll', 'aAAa', 'aAAa', 'aAAa', 'aaaa'],
    left: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'llll', 'aAAa', 'aAAa', 'aAAa', 'aaaa'],
    back: ['       L', '      Ll', '     Ll ', '    Ll  ', '   Ll   ', '  Ll    ', ' Ll     ', 'lllLLlll', '   lL   ', '   l l  ']
  }, map);
  // Arms: lilac sleeves, long black gloves with a flared cuff.
  base(s, 'rightArm', map, 'C', 'c');
  dress(s, 'rightArm', 'inner', { sides: [...ob(4, 5, 'C', 'c', { bottom: false }), 'bbbb', ...rep('bBBb', 5), 'bbbb'], bottom: rep('bbbb', 4) }, map);
  dress(s, 'rightArm', 'outer', { top: ['cCCc', 'CCCC', 'CCCC', 'cCCc'], sides: ['cCCc', 'cccc', '    ', '    ', '    ', 'BBBB', 'bBBb'] }, map);
  // Trousers and boots; the apron hangs over the front of both legs.
  base(s, 'rightLeg', map, 'P', 'p');
  dress(s, 'rightLeg', 'inner', {
    sides: [...ob(4, 9, 'P', 'p', { bottom: false }), 'BBBB', 'bBBb', 'XXXX'],
    front: ['aAAa', 'aAAa', 'aDAa', 'aAAa', 'aAAa', 'aAAa', 'aaaa', 'pPPp', 'pPPp', 'BBBB', 'bBBb', 'XXXX'], bottom: rep('XXXX', 4)
  }, map);
  dress(s, 'rightLeg', 'outer', { front: ['aAAa', 'aAAa', 'aAAa', 'aAAa', 'aAAa', 'aAQa', 'aaaa', '    ', '    ', 'BBBB'], right: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'BBBB'], back: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'BBBB'] }, map);
  s.mirrorLimbs();
  return s;
}

// Hearth cook: a pleated white cook's cap over ginger hair, a curly moustache and a big grin, a white double-breasted
// jacket with red buttons, a red neckerchief, a red apron with a gold flame, rolled sleeves, a quilted oven mitt on
// the left hand and checked trousers.
function emberCook(kit) {
  const map = { ...skinPal('#f0c09a', '#4a2a18'), ...pal({ H: ['#c8622a', 0.72], C: ['#f4f2ee', 0.84], R: ['#aa2d28', 0.68], Y: ['#e1b946', 0.78], F: '#f0882a', K: ['#2a2a2e', 0.7], B: ['#2a1c14', 0.62], D: ['#dc5a32', 0.7], X: '#0e0a08' }), p: mix('#f0c09a', '#ff6f86', 0.42) };
  const s = student(kit, map, [
    'CCCCCCCC',
    'HHHHHHHH',
    '.h....h.',
    '.EE..EE.',
    'p......p',
    '.HHssHH.',
    '..MWWM..',
    '........'
  ]);
  box(s.face('head', 'top'), map.C, map.c);
  const sideIn = ['CCCCCCCC', 'HHHHHHHH', 'HHH...HH', 'HH....HH', '......HH'];
  s.face('head', 'right').paint(sideIn, map); s.face('head', 'left').paint(flip(sideIn), map);
  box(s.face('head', 'back'), map.H, map.h);
  s.face('head', 'back').row(0, map.C);
  dress(s, 'head', 'outer', {
    top: ['cCCcCCCc', 'CCcCCcCC', 'CcCCCCcC', 'CCCcCCCC', 'cCCCcCCc', 'CCcCCCcC', 'CcCCcCCC', 'cCCCCCCc'],
    front: ['CCCCCCCC', 'cCcCcCcC'],
    right: ['CCCCCCCC', 'cCcCcCcC', 'HHH     '],
    back: ['CCCCCCCC', 'cCcCcCcC', 'HHHHHHHH', ' HHHHHH ']
  }, map);
  // Body: white jacket with red buttons and piping, apron from the waist with the flame; neckerchief and apron on the overlay.
  base(s, 'body', map, 'C', 'c');
  const apronFront = ['rrrrrrrr', 'rRRRYRRr', 'rRRYFRRr', 'rRYFFYRr', 'rRYFFYRr'];
  dress(s, 'body', 'inner', {
    front: ['cRRRRRRc', 'cCCCCCCc', 'cCRCCRCc', 'cCCCcCCc', 'cCRCCRCc', 'cCCCcCCc', 'cCRCCRCc', ...apronFront],
    back: ['cRRRRRRc', ...rep('cCCCCCCc', 6), 'rrrrrrrr', 'cCCCCCCc', 'cCCCCCCc', 'cCCCCCCc', 'cccccccc'],
    sides: ['cRRc', ...rep('cCCc', 6), 'rrrr', 'rRRr', 'rRRr', 'rRRr', 'rrrr']
  }, map);
  dress(s, 'body', 'outer', {
    front: [' RRRRRR ', '  RrrR  ', '   RR   ', '   rr   ', '        ', '        ', '        ', ...apronFront],
    sides: ['RRRR', '    ', '    ', '    ', '    ', '    ', '    ', 'rrrr', 'rRRr', 'rRRr', 'rRRr', 'rrrr'],
    back: ['RRRRRRRR', '   RR   ', '        ', '        ', '        ', '        ', '        ', 'rrrRRrrr', '  rRRr  ', '  r  r  ']
  }, map);
  // Arms: white sleeves rolled to the elbow.
  base(s, 'rightArm', map, 'C', 'c');
  dress(s, 'rightArm', 'inner', { sides: [...ob(4, 4, 'C', 'c', { bottom: false }), 'cccc', ...rep('sSSs', 6), 'ssss'] }, map);
  dress(s, 'rightArm', 'outer', { top: ['cCCc', 'CCCC', 'CCCC', 'cCCc'], sides: ['cCCc', 'cCCc', 'cCCc', 'CCCC', 'cCcC'] }, map);
  // Checked trousers under the apron, black shoes.
  base(s, 'rightLeg', map, 'K', 'k');
  const check = Array.from({ length: 10 }, (_, y) => y % 2 ? 'CKCK' : 'KCKC');
  dress(s, 'rightLeg', 'inner', { sides: [...check, 'bBBb', 'XXXX'], front: ['rRRr', 'rRRr', 'rRRr', 'rRRr', 'rRRr', 'YYYY', ...check.slice(6), 'bBBb', 'XXXX'], bottom: rep('XXXX', 4) }, map);
  dress(s, 'rightLeg', 'outer', { front: ['rRRr', 'rRRr', 'rRRr', 'rRRr', 'rRRr', 'YYYY', 'rrrr'] }, map);
  s.mirrorLimbs();
  // Quilted oven mitt on the left hand.
  dress(s, 'leftArm', 'inner', { sides: ['....', '....', '....', '....', '....', '....', '....', 'dddd', 'DdDd', 'dDdD', 'DdDd', 'dddd'], bottom: ['dddd', 'dDDd', 'dDDd', 'dddd'] }, map);
  dress(s, 'leftArm', 'outer', { sides: ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'DDDD', 'DdDD', 'DDdD', 'dDDd'] }, map);
  return s;
}

export default {
  style: 'clothing',
  updates: [
    {
      title: 'The Staff Room',
      note: 'The teachers step out of the staff room: an old fire professor with a beard down to his belt, the Stormleaf librarian who never lets a book go and the Moonvein astronomer who maps the night sky.',
      skins: [
        { name: 'Flame Professor — Emberfell House', story: 'The oldest teacher of Emberfell lights the classroom candles with a snap of his fingers and keeps his half-moon spectacles on the tip of his nose.', build: flameProfessor },
        { name: 'Storm Librarian — Stormleaf House', story: 'The Stormleaf librarian pins her shawl with a silver lightning bolt and hushes every whisper in the great library before it reaches the shelves.', build: stormLibrarian },
        { name: 'Moon Astronomer — Moonvein House', story: 'The Moonvein astronomer climbs the north tower every clear night, her brass monocle fixed on the stars stitched into her hood.', build: moonAstronomer }
      ]
    },
    {
      title: 'Prefects and Champions',
      note: 'Three students earn their colours: the undefeated Emberfell duel champion, a Verdanthold prefect with a shiny new badge and a Stormleaf windcaller who rides the gusts over the towers.',
      skins: [
        { name: 'Ember Duel Champion — Emberfell House', story: 'The Emberfell duel champion has never lost a match in the great hall, and the gold medal on his sash still smells of smoke.', build: emberChampion },
        { name: 'Verdant Prefect — Verdanthold House', story: 'The Verdanthold prefect polishes her bronze leaf badge every morning and knows every rule of the academy by heart, even the forgotten ones.', build: verdantPrefect },
        { name: 'Storm Windcaller — Stormleaf House', story: 'The Stormleaf windcaller pulls down his flight goggles, whistles up a gust and lets his long scarf point the way across the rooftops.', build: stormWindcaller }
      ]
    },
    {
      title: 'Grounds and Cellars',
      note: 'Far from the classrooms the academy keeps on running: the groundskeeper of the herb gardens, the alchemist of the moonlit cellar and the cook who keeps the great hearth burning.',
      skins: [
        { name: 'Verdant Groundskeeper — Verdanthold House', story: 'The Verdanthold groundskeeper talks to every tree on the academy grounds and always carries a trowel in his bib pocket, just in case one answers.', build: verdantGroundskeeper },
        { name: 'Moon Alchemist — Moonvein House', story: 'The Moonvein alchemist brews silver potions by moonlight in the cellar, and her wild hair has never fully recovered from the last explosion.', build: moonAlchemist },
        { name: 'Ember Hearth Cook — Emberfell House', story: 'The Emberfell cook lights the great hearth with one breath every morning and serves a stew so hot that it glows in the bowl.', build: emberCook }
      ]
    }
  ]
};
