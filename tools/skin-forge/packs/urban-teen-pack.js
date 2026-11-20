// Urban Teen Pack — streetwear teens in the pack's own flat look.
// Existing (V1.0): Violet Royal, Sunset Kid, Midnight Queen, Mint Fresh, Rose Blossom, Cyber Neon, Cocoa Dream,
// Lemon Glow, Sage Wisdom, Lilac Dream, Crimson Rose, Peach Glow — all Steve model (4 px arms), one template:
// flat colours with a 1 px darker outline on every face (outline ≈ 0.72 × base, seams ≈ 0.86, highlight ≈ 1.15),
// an oversized striped sweater on BOTH layers (chunky), plain pants, white sneakers with one accent pixel,
// skin-coloured head with a small cute face (2-pixel eyes: lash over pupil, pink blush, 2-pixel mouth) and the
// hair as a cap on the overlay. Overlay ≈ 41 % transparent → style 'clothing'.
// The new teens keep that material language and change hair/headwear, outfit, arms and legs.

import { hex, mix, rng } from '../color.js';

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const mul = (c, f) => { const v = hex(c); return [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(v[i] * f)))).concat(255); };
// Pack ramp: outline (face border), dark (seams, stripes), base, light (highlight).
const tone = base => ({ o: mul(base, 0.72), d: mul(base, 0.86), b: hex(base), l: mul(base, 1.15) });
const keys = (base, chars) => { const t = tone(base); return { [chars[0]]: t.o, [chars[1]]: t.d, [chars[2]]: t.b, [chars[3]]: t.l }; };
// Skin: a outline, s sides, S front (the pack's faces are lighter in front).
const skinKeys = c => ({ a: mul(c, 0.72), s: mul(c, 0.86), S: hex(c) });
const flip = rows => rows.map(r => [...r].reverse().join(''));
const rep = (row, n) => Array(n).fill(row);
const FACES6 = ['top', 'bottom', 'right', 'front', 'left', 'back'];

// Sneakers (rows 8–11 of a leg): 1 top/laces, 2 trim, 3 body, 4 sole, * accent on the outer side.
const SNEAKER = {
  front: ['1111', '2222', '2332', '4444'], out: ['2332', '2**2', '2332', '4444'],
  in: ['2332', '2332', '2332', '4444'], back: ['2112', '2332', '2332', '4444']
};
const WHITE_SHOE = { 1: '#ffffff', 2: '#b0b0b4', 3: '#f5f5fa', 4: '#f0f0f0' };
// Pants rows: p outline, q seam/side, r base.
const pantsF = n => ['pppp', ...rep('prrp', n - 1)];
const pantsS = n => ['pppp', ...rep('pqqp', n - 1)];
// Bare skin limb rows.
const skinF = n => rep('aSSa', n);
const skinS = n => rep('assa', n);
const hand = { front: ['aSSa', 'aaaa'], side: ['assa', 'aaaa'] };

function box(f, c, edge) { f.fill(c); f.row(0, edge).row(f.h - 1, edge).col(0, edge).col(f.w - 1, edge); return f; }

// Paint a part from rows per face. spec: { front, back, out, in, sides, top, bottom } — out/in are the outer
// and inner side of a RIGHT limb (right/left face); for the body they are the right/left face.
// top/bottom: rows, or [fill, edge] for a box. With `over` the same rows go on the overlay too:
// over = { from, to, drop, faces, top, bottom } (rows outside from..to and chars in drop are cleared).
function paintSpec(s, part, layer, spec, map, over = {}) {
  for (const fn of FACES6) {
    if (layer === 'outer') {
      if (over.faces && !over.faces.includes(fn)) continue;
      if (fn === 'top' && over.top === false) continue;
      if (fn === 'bottom' && over.bottom === false) continue;
    }
    let rows = spec[fn] ?? (fn === 'right' ? spec.out : fn === 'left' ? spec.in : undefined) ?? (['top', 'bottom'].includes(fn) ? undefined : spec.sides);
    if (!rows) continue;
    const f = s.face(part, fn, layer);
    if (!Array.isArray(rows[0]) && typeof rows[0] !== 'string') { box(f, map[rows[0]], map[rows[1]]); continue; }
    if (rows.length === 2 && rows[0].length === 1) { box(f, map[rows[0]], map[rows[1]]); continue; }
    if (layer === 'outer' && !['top', 'bottom'].includes(fn)) {
      rows = rows.map((r, y) => (over.from != null && y < over.from) || (over.to != null && y > over.to)
        ? ' '.repeat(r.length) : [...r].map(ch => (over.drop || '').includes(ch) ? ' ' : ch).join(''));
    } else if (layer === 'outer') rows = rows.map(r => [...r].map(ch => (over.drop || '').includes(ch) ? ' ' : ch).join(''));
    f.paint(rows, map);
  }
}
function wear(s, part, spec, map, over) {
  paintSpec(s, part, 'inner', spec, map);
  if (over) paintSpec(s, part, 'outer', spec, map, over);
}

