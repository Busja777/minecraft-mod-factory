// Hidden Archers — classic hooded archers. Existing: Crimson Shadow, Emerald Forest, Midnight Void,
// Desert Sand, Frost Shadow, Toxic Shadow, Dusk Ember — one template in seven colours: a radially shaded hood
// (bright centre, dark edges) with a small opening and ONE glowing eye, a dark mask below, a short shoulder
// collar, hood-coloured sleeves over grey gloves, dark trousers, leather boots and belt.
//
// The kit has no hood like that, so the pack has its own builder: archer(spec, paint). It draws the template,
// then `paint` adds what makes each archer different (mask, chest, quiver, bracers, greaves).
// Paint keys: hood ramp e a b c d k (dark → light), mask j h i, eye f (colour) g (white core),
//             tunic l m n o p, leather q r s w, gloves t u v, accent x y z, K black, W white.
// '.' keeps a pixel, ' ' clears it (overlay). Arms are 4 wide (3 when slim).

const PARTS = ['head', 'body', 'rightArm', 'rightLeg'];
const SIDES = ['front', 'back', 'right', 'left'];

function archer(spec, paint) {
  return ({ Skin, color }) => {
    const { hex, shade, rng } = color;
    const slim = !!spec.slim;
    const s = new Skin({ slim });
    const r = rng(`archer${spec.seed}`);
    const H = spec.hood.map(hex);                                             // 6 steps
    const T = (spec.tunic || ['#16161a', '#232126', '#343037', '#46414b', '#5c5564']).map(hex);
    const L = (spec.leather || ['#2a1c10', '#412d19', '#5c4426', '#7a5c34']).map(hex);
    const G = (spec.gloves || ['#3c3c41', '#646468', '#94969b']).map(hex);
    const X = (spec.accent || ['#555555', '#888888', '#bbbbbb']).map(hex);
    const map = {
      e: H[0], a: H[1], b: H[2], c: H[3], d: H[4], k: H[5],
      j: shade(H[0], 0.8), h: shade(H[1], 0.75), i: shade(H[1], 0.95),
      f: hex(spec.eye), g: hex(spec.eyeCore || '#f0eee8'),
      l: T[0], m: T[1], n: T[2], o: T[3], p: T[4], q: L[0], r: L[1], s: L[2], w: L[3], t: G[0], u: G[1], v: G[2],
      x: X[0], y: X[1], z: X[2], K: color.BLACK, W: color.WHITE
    };
    const ramp = { hood: [H[0], H[1], H[2], H[3], H[4], H[5]], tunic: T, leather: [L[0], L[1], L[2], L[3]], gloves: [G[0], G[1], G[2]] };

    // Radial shading like the hand-made pack: dark rim, bright middle, lower part darker, some jitter.
    const shadeFace = (f, R, { lift = 0, y0 = 0, y1 = f.h - 1 } = {}) => {
      const half = Math.max(1, (f.w - 1) / 2), flat = f.face === 'top' || f.face === 'bottom';
      for (let y = y0; y <= y1; y++) for (let x = 0; x < f.w; x++) {
        let t = Math.min(x, f.w - 1 - x) / half;
        if (flat) t = Math.min(t, Math.min(y, f.h - 1 - y) / ((f.h - 1) / 2));
        let l = 1 + Math.round(t * (R.length - 3)) + lift;
        if (!flat && y > f.h * 0.7) l -= 1;
        if (!flat && y < f.h * 0.3 && y > 0) l += 1;
        if (r() < 0.06) l += r() < 0.5 ? -1 : 1;
        f.set(x, y, R[Math.max(0, Math.min(R.length - 1, l))]);
      }
    };

    // ── Template ──
    for (const fc of ['top', 'bottom', ...SIDES]) shadeFace(s.face('head', fc), ramp.hood, { lift: -1 });
    for (const fc of ['top', 'bottom', ...SIDES]) shadeFace(s.face('head', fc, 'outer'), ramp.hood);
    // Face: hood rim, dark opening with the eye, mask below; the overlay keeps the opening free.
    s.face('head', 'front').paint(['........', '........', '........', 'ea.gg.ae', 'eaKffKae', 'hhiiiihh', 'jhiiiihj', 'jjhhhhjj'], map);
    s.face('head', 'front').paint(['..f..f..'], map, { y: 3 });
    s.face('head', 'front', 'outer').paint(['........', '........', '........', '..    ..', '..    ..'], map);
    // Body: dark tunic, leather belt.
    for (const fc of ['top', 'bottom', ...SIDES]) shadeFace(s.face('body', fc), ramp.tunic);
    for (const fc of SIDES) s.face('body', fc).paint(['K' + 'r'.repeat(s.face('body', fc).w - 2) + 'K', 'q'.repeat(s.face('body', fc).w)], map, { y: 4 });
    // Arms: hood-coloured sleeves, gloves.
    for (const fc of ['top', ...SIDES]) shadeFace(s.face('rightArm', fc), ramp.hood, { y1: fc === 'top' ? 3 : 5 });
    for (const fc of SIDES) shadeFace(s.face('rightArm', fc), ramp.gloves, { y0: 6 });
    s.face('rightArm', 'bottom').fill(map.t);
    // Legs: tunic-coloured trousers, leather boots.
    for (const fc of ['top', ...SIDES]) shadeFace(s.face('rightLeg', fc), ramp.tunic);
    for (const fc of SIDES) s.face('rightLeg', fc).paint(['KrrK', 'KqrK', 'KqqK'], map, { y: 9 });
    s.face('rightLeg', 'bottom').fill(map.q);

    const P = (part, face, rows, { layer = 'inner', x = 0, y = 0 } = {}) => {
      const f = s.face(part, face, layer);
      rows.forEach((row, n) => { if (row.length + x > f.w) throw new Error(`${part}.${face}.${layer} row ${n} is ${row.length} wide, face is ${f.w}`); });
      if (rows.length + y > f.h) throw new Error(`${part}.${face}.${layer} has ${rows.length} rows, face is ${f.h}`);
      f.paint(rows, map, { x, y });
    };
    const O = (part, face, rows, at = {}) => P(part, face, rows, { ...at, layer: 'outer' });
    const fit = rows => (slim ? rows.map(x => x.slice(0, 1) + x.slice(2)) : rows); // 4-wide limb rows → 3-wide
    paint({ s, P, O, fit, map, shadeFace, ramp });
    s.mirrorLimbs();
    return s;
  };
}