// Head: skin box, lighter face, the pack's small face. look: normal | lashes | wink | happy; mouth: small | grin | open.
function headBase(s, { skin, eye, lash, look = 'normal', mouth = 'small', blush = true, freckles = false }) {
  const K = skinKeys(skin);
  for (const fn of FACES6) { const f = s.face('head', fn); if (fn === 'top') f.fill(K.s); else box(f, K.s, K.a); }
  const f = box(s.face('head', 'front'), K.S, K.a);
  const E = hex(eye), L = hex(lash);
  const looks = {
    normal: [[2, 3, L], [5, 3, L], [2, 4, E], [5, 4, E]],
    lashes: [[1, 3, L], [2, 3, L], [5, 3, L], [6, 3, L], [2, 4, E], [5, 4, E]],
    wink: [[2, 3, L], [2, 4, E], [5, 4, L], [6, 4, L]],
    happy: [[1, 4, L], [2, 4, L], [5, 4, L], [6, 4, L]]
  };
  for (const [x, y, c] of looks[look]) f.set(x, y, c);
  if (blush) { const p = mix(K.S, '#ff6f86', 0.38); f.set(1, 5, p); f.set(6, 5, p); }
  if (freckles) { const fr = mul(K.S, 0.78); f.set(2, 5, fr); f.set(5, 5, fr); f.set(3, 4, fr); }
  const m = mix(mul(K.S, 0.75), '#c8506e', 0.5), M = mul(m, 0.5);
  if (mouth === 'small') { f.set(3, 6, m); f.set(4, 6, m); }
  if (mouth === 'grin') f.paint(['mWWm'], { m, W: [245, 242, 236, 255] }, { x: 2, y: 6 });
  if (mouth === 'open') f.paint(['MM', 'mm'], { m, M }, { x: 3, y: 5 });
}

// Head overlay from rows. side rows are for the right face (front edge = last column); left is mirrored.
function headOver(s, rows, map) {
  const o = fn => s.face('head', fn, 'outer');
  if (rows.front) o('front').paint(rows.front, map);
  if (rows.side) { o('right').paint(rows.side, map); o('left').paint(rows.left || flip(rows.side), map); }
  if (rows.back) o('back').paint(rows.back, map);
  if (rows.top) o('top').paint(rows.top, map);
}
// Hair on the inner head under the overlay (top, upper sides and back), so gaps show hair, not scalp.
function hairIn(s, c, { side = 3, back = 5, front = 1 } = {}) {
  const d = mul(c, 0.86);
  s.face('head', 'top').fill(d);
  for (const fn of ['right', 'left']) s.face('head', fn).rect(0, 0, 8, side, d);
  s.face('head', 'back').rect(0, 0, 8, back, d);
  s.face('head', 'front').rect(0, 0, 8, front, d);
}
// Random texture rows (curly / knitted) from a palette string.
const texRows = (seed, chars, n = 8, w = 8) => { const r = rng(seed); return Array.from({ length: n }, () => Array.from({ length: w }, () => chars[Math.floor(r() * chars.length)]).join('')); };

// Shared base: skin everywhere, head + face, shoes and pants. Returns { s, map }.
function teen({ Skin }, o) {
  const s = new Skin({ slim: false });
  headBase(s, o);
  const map = {
    ...skinKeys(o.skin), ...WHITE_SHOE, ...(o.shoe || {}), '*': hex(o.shoeAccent || '#888888'),
    ...keys(o.pants || '#373746', 'pqrR'), W: hex('#f4f4f4'), K: hex('#1c1c22'), ...(o.map || {})
  };
  for (const p of ['body', 'rightArm', 'rightLeg']) for (const fn of FACES6) box(s.face(p, fn), map.s, map.a);
  return { s, map };
}

// ── The teens ─────────────────────────────────────────────────────────────────────────────────

// Backwards red cap with the strap opening, cobalt hoodie with uneven strings, cargo shorts and striped socks.
function cobaltKick(kit) {
  const { s, map } = teen(kit, { skin: '#c99366', eye: '#3a2618', lash: '#2a1a10', look: 'wink', mouth: 'small',
    pants: '#b8a27a', shoeAccent: '#d23a3a',
    map: { ...keys('#2f5fd0', 'odbl'), ...keys('#d83a3a', 'ODBL'), ...keys('#3b2618', 'eghH'), w: hex('#c8c8d0'), x: hex('#ffffff') } });
  hairIn(s, '#3b2618', { side: 5, back: 6 });
  headOver(s, {
    front: ['BBBBBBBB', 'BBLBBLBB', 'DxDhhDxD', 'h      h'],
    side: ['BBBBBBBB', 'BBBBBBBB', 'DDDDDDDD', 'hhhh   h', 'hhh     ', 'hh      '],
    back: ['LBBBBBBL', 'BBBBBBBB', 'OOOOOOOO', 'hhhhhhhh', 'hhHhhhhh', 'ghhhhhhg', ' gggggg '],
    top: ['OOOOOOOO', 'OOOOOOOO', 'DBBBBBBD', 'BBBDBBBB', 'BBBLLBBB', 'BBBLLBBB', 'BBBDBBBB', 'DBBBBBBD']
  }, map);
  // Hoodie
  wear(s, 'body', {
    front: ['oddddddo', 'obdbbdbo', 'obWbbWbo', 'obWbbWbo', 'obwbbWbo', 'obbbbwbo', 'obddddbo', 'odbbbbdo', 'odbbbbdo', 'obddddbo', 'oddddddo', 'oooooooo'],
    back: ['oddddddo', 'odlllldo', 'odbbbbdo', 'obdbbdbo', 'obbddbbo', ...rep('obbbbbbo', 5), 'oddddddo', 'oooooooo'],
    sides: ['oooo', ...rep('obbo', 9), 'dddd', 'oooo'], top: ['b', 'o'], bottom: ['b', 'o']
  }, map, {});
  const sleeve = ['oooo', ...rep('obbo', 8), 'dddd'];
  wear(s, 'rightArm', { front: [...sleeve, ...hand.front], back: [...sleeve, ...hand.front], sides: [...sleeve, ...hand.side], top: ['b', 'o'], bottom: ['s', 'a'] }, map, { to: 9, bottom: false });
  // Cargo shorts, skin, striped socks, sneakers
  const leg = (sh, extra) => [...sh, 'aSSa', 'bbbb', 'WWWW', ...extra];
  wear(s, 'rightLeg', {
    front: leg([...pantsF(4), 'qqqq'], SNEAKER.front), back: leg([...pantsF(4), 'qqqq'], SNEAKER.back),
    out: leg(['pppp', 'pqqp', 'qRRq', 'qrrq', 'qqqq'], SNEAKER.out), in: leg([...pantsS(4), 'qqqq'], SNEAKER.in),
    top: ['r', 'p'], bottom: ['4', '2']
  }, map, { to: 4, bottom: false });
  s.mirrorLimbs();
  return s;
}

// Mustard knit beanie over ginger hair, freckles, open olive bomber with orange lining, black joggers.
function oliveDrift(kit) {
  const { s, map } = teen(kit, { skin: '#f4cdb0', eye: '#3f8a3a', lash: '#8a3a18', look: 'normal', mouth: 'small', freckles: true,
    pants: '#2b2b30', shoeAccent: '#66753a',
    map: { ...keys('#66753a', 'odbl'), ...keys('#d9a42a', 'ODBL'), ...keys('#c8622a', 'eghH'), x: hex('#ef7d2a'), k: hex('#3c3c42'), z: hex('#c8ccd2') } });
  hairIn(s, '#c8622a', { side: 7, back: 8 });
  headOver(s, {
    front: ['BBBBBBBB', 'BDBDBDBD', 'DBDBDBDB', 'hH    Hh'],
    side: ['BBBBBBBB', 'BDBDBDBD', 'DBDBDBDB', 'hhhhhhhh', 'hHhhh hh', 'hhhh   h', 'hhH     ', 'hh      '],
    back: ['BBBBBBBB', 'BDBDBDBD', 'DBDBDBDB', 'hhhhhhhh', 'hhHhhHhh', 'hhhhhhhh', 'hHhhhhHh', 'h hhh hh'],
    top: ['OBBBBBBO', 'BBLBBLBB', 'BBBBBBBB', 'BLBBBLBB', 'BBBBBBBB', 'BBLBBBLB', 'BBBBBBBB', 'OBBBBBBO']
  }, map);
  wear(s, 'body', {
    front: ['KKKWWKKK', 'obxWWxbo', 'obxWWxbo', 'obxWWxbo', 'obxWWxbo', 'odxWWxdo', 'odxWWxdo', 'obxWWxbo', 'obxWWxbo', 'obxWWxbo', 'KkKkKkKk', 'kKkKkKkK'],
    back: ['KKKKKKKK', 'obbbbbbo', 'obbbbbbo', 'oddddddo', ...rep('obbbbbbo', 6), 'KkKkKkKk', 'kKkKkKkK'],
    sides: ['oooo', ...rep('obbo', 9), 'KkKk', 'kKkK'], top: ['b', 'o'], bottom: ['K', 'K']
  }, map, {});
  const sleeve = ['oooo', ...rep('obbo', 7), 'KkKk', 'kKkK'];
  wear(s, 'rightArm', { front: [...sleeve, ...hand.front], back: [...sleeve, ...hand.front], sides: [...sleeve, ...hand.side], top: ['b', 'o'], bottom: ['s', 'a'] }, map, { to: 9, bottom: false });
  // Baggy joggers (on the overlay too) gathered into ribbed cuffs.
  const jog = ['pppp', 'prrp', 'prRp', 'prRp', 'prrp', 'prrp', 'pqqp', 'qRqR'];
  wear(s, 'rightLeg', {
    front: [...jog, ...SNEAKER.front], back: [...pantsF(7), 'qRqR', ...SNEAKER.back],
    out: [...pantsS(7), 'qRqR', ...SNEAKER.out], in: [...pantsS(7), 'qRqR', ...SNEAKER.in], top: ['r', 'p'], bottom: ['4', '2']
  }, map, { from: 1, to: 6, top: false, bottom: false });
  s.mirrorLimbs();
  // Zip pocket on the left sleeve (both layers).
  for (const layer of ['inner', 'outer']) { s.face('leftArm', 'front', layer).paint(['....', '....', '.zz.', '.dd.', '.dd.'], map); s.face('rightArm', 'front', layer).paint(['....', '....', '....', '.xx.', '.xx.'], map); }
  return s;
}