const blank = (w, n) => Array(n).fill(' '.repeat(w));

export default {
  style: 'accent',
  updates: [
    {
      title: 'Tide, Blossom and Storm',
      note: 'Three more eyes open at the edges of the map: the Tide Shell Archer rises from the reef, the Blossom Veil Archer drifts down from the blossom valleys and the Storm Peak Archer climbs out of the thunderclouds.',
      skins: [
        {
          name: 'Tide Shell Archer',
          story: 'The Tide Shell Archer rises from the reef in a sea-green hood and a mask of shell scales, and one coral eye glows like a lantern under the waves.',
          build: archer({
            seed: 81, eye: '#ff7a5c', eyeCore: '#fff1ea',
            hood: ['#062a26', '#0b4a42', '#127064', '#1b968a', '#2bbfae', '#62e2d2'],
            tunic: ['#0d1a1c', '#132628', '#1c3638', '#27494b', '#355f60'],
            accent: ['#a4483a', '#e0705a', '#ffb39e']
          }, ({ P, O, fit }) => {
            // Shell-scale mask over the mouth (overlay).
            O('head', 'front', ['bcbcbcbc', 'cbdbbdbc', 'bcbccbcb'], { y: 5 });
            // A fin crest along the hood's top and back.
            O('head', 'top', ['   kk   ', '   kd   ', '   dd   ', '   dc   ', '   cc   ', '   dc   ', '   kd   ', '   kk   ']);
            O('head', 'back', ['   kk   ', '   dc   ', '   cc   ', '   cb   ']);
            // Fish-scale tunic, a sea-glass buckle.
            P('body', 'front', ['........', '........', '........', '........', '.rrwwrr.', 'qqqkkqqq', 'nmnmnmnm', 'mnonmnon', 'nmnmnmnm', 'mnonmnon', 'nmnmnmnm', 'lmlmlmlm']);
            P('body', 'back', ['........', '........', '........', '........', '........', '........', 'nmnmnmnm', 'mnonmnon', 'nmnmnmnm', 'mnonmnon', 'nmnmnmnm', 'lmlmlmlm']);
            // Fin mantle on the shoulders, a coral-fletched quiver on the back.
            O('body', 'front', ['bcd  dcb', 'cd    dc', 'b      b']);
            O('body', 'back', ['bc   yzy', 'b    rwr', '    rwr ', '   rwr  ', '  rwr   ', ' rwr    ', 'qrq     ', 'qq      ']);
            // Bandaged forearms with a coral band, shell pauldrons.
            for (const fc of ['front', 'back', 'right', 'left']) P('rightArm', fc, fit(['uttu', 'tuut', 'uttu', 'yyyy', 'tuut', 'uttu']), { y: 6 });
            O('rightArm', 'front', fit(['dkkd', 'cddc', ' cc ']));
            for (const fc of ['right', 'left', 'back']) O('rightArm', fc, fit(['cddc', 'bccb', '    ']));
            O('rightArm', 'top', fit(['dddd', 'dkkd', 'dkkd', 'dddd']));
            for (const fc of ['front', 'right', 'left', 'back']) O('rightArm', fc, fit(['yyyy']), { y: 9 });
            // Legs: fin flaps on the boots.
            for (const fc of ['front', 'back']) P('rightLeg', fc, ['mnnm', 'nmmn'], { y: 5 });
            for (const fc of ['right', 'left']) O('rightLeg', fc, ['c  c', 'dccd', ' cc '], { y: 8 });
            O('rightLeg', 'front', ['    ', 'rrrr', 'qrrq'], { y: 8 });
          })
        },
        {
          name: 'Blossom Veil Archer',
          slim: true,
          story: 'The Blossom Veil Archer drifts down from the valleys in a pink hood and a lace veil, and petals fall wherever her leaf-green eye takes aim.',
          build: archer({
            seed: 82, slim: true, eye: '#8cff6a', eyeCore: '#f4fff0',
            hood: ['#3a0c22', '#5e1638', '#8a2452', '#b8386e', '#e05a90', '#ff9cc4'],
            tunic: ['#1c1218', '#2a1a24', '#3a2632', '#4c3442', '#614456'],
            accent: ['#2f7a3a', '#4fae58', '#ffe6f0']
          }, ({ P, O, fit }) => {
            // Lace veil over the lower face, petals stuck to the hood.
            O('head', 'front', ['k k k k ', ' k k k k', 'k k k k '], { y: 5 });
            O('head', 'top', ['.....z..', '........', '.z......', '........', '......z.', '...z....', '........', '.z....z.']);
            O('head', 'right', ['.z......', '........', '....z...', '........', '........', '..z.....', '........', '........']);
            O('head', 'left', ['......z.', '........', '...z....', '........', '........', '.....z..', '........', '........']);
            // Petals on the tunic, a strap across the chest (bow strap) with a leaf clasp.
            P('body', 'front', ['r.......', '.r..d...', '..r.....', '...r..d.', '....yy..', 'qqqqqrqq', '.d....r.', '......r.', '...d...r', '.......r', '.d......', '........']);
            O('body', 'front', ['rcd  dcr', 'cr    dc', '  r     ', '   r    ', '    y   ', '        ', '        ', '        ', '        ', '        ', '        ', '        ']);
            // A long hood-coloured cape on the back.
            O('body', 'back', ['bccccccb', 'bcddddcb', 'bcdkkdcb', 'bcddddcb', 'bccddccb', 'bccccccb', 'abccccba', 'abccccba', 'aabccbaa', 'eabbbbae', 'e abba e', '  a  a  ']);
            // Long pink sleeves with a petal cuff, short gloves.
            for (const fc of ['front', 'back', 'right', 'left']) P('rightArm', fc, fit(['bccb', 'bccb', 'abba', 'dkkd', 'tuut', 'uvvu']), { y: 6 });
            O('rightArm', 'front', fit(['cdd ', 'bc  ']));
            for (const fc of ['front', 'right', 'left', 'back']) O('rightArm', fc, fit(['dkkd']), { y: 9 });
            // A short skirt over dark leggings.
            for (const fc of ['front', 'right', 'left', 'back']) P('rightLeg', fc, ['bccb', 'bccb', 'abba'], { y: 0 });
            for (const fc of ['front', 'right', 'left', 'back']) O('rightLeg', fc, ['cddc', 'bccb', 'abba', 'a  a']);
          })
        },
        {
          name: 'Storm Peak Archer',
          story: 'The Storm Peak Archer climbs out of the thunderclouds in a slate-blue hood, and a single yellow eye flashes a heartbeat before the lightning arrow lands.',
          build: archer({
            seed: 83, eye: '#ffd21a', eyeCore: '#fffbe2',
            hood: ['#0e1220', '#1a2136', '#28324f', '#3a4870', '#506296', '#7488c2'],
            tunic: ['#121318', '#1c1e25', '#2a2d36', '#3a3e4a', '#4e5361'],
            gloves: ['#4a4e58', '#7a808c', '#b4bac4'],
            accent: ['#b08a00', '#ffd21a', '#d8dce4']
          }, ({ P, O, fit }) => {
            // Lightning trim round the hood opening, a bolt on the mask.
            O('head', 'front', ['.y....y.', '..y..y..', '........', '.y....y.', '.y....y.', 'b..y...b', 'c..yy..c', 'b...y..b']);
            for (const fc of ['right', 'left']) O('head', fc, ['y.......', '.y.....y', '..y...y.', '...y.y..', '....y...'], { y: 3 });
            // Steel chest plate with a lightning bolt.
            P('body', 'front', ['........', '.uvvvvu.', '.uvuyvu.','.uuyyuu.', '........', '........', '.tuuyut.', '.tuyuut.', '..tyut..', '........', '........', '........']);
            O('body', 'front', ['ccd  dcc', 'zz    zz', 'z      z', '        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ']);
            // Storm-cloud mantle on the back with a quiver.
            O('body', 'back', ['zzvzzvzz', 'vzzvvzzv', ' vv  vqr', '     qwr', '    qwr ', '   qwr  ', '  qwr   ', '  qq    ']);
            // Steel bracers with a yellow stripe.
            for (const fc of ['front', 'back', 'right', 'left']) P('rightArm', fc, fit(['uvvu', 'yyyy', 'tuut', 'uvvu', 'tuut']), { y: 6 });
            for (const fc of ['front', 'right', 'left', 'back']) O('rightArm', fc, fit(['vzzv', 'yyyy', 'uvvu']), { y: 6 });
            O('rightArm', 'front', fit(['zvvz', 'vzzv']));
            O('rightArm', 'top', fit(['vvvv', 'vzzv', 'vzzv', 'vvvv']));
            // Steel greaves with a yellow knee.
            for (const fc of ['front', 'back', 'right', 'left']) P('rightLeg', fc, ['tuut', 'uyyu', 'tuut', 'uvvu'], { y: 4 });
            O('rightLeg', 'front', ['    ', 'vyyv', 'uvvu', '    ', '    ', 'vzzv'], { y: 4 });
            for (const fc of ['right', 'left', 'back']) O('rightLeg', fc, ['    ', 'uvvu', '    ', '    ', '    ', 'uvvu'], { y: 4 });
          })
        }
      ]
    }
  ]
};