// Big berry headphones, high ponytail with a pink scrunchie, singing with closed eyes, equalizer tee, ripped jeans.
function berryBeats(kit) {
  const { s, map } = teen(kit, { skin: '#7a4c34', eye: '#1c1418', lash: '#1c1418', look: 'happy', mouth: 'open', blush: true,
    pants: '#2c2c38', shoe: { 1: '#ffffff', 2: '#c23a7a', 3: '#ff4f9a', 4: '#f4f4f4' }, shoeAccent: '#ffffff',
    map: { ...keys('#f4f0ea', 'odbl'), ...keys('#1c1418', 'eghH'), k: hex('#26222a'), K: hex('#3e3844'), x: hex('#ff4f9a'), X: hex('#ff8cc0'),
      c: hex('#c23a7a'), y: hex('#ff4f9a'), z: hex('#d84fd0'), v: hex('#8d5cff') } });
  hairIn(s, '#1c1418', { side: 3, back: 6 });
  headOver(s, {
    front: ['hhhhhhhh', 'hhH  Hhh', 'h      h', 'k      k', 'x      x', 'x      x', 'k      k'],
    side: ['hhhkKhhh', 'hhhkKhhh', 'hhhkKhh ', 'hhkkkk  ', 'h kXxk  ', '  kxxk  ', '  kkkk  ', '        '],
    back: ['hhhhhhhh', 'hhhxxhhh', 'hhhhHhhh', 'hhhHhhhh', 'ghhhHhhg', '  ghHg  ', '   Hh   ', '   hg   '],
    top: ['hhhhhhhh', 'hhhxxhhh', 'hhhhhhhh', 'kkkkkkkk', 'KKKKKKKK', 'hhhHhhhh', 'hhhHhhhh', 'hhhHhhhh']
  }, map);
  // Oversized tee with equalizer bars (pink → magenta → purple).
  const front = ['obccccbo', ...rep('obbbbbbo', 7), 'obddddbo', 'obbbbbbo', 'obbbbbbo', 'oooooooo'].map(r => [...r]);
  [3, 5, 2, 6, 4, 3].forEach((h, i) => { for (let j = 0; j < h; j++) front[7 - j][i + 1] = 'yyzzvv'[i]; });
  wear(s, 'body', {
    front: front.map(r => r.join('')), back: ['obbccbbo', ...rep('obbbbbbo', 10), 'oooooooo'],
    sides: ['oooo', ...rep('obbo', 10), 'oooo'], top: ['b', 'o'], bottom: ['b', 'o']
  }, map, {});
  const sleeve = ['oooo', 'obbo', 'obbo', 'dddd'];
  wear(s, 'rightArm', {
    front: [...sleeve, ...skinF(4), 'xxxx', 'aSSa', ...hand.front], back: [...sleeve, ...skinF(4), 'xxxx', 'aSSa', ...hand.front],
    sides: [...sleeve, ...skinS(4), 'xxxx', 'assa', ...hand.side], top: ['b', 'o'], bottom: ['s', 'a']
  }, map, { to: 3, bottom: false });
  // High-tops in pink
  const HI = { front: ['3333', '3113', '3113', '3333', '4444'], side: ['3333', '3333', '3113', '3333', '4444'] };
  wear(s, 'rightLeg', {
    front: [...pantsF(7), ...HI.front], back: [...pantsF(7), ...HI.side], out: [...pantsS(7), ...HI.side], in: [...pantsS(7), ...HI.side],
    top: ['r', 'p'], bottom: ['4', '2']
  }, map);
  s.mirrorLimbs();
  // Rips: right knee, left thigh.
  s.face('rightLeg', 'front').paint(['....', '....', '....', '....', '.WS.', '.SS.'], map);
  s.face('leftLeg', 'front').paint(['....', '....', '.SW.', '....'], map);
  return s;
}

// Two braids with daisy clips, denim overalls with a daisy pocket patch over a yellow striped tee.
function denimDaisy(kit) {
  const { s, map } = teen(kit, { skin: '#b07450', eye: '#3a2416', lash: '#2a1810', look: 'lashes', mouth: 'small',
    pants: '#4f7cc0', shoeAccent: '#f4d35e',
    map: { ...keys('#4f7cc0', 'odbl'), ...keys('#4a2c1c', 'eghH'), Y: hex('#f4d35e'), y: hex('#e0b83a'), U: hex('#fbf6e8'), g: hex('#e2b33c'),
      w: hex('#ffffff'), x: hex('#f4c430') } });
  hairIn(s, '#4a2c1c', { side: 3, back: 6 });
  headOver(s, {
    front: ['hhhhhhwh', 'hhhHhwxw', 'hh    wh', 'h      h', 'h      h'],
    side: ['hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhh  hHh', 'hh   Hhh', '     hH ', '     Hh ', '     hH '],
    back: ['hhhhhhhh', 'hhhhhhhh', 'hhhHhhhh', 'hhhHhhhh', 'hhhhhhhh', 'ghhhhhhg', ' gggggg '],
    top: ['hhhhhhhh', 'hhhhhhhh', 'hhhHhhhh', 'hhhHhhhh', 'hhhHhhhh', 'hhhHhhhh', 'hhhHhhhh', 'hhhHhhhh']
  }, map);
  wear(s, 'body', {
    front: ['YbYYYYbY', 'UbUUUUbU', 'YbYYYYbY', 'UgbbbbgU', 'YbollobY', 'UbowxobU', 'YboooobY', 'UbbbbbbU', 'obbbbbbo', 'obbbbbbo', 'obbdbbbo', 'oooooooo'],
    back: ['YYbYYbYY', 'UUbUUbUU', 'YYYbbYYY', 'UUUbbUUU', 'YYbYYbYY', 'UbUUUUbU', 'obbbbbbo', 'obbbbbbo', 'obddbddo', 'obddbddo', 'obbbbbbo', 'oooooooo'],
    sides: ['YYYY', 'UUUU', 'YYYY', 'UUUU', 'YYYY', 'UUUU', 'oooo', 'obgo', 'obbo', 'obbo', 'obbo', 'oooo'],
    top: ['YbYYYYbY', 'YbYYYYbY', 'YbYYYYbY', 'YbYYYYbY'], bottom: ['b', 'o']
  }, map, { drop: 'YU', top: false });
  const sleeve = ['YYYY', 'UUUU', 'YYYY', 'yyyy'];
  wear(s, 'rightArm', {
    front: [...sleeve, ...skinF(5), 'wxwx', ...hand.front], back: [...sleeve, ...skinF(5), 'xwxw', ...hand.front],
    sides: [...sleeve, ...skinS(5), 'wxwx', ...hand.side], top: ['Y', 'y'], bottom: ['s', 'a']
  }, map, { to: 3, bottom: false });
  // Overall legs with rolled cuffs.
  wear(s, 'rightLeg', {
    front: [...pantsF(6), 'RRRR', 'qqqq', ...SNEAKER.front], back: [...pantsF(6), 'RRRR', 'qqqq', ...SNEAKER.back],
    out: [...pantsS(6), 'RRRR', 'qqqq', ...SNEAKER.out], in: [...pantsS(6), 'RRRR', 'qqqq', ...SNEAKER.in], top: ['r', 'p'], bottom: ['4', '2']
  }, map, { from: 6, to: 7, top: false, bottom: false });
  s.mirrorLimbs();
  // Braid ends hang over the shoulders, tied with a white band.
  const bo = s.face('body', 'front', 'outer');
  bo.paint(['h......h', 'H......H', 'h......h', 'w......w'], map);
  return s;
}

// Cream bucket hat with a coral band, long honey waves, coral crop top with a wave print, wide light jeans.
function coralWave(kit) {
  const { s, map } = teen(kit, { skin: '#ecbf98', eye: '#2f8a9a', lash: '#7a5020', look: 'lashes', mouth: 'small',
    pants: '#8fb3d9', shoe: { 1: '#ffffff', 2: '#e0604c', 3: '#ff7f6a', 4: '#f4f4f4' }, shoeAccent: '#ffffff',
    map: { ...keys('#ff7f6a', 'odbl'), ...keys('#efe6d2', 'ODBL'), ...keys('#e0b25a', 'eghH'), x: hex('#ff7f6a'), y: hex('#e8c25a'), u: hex('#ffd166') } });
  hairIn(s, '#e0b25a', { side: 8, back: 8 });
  headOver(s, {
    front: ['BBBBBBBB', 'xxxxxxxx', 'DDDDDDDD', 'h      h', 'H      H', 'h      h', 'H      H', 'h      h'],
    side: ['BBBBBBBB', 'xxxxxxxx', 'DDDDDDDD', 'hhHhhhHh', 'hHhhhHhh', 'Hhhhhhhh', 'hhHhhhh ', 'hHhhhh  '],
    back: ['BBBBBBBB', 'xxxxxxxx', 'DDDDDDDD', 'hhHhhhHh', 'hHhhhHhh', 'HhhhHhhh', 'hhHhhhHh', 'hHhhhHhh'],
    top: ['OOOOOOOO', 'OBBBBBBO', 'OBLBBBBO', 'OBBBBBBO', 'OBBBBLBO', 'OBBBBBBO', 'OBBBBBBO', 'OOOOOOOO']
  }, map);
  wear(s, 'body', {
    front: ['obSSSSbo', 'obbSybbo', 'obbbbbbo', 'obbuubbo', 'obuuuubo', 'oWbWWbWo', 'oddddddo', 'aSSSSSSa', 'aSSSSSSa', 'ppprpppp', 'prryrrrp', 'pppppppp'],
    back: [...rep('obbbbbbo', 6), 'oddddddo', 'aSSSSSSa', 'aSSSSSSa', 'pppppppp', 'prrrrrrp', 'pppppppp'],
    sides: ['oooo', ...rep('obbo', 5), 'dddd', 'assa', 'assa', 'pppp', 'prrp', 'pppp'],
    top: ['b', 'o'], bottom: ['r', 'p']
  }, map, { drop: 'aSs' });
  const sleeve = ['oooo', 'obbo', 'dddd'];
  wear(s, 'rightArm', {
    front: [...sleeve, ...skinF(6), 'xxxx', ...hand.front], back: [...sleeve, ...skinF(6), 'xxxx', ...hand.front],
    sides: [...sleeve, ...skinS(6), 'xxxx', ...hand.side], top: ['b', 'o'], bottom: ['s', 'a']
  }, map, { to: 2, bottom: false });
  const SH = { front: ['3113', '3333', '4444'], side: ['3333', '3*33', '4444'] };
  // Wide-leg jeans: on the overlay too, the hem falls over the sneakers.
  wear(s, 'rightLeg', {
    front: [...pantsF(9), ...SH.front], back: [...pantsF(9), ...SH.front], out: [...pantsS(9), ...SH.side], in: [...pantsS(9), ...SH.side],
    top: ['r', 'p'], bottom: ['4', '2']
  }, map, { to: 8, bottom: false });
  for (const fn of ['front', 'back', 'right', 'left']) s.face('rightLeg', fn, 'outer').row(9, map.q).row(8, map.R);
  s.mirrorLimbs();
  // Long hair falls down the back.
  s.face('body', 'back', 'outer').paint(['hhHhhhHh', 'hHhhhHhh', 'HhhhHhhh', 'hhHhhhHh', ' h hh h '], map);
  return s;
}

// Afro with a white sweatband, tangerine track jacket with a navy yoke and white stripes, navy track pants.
function tangerineTrack(kit) {
  const { s, map } = teen(kit, { skin: '#6a4430', eye: '#2a1a10', lash: '#140c08', look: 'normal', mouth: 'grin',
    pants: '#253050', shoeAccent: '#ff8a2a',
    map: { ...keys('#ff8a2a', 'odbl'), ...keys('#253050', 'ODBL'), ...keys('#2a1e16', 'eghH'), z: hex('#d8dce2'), x: hex('#ff8a2a'), u: hex('#e8e8ec') } });
  hairIn(s, '#2a1e16', { side: 6, back: 7 });
  const curl = (seed, n) => texRows(seed, 'hhhhHge', n);
  const [c0, c1] = curl('afro-front', 2);
  const sideRows = curl('afro-side', 7), backRows = curl('afro-back', 8);
  headOver(s, {
    front: [c0, c1, 'WWWWWWWW', 'hh    hh', 'h      h'],
    side: [sideRows[0], sideRows[1], 'WWWWWWWW', sideRows[3], sideRows[4].slice(0, 5) + '  ' + sideRows[4][7], sideRows[5].slice(0, 4) + '    ', sideRows[6].slice(0, 3) + '     '],
    back: [backRows[0], backRows[1], 'WWWWWWWW', backRows[3], backRows[4], backRows[5], backRows[6], ' ' + backRows[7].slice(1, 7) + ' '],
    top: curl('afro-top', 8)
  }, map);
  wear(s, 'body', {
    front: ['OBBBzBBO', 'OBBBzBBO', 'WWWWzWWW', 'obbbzbbo', 'obbbzbbo', 'obbbzbbo', 'obbbzbbo', 'oddbzddo', 'obbbzbbo', 'obbbzbbo', 'BBBBzBBB', 'OOOOOOOO'],
    back: ['OBBBBBBO', 'OBBBBBBO', 'WWWWWWWW', ...rep('obbbbbbo', 7), 'BBBBBBBB', 'OOOOOOOO'],
    sides: ['OBBO', 'OBBO', 'WWWW', ...rep('bWWb', 7), 'BBBB', 'OOOO'], top: ['B', 'O'], bottom: ['B', 'O']
  }, map, {});
  const sl = (mid, cuff) => ['OBBO', 'OBBO', 'WWWW', ...rep(mid, 6), cuff];
  wear(s, 'rightArm', {
    front: [...sl('obbo', 'BBBB'), ...hand.front], back: [...sl('obbo', 'BBBB'), ...hand.front],
    out: [...['BWWB', 'BWWB', 'BWWB'], ...rep('bWWb', 6), 'BWWB', ...hand.side], in: [...sl('obbo', 'BBBB'), ...hand.side],
    top: ['B', 'O'], bottom: ['s', 'a']
  }, map, { to: 9, bottom: false });
  wear(s, 'rightLeg', {
    front: [...pantsF(7), 'qqqq', ...SNEAKER.front], back: [...pantsF(7), 'qqqq', ...SNEAKER.back],
    out: ['pppp', ...rep('pxxp', 6), 'qqqq', ...SNEAKER.out], in: [...pantsS(7), 'qqqq', ...SNEAKER.in], top: ['r', 'p'], bottom: ['4', '2']
  }, map);
  s.mirrorLimbs();
  return s;
}

// Round glasses, wavy black hair, plum letter jacket with cream sleeves and striped ribbing, grey jeans.
function plumVarsity(kit) {
  const { s, map } = teen(kit, { skin: '#d29a70', eye: '#2a1a14', lash: '#1e1a20', look: 'normal', mouth: 'small',
    pants: '#5b5f6b', shoe: { 1: '#f4f4f4', 2: '#1e1e22', 3: '#2e2e34', 4: '#f0f0f0' }, shoeAccent: '#8a3a7a',
    map: { ...keys('#6a2c5e', 'odbl'), ...keys('#efe3c8', 'ODBL'), ...keys('#1e1a20', 'eghH'), K: hex('#3a1534'), c: hex('#f2e6cc'), n: hex('#fff6e0'), k: hex('#d8b04a') } });
  hairIn(s, '#1e1a20', { side: 4, back: 6 });
  headOver(s, {
    front: ['hhHhhhHh', 'hhhhhhhh', 'hhh hhh ', ' kk  kk ', 'k  kk  k', ' kk  kk '],
    side: ['hhhhHhhh', 'hHhhhhhh', 'hhhhhhhh', 'hhhh   h', 'hhh   kk', 'hh      '],
    back: ['hhHhhHhh', 'hhhhhhhh', 'hHhhhhHh', 'hhhhhhhh', 'hhhhHhhh', 'hhhhhhhh', ' h hh h '],
    top: ['hhHhhhhh', 'hhhhhHhh', 'hHhhhhhh', 'hhhhHhhh', 'hhhhhhHh', 'hhHhhhhh', 'hhhhhHhh', 'hHhhhhhh']
  }, map);
  wear(s, 'body', {
    front: ['KcKKKKcK', 'obKccKbo', 'obbncbco', 'obbdcbco', 'obbncbco', 'obbdccco', 'obbdbbbo', 'obbnbbbo', 'obbdbbbo', 'KKKKKKKK', 'cccccccc', 'KKKKKKKK'],
    back: ['KcKKKKcK', ...rep('obbbbbbo', 8), 'KKKKKKKK', 'cccccccc', 'KKKKKKKK'],
    sides: ['KKKK', ...rep('obbo', 8), 'KKKK', 'cccc', 'KKKK'], top: ['b', 'o'], bottom: ['K', 'K']
  }, map, {});
  const sleeve = ['OOOO', ...rep('OBBO', 7), 'KKKK', 'cccc'];
  wear(s, 'rightArm', {
    front: [...sleeve, ...hand.front], back: [...sleeve, ...hand.front], sides: [...['OOOO', ...rep('ODDO', 7), 'KKKK', 'cccc'], ...hand.side],
    top: ['B', 'O'], bottom: ['s', 'a']
  }, map, { to: 9, bottom: false });
  wear(s, 'rightLeg', {
    front: [...pantsF(8), ...SNEAKER.front], back: [...pantsF(8), ...SNEAKER.back],
    out: [...pantsS(8), ...SNEAKER.out], in: [...pantsS(8), ...SNEAKER.in], top: ['r', 'p'], bottom: ['4', '2']
  }, map);
  s.mirrorLimbs();
  return s;
}

// Hood up with a fluffy white rim, pink bob inside, quilted ice-blue puffer, white mittens, pink snow boots.
function frostPuff(kit) {
  const { s, map } = teen(kit, { skin: '#f6d6bc', eye: '#4a90d8', lash: '#b04a7a', look: 'lashes', mouth: 'small',
    pants: '#26232e', shoe: { 1: '#ffffff', 2: '#d05a90', 3: '#f08cb4', 4: '#f4f4f4' }, shoeAccent: '#ffffff',
    map: { ...keys('#8fc8f0', 'odbl'), ...keys('#f08cb4', 'eghH'), F: hex('#f8f8fa'), f: hex('#dcdce6'), z: hex('#d8dce2'), x: hex('#f08cb4') } });
  // Inner head under the hood: hood colour on top/sides/back, pink hair on the forehead.
  for (const fn of ['top', 'right', 'left', 'back']) s.face('head', fn).fill(map.d);
  s.face('head', 'front').rect(0, 0, 8, 1, map.g);
  const band = w => ['l', 'b', 'd', 'l', 'b', 'd', 'l', 'b'].map(c => c.repeat(w));
  headOver(s, {
    front: ['FfFfFfFf', 'fhhhhhhF', 'FhHhhHhf', 'fh    hF', 'Fh    hf', 'f      F', 'F      f', 'fFf  fFf'],
    side: band(7).map((r, y) => r + 'Ff'[y % 2]),
    back: band(8),
    top: ['llllllll', 'bbbbbbbb', 'dddddddd', 'llllllll', 'bbbbbbbb', 'dddddddd', 'llllllll', 'FfFfFfFf']
  }, map);
  const quilt = (w, zip) => ['l', 'b', 'd', 'l', 'b', 'd', 'l', 'b', 'd', 'l', 'b', 'o'].map((c, y) => {
    const row = 'o' + c.repeat(w - 2) + 'o';
    return zip ? row.slice(0, 4) + (y === 1 ? 'x' : 'z') + row.slice(5) : row;
  });
  wear(s, 'body', {
    front: quilt(8, true), back: quilt(8, false), sides: quilt(4, false), top: ['l', 'o'], bottom: ['b', 'o']
  }, map, {});
  const sleeve = ['l', 'b', 'd', 'l', 'b', 'd', 'l', 'b', 'd', 'd'].map(c => 'o' + c + c + 'o');
  const mitt = ['FFFF', 'ffff'];
  wear(s, 'rightArm', { front: [...sleeve, ...mitt], back: [...sleeve, ...mitt], sides: [...sleeve, ...mitt], top: ['l', 'o'], bottom: ['F', 'f'] }, map, { to: 9, bottom: false });
  // Leggings and snow boots with a fur cuff (boots on the overlay too).
  const BOOT = { front: ['FfFf', '3333', '3113', '3333', '4444'], side: ['fFfF', '3333', '3333', '3333', '4444'] };
  wear(s, 'rightLeg', {
    front: [...pantsF(7), ...BOOT.front], back: [...pantsF(7), ...BOOT.side], out: [...pantsS(7), ...BOOT.side], in: [...pantsS(7), ...BOOT.side],
    top: ['r', 'p'], bottom: ['4', '2']
  }, map, { from: 7, to: 9, top: false, bottom: false });
  s.mirrorLimbs();
  return s;
}

// Shaggy wolf cut with jade tips, colour-block windbreaker, crossbody bag, pixel heart pin, cargo joggers.
function jadePixel(kit) {
  const { s, map } = teen(kit, { skin: '#946244', eye: '#2a1a10', lash: '#141418', look: 'normal', mouth: 'small', blush: false,
    pants: '#c7b48a', shoe: { 1: '#3fd9a0', 2: '#1e1e24', 3: '#2c2c34', 4: '#e8e8ec' }, shoeAccent: '#3fd9a0',
    map: { ...keys('#2fb88a', 'odbl'), ...keys('#3a3a44', 'ODBL'), ...keys('#18181c', 'eghH'), V: hex('#bcbcc4'), U: hex('#f2f2f0'),
      x: hex('#3fd9a0'), m: hex('#141418'), n: hex('#c8ccd2'), '!': hex('#e8344a'), z: hex('#9a9aa4') } });
  map.H = hex('#3a3a44');
  hairIn(s, '#18181c', { side: 6, back: 8 });
  headOver(s, {
    front: ['hhhhhhhh', 'hhHhhhHh', 'hhhh hhh', 'h      h', 'x      x'],
    side: ['hhhhhhhh', 'hhHhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhh hh', 'hhhh   x', 'hxhx    ', 'x x     '],
    back: ['hhhhhhhh', 'hhHhhHhh', 'hhhhhhhh', 'hHhhhhHh', 'hhhhhhhh', 'hhhhhhhh', 'hxhhxhhx', 'x xx x x'],
    top: ['hhhhhhhh', 'hhhHhhhh', 'hhhhhhHh', 'hHhhhhhh', 'hhhhHhhh', 'hhhhhhhh', 'hhHhhhhh', 'hhhhhhhh']
  }, map);
  // Colour blocks: white yoke (rows 0–3), jade (4–7), graphite (8–11); strap over the right shoulder.
  const block = (w, y) => y < 4 ? (y === 0 ? 'V'.repeat(w) : 'V' + 'U'.repeat(w - 2) + 'V') : y < 8 ? 'o' + 'b'.repeat(w - 2) + 'o' : y === 11 ? 'O'.repeat(w) : 'O' + 'B'.repeat(w - 2) + 'O';
  const front = Array.from({ length: 12 }, (_, y) => [...block(8, y)]);
  for (let y = 0; y < 3; y++) front[y][3] = 'z';
  for (let y = 0; y < 10; y++) front[y][Math.min(7, 1 + Math.round(y * 6 / 9))] = y === 4 ? 'n' : 'm';
  [[4, 1], [6, 1], [4, 2], [5, 2], [6, 2], [5, 3]].forEach(([x, y]) => { front[y][x] = '!'; });
  front[8].splice(5, 3, 'm', 'm', 'm'); front[9].splice(5, 3, 'x', 'x', 'x'); front[10].splice(5, 3, 'm', 'm', 'm');
  const back = Array.from({ length: 12 }, (_, y) => [...block(8, y)]);
  for (let y = 0; y < 10; y++) back[y][Math.max(0, 6 - Math.round(y * 6 / 9))] = 'm';
  wear(s, 'body', {
    front: front.map(r => r.join('')), back: back.map(r => r.join('')),
    sides: Array.from({ length: 12 }, (_, y) => block(4, y)), top: ['U', 'V'], bottom: ['B', 'O']
  }, map, { from: 4, top: false }); // the white yoke stays flat, jade and graphite puff out
  const sleeve = Array.from({ length: 10 }, (_, y) => y === 9 ? 'OOOO' : block(4, y));
  wear(s, 'rightArm', { front: [...sleeve, ...hand.front], back: [...sleeve, ...hand.front], sides: [...sleeve, ...hand.side], top: ['U', 'V'], bottom: ['s', 'a'] }, map, { to: 9, bottom: false });
  // Cargo joggers with side pockets (pockets stand out on the overlay).
  const outRows = ['pppp', 'pqqp', 'pqqp', 'pppp', 'pRRp', 'pRRp', 'pppp', 'qqqq'];
  wear(s, 'rightLeg', {
    front: [...pantsF(7), 'qqqq', ...SNEAKER.front], back: [...pantsF(7), 'qqqq', ...SNEAKER.back],
    out: [...outRows, ...SNEAKER.out], in: [...pantsS(7), 'qqqq', ...SNEAKER.in], top: ['r', 'p'], bottom: ['4', '2']
  }, map);
  s.face('rightLeg', 'right', 'outer').paint(['    ', '    ', '    ', 'pppp', 'pRRp', 'pRRp', 'pppp'], map);
  s.mirrorLimbs();
  return s;
}

export default {
  style: 'clothing',
  updates: [
    {
      title: 'Skate Park Squad',
      note: 'Three new teens roll in from the skate park with a backwards cap, a knit beanie and a pair of headphones that never come off.',
      skins: [
        { name: 'Cobalt Kick', story: 'Cobalt Kick wears his red cap backwards and his hoodie strings uneven, and he still lands every kickflip first try.', build: cobaltKick },
        { name: 'Olive Drift', story: 'Olive Drift keeps a mustard beanie over the ginger hair and an olive bomber zipped open, cruising wherever the wind goes.', build: oliveDrift },
        { name: 'Berry Beats', story: 'Berry Beats sings along with her eyes closed, berry headphones on and an equalizer tee that jumps to every song.', build: berryBeats }
      ]
    },
    {
      title: 'Sunny Side Street',
      note: 'Summer hits the block: daisy braids and denim overalls, a coral crop top under a bucket hat and a tangerine tracksuit ready to race.',
      skins: [
        { name: 'Denim Daisy', story: 'Denim Daisy ties her braids with daisy clips and keeps a daisy patch on her overall pocket all summer long.', build: denimDaisy },
        { name: 'Coral Wave', story: 'Coral Wave lets her honey waves fall from under a cream bucket hat and wears a coral crop top with a little wave print.', build: coralWave },
        { name: 'Tangerine Track', story: 'Tangerine Track runs the whole block in a bright tracksuit, a white sweatband holding back his afro.', build: tangerineTrack }
      ]
    },
    {
      title: 'After Dark Arcade',
      note: 'When the street lights come on, the crew heads to the arcade in a letter jacket, a frosty puffer and a colour-block windbreaker.',
      skins: [
        { name: 'Plum Varsity', story: 'Plum Varsity wears round glasses and a plum letter jacket, top of the class and first in line at the arcade.', build: plumVarsity },
        { name: 'Frost Puff', story: 'Frost Puff zips her ice-blue puffer up to the chin, her pink bob tucked inside a fluffy white hood.', build: frostPuff },
        { name: 'Jade Pixel', story: 'Jade Pixel carries a crossbody bag full of arcade tokens, with jade tips on a shaggy wolf cut and a pixel heart pinned to the jacket.', build: jadePixel }
      ]
    }
  ]
};
