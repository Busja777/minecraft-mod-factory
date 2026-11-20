// Zombiefarmer Gang Skinpack: one template, many themes. Every farmer is a pillow-shaded zombie (four
// tones per material, dark edges, light centre), yellow eyes with dark pupils, a short-sleeved shirt
// over bare arms, a dark belt, trousers with two fold lines and dark boots. The overlay stays almost
// empty (≈ 91 % transparent): only the hat sits on it.
// Existing: Green (straw hat), Ice, Sausage (chef hat, apron), Water, Skeleton, Black Warrior (armour
// accents), Fire, Mushroom (red cap), Desert. They all share the flat round hat, so every new farmer
// gets its own headpiece, its own face and its own outfit idea.

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const mul = (c, f) => [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(c[i] * f)))).concat(255);

// The pack's four tones: K edge, D dark, M base, L light.
const tones = (color, base) => { const b = color.hex(base); return [mul(b, 0.42), mul(b, 0.7), b, color.mix(mul(b, 1.3), '#ffffff', 0.05)]; };

// Pillow shading like the hand-made farmers: dark corners and edges, light upper centre.
function pillow(f, R, { y0 = 0, y1 = f.h - 1 } = {}) {
  const w = f.w, h = y1 - y0 + 1;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) {
    const ly = y - y0, ex = Math.min(x, w - 1 - x);
    let i;
    if (w <= 4) {
      i = ly < h * 0.4 ? ([0, 2, 3, 1][x] ?? 2) : ([0, 1, 2, 0][x] ?? 1);
      if (ly === h - 1 && h > 2) i = Math.max(0, i - 1);
    } else {
      i = 2;
      if (ex === 0) i -= ly >= 1 && ly <= h * 0.45 ? 1 : 2;
      else if (ex === 1 && ly >= h * 0.6) i -= 1;
      if (ly === 0 && ex === 1) i -= 1;
      if (ly === h - 1) i -= 1;
      if (ex >= 2 && ly >= 1 && ly < h * 0.5) i += 1;
    }
    f.set(x, y, R[Math.max(0, Math.min(3, i))]);
  }
}

// A ramp as paint keys: rampKeys('abcd', ramp) → { a: K, b: D, c: M, d: L }
const keys = (chars, R) => Object.fromEntries([...chars].map((ch, i) => [ch, R[i]]));

// The farmer: skin, shirt, belt, trousers, boots in the pack's shading, then the theme on top.
//   o.skin/shirt/pants/belt/boots/gloves: base colours; o.sleeve: shirt rows on the arm (0 = bare);
//   o.shirtRows: body rows of the shirt (default 5); o.gloveRows; o.colors: extra paint keys;
//   o.inner(s, m): extra inner painting before the face (right limbs only, they get mirrored);
//   o.face: 8 rows on the head front; o.hat(s, m): overlay headpiece (before mirroring);
//   o.finish(s, m): last touches after mirroring (asymmetric details).
function zf({ Skin, color }, o) {
  const s = new Skin();
  const SK = tones(color, o.skin), SH = tones(color, o.shirt), PA = tones(color, o.pants);
  const BE = tones(color, o.belt || '#4b3c2a'), BO = tones(color, o.boots || '#3a2a1c');
  const GL = o.gloves ? tones(color, o.gloves) : null;
  const sleeve = o.sleeve ?? 3, shirtRows = o.shirtRows ?? 5, gloveRows = o.gloveRows ?? 3, bootRows = o.bootRows ?? 3;
  const m = {
    K: SK[0], D: SK[1], M: SK[2], L: SK[3],
    Y: color.hex('#c8c832'), P: color.hex('#1e0a0a'), k: color.hex('#32140f'),
    ...keys('1234', SH), ...keys('5678', PA), ...keys('wxyz', BO),
    ...Object.fromEntries(Object.entries(o.colors || {}).map(([c, v]) => [c, color.hex(v)]))
  };

  s.faces('head').forEach(f => pillow(f, SK));

  for (const f of s.faces('body')) {
    if (f.face === 'top') { pillow(f, SH); continue; }
    if (f.face === 'bottom') { pillow(f, PA); continue; }
    pillow(f, SH, { y1: shirtRows - 1 });
    for (let x = 0; x < f.w; x++) f.set(x, shirtRows, x % 4 === 1 || x % 4 === 2 ? BE[1] : BE[0]);
    pillow(f, PA, { y0: shirtRows + 1 });
    if (f.w === 8 && o.folds !== false) { f.col(2, PA[3], shirtRows + 1, shirtRows + 3); f.col(5, PA[3], shirtRows + 1, shirtRows + 3); }
  }
  if (o.neck !== false) s.face('body', 'front').set(3, 0, SK[1]).set(4, 0, SK[1]);

  for (const f of s.faces('rightArm')) {
    if (f.face === 'top') { pillow(f, sleeve ? SH : SK); continue; }
    if (f.face === 'bottom') { pillow(f, GL || SK); continue; }
    pillow(f, SK);
    if (sleeve) pillow(f, SH, { y1: sleeve - 1 });
    if (GL) pillow(f, GL, { y0: 12 - gloveRows });
  }
  for (const f of s.faces('rightLeg')) {
    if (f.face === 'top') { pillow(f, PA); continue; }
    if (f.face === 'bottom') { f.fill(BO[0]); continue; }
    pillow(f, PA, { y1: 11 - bootRows });
    pillow(f, BO, { y0: 12 - bootRows });
  }

  if (o.inner) o.inner(s, m);
  if (o.face) s.face('head', 'front').paint(o.face, m);
  if (o.hat) o.hat(s, m);
  s.mirrorLimbs();
  if (o.finish) o.finish(s, m);
  return s;
}

const HEAD_SIDES = ['right', 'left', 'back'];
const ALL_SIDES = ['front', 'right', 'left', 'back'];
const outer = (s, part, face) => s.face(part, face, 'outer');

// Overalls: straps and bib over the shirt, crossed straps on the back (s strap, S bib, o button).
function overalls(s, m, { pocket } = {}) {
  s.face('body', 'front').paint(['.s....s.', '.s....s.', '.oSSSSo.', '.sSSSSs.', '.sSSSSs.'], m);
  if (pocket) s.face('body', 'front').paint(pocket, m, { y: 2 });
  s.face('body', 'back').paint(['s......s', '.s....s.', '..s..s..', '...ss...', '...ss...'], m);
}

export default {
  style: 'hair',
  updates: [
    {
      title: 'Harvest Moon',
      note: 'When the harvest moon rises over the fields, three new farmers join the gang: one who grew a little too close to his pumpkins, one who guards the crows instead of scaring them, and one who keeps bees and regrets it.',
      skins: [
        {
          name: 'Zombie Farmer Pumpkin',
          story: 'He fell asleep in the pumpkin patch on harvest night and woke up carved, glowing and grinning, and honestly he likes it better this way.',
          build: kit => zf(kit, {
            skin: '#c4581a', shirt: '#5b3b7a', pants: '#3e5a2a', belt: '#2c2018', boots: '#3a2616',
            colors: { G: '#ffb21e', Y: '#fff27a', c: '#3a1404', s: '#2f4a20', S: '#45682e', o: '#e0b040', v: '#2f5a1e', V: '#5ea83a', t: '#4a3018' },
            inner: (s, m) => {
              for (const f of ['front', 'right', 'left', 'back']) { s.face('head', f).col(2, m.D, 1, 6); s.face('head', f).col(5, m.D, 1, 6); }
              s.face('head', 'top').paint(['........', '........', '...DD...', '..DttD..', '..DttD..', '...DD...', '........', '........'], m);
              overalls(s, m);
            },
            face: ['........', '.c....c.', 'cGc..cGc', 'GYG..GYG', '...cc...', 'cGYYYYGc', '.cY.cY.c', '..c..c..'],
            hat: (s, m) => { // stem, curly vine and a leaf
              outer(s, 'head', 'top').paint(['........', '.....VV.', '....V..V', '...tt..V', '...tt.V.', '..V.....', '.VVV....', '..V.....'], m);
              outer(s, 'head', 'front').paint(['.vVtt...', '..v.....'], m);
              outer(s, 'head', 'right').paint(['......vV', '.......v'], m);
            }
          })
        },
        {
          name: 'Zombie Farmer Scarecrow',
          story: 'The crows took pity on the old scarecrow, so now he stands in the cornfield with button eyes and a stitched smile and lets them eat whatever they like.',
          build: kit => zf(kit, {
            skin: '#b8955a', shirt: '#a8382e', pants: '#4a6a9a', belt: '#c8a860', boots: '#d8b85a', sleeve: 9, bootRows: 2,
            colors: { B: '#2a2420', b: '#6a625a', t: '#4a3420', p: '#7a5a30', h: '#e3c46b', H: '#f2dc8a', j: '#b8963e', r: '#8a2a22', c: '#4a1a16' },
            inner: (s, m) => {
              s.faces('head').forEach(f => f.noise(0.08, 'sack'));
              s.face('head', 'back').col(3, m.t, 0, 7);
              // flannel checks on shirt and sleeves
              for (const f of s.sides('body')) { f.row(2, m.c, 0, f.w - 1); f.col(f.w === 8 ? 2 : 1, m.c, 0, 4); if (f.w === 8) f.col(5, m.c, 0, 4); }
              for (const f of s.sides('rightArm')) { f.row(2, m.c); f.row(6, m.c); f.col(1, m.c, 0, 8); }
              // straw hands and ankles, a patch on the shirt and on one knee
              for (const f of s.sides('rightArm')) f.paint(['....', '....', '....', '....', '....', '....', '....', '....', '....', 'hHjh', 'jhHj', 'hjhH'], m);
              s.face('rightArm', 'bottom').fill(m.h);
              s.face('body', 'front').paint(['.....pp.', '.....pp.'], m, { y: 1 });
              s.face('rightLeg', 'front').paint(['.pp.', '.pp.'], m, { y: 5 });
            },
            face: ['........', '........', '.....t.t', '.Bb...t.', '.BB..t.t', '........', '.P.P.P.P', '..PPPP..'],
            hat: (s, m) => { // wide straw hat: full crown, red band, straw poking out underneath
              outer(s, 'head', 'top').texture([[m.h, 4], [m.H, 2], [m.j, 2]], 'scarecrow-hat');
              for (const f of ALL_SIDES) outer(s, 'head', f).paint(['hHhjhHhj', 'rrrrrrrr', 'HhHHhHjH'], m);
              for (const f of HEAD_SIDES) outer(s, 'head', f).paint(['h.j..h.H', '.h....j.'], m, { y: 3 });
              for (const f of ALL_SIDES) outer(s, 'rightArm', f).paint(['h.H.', '.j.h'], m, { y: 10 });
              for (const f of ALL_SIDES) outer(s, 'rightLeg', f).paint(['H..h'], m, { y: 10 });
            }
          })
        },
        {
          name: 'Zombie Farmer Beekeeper',
          story: 'He lifted his veil for just one second to smell the honey, and the bees have been reminding him of it ever since.',
          build: kit => zf(kit, {
            skin: '#50823c', shirt: '#e6e2d4', pants: '#d6d2c2', belt: '#b8b4a4', boots: '#2e3a26', gloves: '#d9a030', gloveRows: 5,
            colors: { p: '#d46a6a', q: '#f09a9a', o: '#3a2010', H: '#f0ece0', h: '#c8c2b0', n: '#2a2a2a', g: '#5a5a5a', z: '#8a8a8a', A: '#ffb81e', a: '#c8820e', y: '#ffd21e', b: '#151515', W: '#ffffff' },
            inner: (s, m) => {
              const f = s.face('body', 'front');
              f.col(4, m.z, 1, 10);
              f.paint(['......A.', '......a.', '.....A..'], m, { y: 6 });
              s.face('body', 'back').paint(['...yy...', '..bbbb..', '..yyyy..', '...bb...'], m, { y: 2 });
            },
            face: ['........', '........', '.....pp.', '.YP..qP.', '.....pp.', '...kk...', '...kk...', '........'],
            hat: (s, m) => { // beekeeper hat with the veil rolled up around it, the veil hangs down at the back
              outer(s, 'head', 'top').paint(['..hhhh..', '.hHHHHh.', 'hHHHHHHh', 'hHHHHHHh', 'hHHHHHHh', 'hHHHHHHh', '.hHHHHh.', '..hhhh..'], m);
              for (const f of ALL_SIDES) outer(s, 'head', f).paint(['hHHHHHHh', 'ngngngng', 'gngngngn'], m);
              outer(s, 'head', 'back').paint(['ngngngng', 'g.g.g.g.', '.g.g.g.g'], m, { y: 3 });
              for (const f of ALL_SIDES) outer(s, 'rightArm', f).row(7, m.a);
              // bees: on the hat, the shoulder and the chest
              outer(s, 'head', 'front').paint(['.....yb.'], m, { y: 0 });
            },
            finish: (s, m) => {
              outer(s, 'body', 'front').paint(['.yb.....', 'W.......'], m, { y: 3 });
              outer(s, 'leftArm', 'front').paint(['..by', '...W'], m, { y: 1 });
              outer(s, 'head', 'right').paint(['........', '........', '........', '.......y', '......b.'], m);
            }
          })
        }
      ]
    },
    {
      title: 'The Barnyard Gang',
      note: 'The animals on the farm got tired of being chased, so the gang made friends with them instead: one farmer moved into a cow costume, one lets a chicken nest on his head, and one simply became a pig.',
      skins: [
        {
          name: 'Zombie Farmer Cow',
          story: 'The herd only listens to one of their own, so he zipped himself into a spotted cow suit, horns and all, and has been chewing the same piece of wheat for a week.',
          build: kit => zf(kit, {
            skin: '#4f8a5a', shirt: '#ecebe4', pants: '#ecebe4', belt: '#d4d2c8', boots: '#3e3636', gloves: '#4a4040', sleeve: 9, folds: false, neck: false,
            colors: { b: '#1c1a1a', q: '#f0a0b0', Q: '#d87890', h: '#e8c84a', H: '#efe6cc', j: '#b8aa88', G: '#f0c030', g: '#a87a10', r: '#b0202a' },
            inner: (s, m) => {
              const spots = { top: ['........', '.bb.....', '.bbb..b.', '......bb', '...b....', '..bbb...', '........', '.....bb.'], right: ['..bb....', '.bbbb...', '..bb..b.', '......bb', '........', '.bb.....', '........', '........'], back: ['........', '..bbb...', '.bbbb.b.', '..bb..bb', '........', '....bb..', '...bbb..', '........'] };
              for (const f of ['top', 'right', 'left', 'back']) { pillow(s.face('head', f), [m[1], m[2], m[3], m[4]]); s.face('head', f).paint(spots[f === 'left' ? 'right' : f], m); }
              s.face('head', 'left').flipX();
              s.face('body', 'front').paint(['rrrrrrrr', '.bb.....', 'bbb.....', '.b......', '........', '........', '..qqqq..', '.qQqqQq.', '..qqqq..', '........', '......bb', '.....bbb'], m);
              s.face('body', 'back').paint(['rrrrrrrr', '.....bb.', '....bbbb', '.....bb.', '........', '........', '.bb.....', 'bbbb....', '.bb.....', '........', '......b.', '.....bbb'], m);
              for (const f of s.sides('rightArm')) f.paint(['....', '.bb.', 'bbb.', '....', '....', '..bb', '..b.'], m);
              for (const f of s.sides('rightLeg')) f.paint(['....', '.bb.', '.bbb', '..b.', '....', '....', 'bb..', 'b...'], m);
            },
            face: ['23333332', '34444443', '3......3', '3YP..PY3', '3.....h3', '3....h.3', '3.kkh..3', '23333332'],
            hat: (s, m) => { // horns and pink ears on the hood, a cowbell on the collar
              outer(s, 'head', 'top').paint(['........', '........', '........', '........', '........', 'j......j', 'H......H', 'H......H'], m);
              outer(s, 'head', 'front').paint(['H......H', 'j......j'], m);
              outer(s, 'head', 'right').paint(['......Hj', '.....qQ.', '.....QQ.'], m);
              outer(s, 'head', 'left').paint(['jH......', '.Qq.....', '.QQ.....'], m);
              outer(s, 'body', 'front').paint(['...gg...', '...GG...', '...Gg...'], m);
              outer(s, 'body', 'back').paint(['...b....', '...b....', '..bbb...'], m, { y: 7 });
            }
          })
        },
        {
          name: 'Zombie Farmer Chicken',
          story: 'A brown hen chose his straw hair as the warmest nest on the farm, and he is far too scared of her beak to ever take it off.',
          build: kit => zf(kit, {
            skin: '#8a9e46', shirt: '#d8a038', pants: '#3f5f8f', belt: '#2a3a5a', boots: '#5a3a20',
            colors: { s: '#2e4670', S: '#4a6aa0', o: '#e0b040', E: '#f4f0e4', e: '#c8c0a8', c: '#f0d0a0', C: '#c8a070', n: '#a07a3a', N: '#d8b060', W: '#f4f2ea', w: '#c8c4b8', R: '#d02a2a', O: '#f09a1e', b: '#141414' },
            inner: (s, m) => overalls(s, m, { pocket: ['........', '...EE...', '...ee...'] }),
            face: ['........', '........', '........', '.YP..PY.', '.YY..YY.', '.....cCc', '...kk...', '........'],
            hat: (s, m) => { // a straw nest with a hen sitting in it, beak to the front
              outer(s, 'head', 'top').paint(['.nNnnNn.', 'nNWWWWNn', 'nWwWWwWn', 'nWWWWWWn', 'nnWwwWnn', 'N.WRRW.N', 'nn.WW.nn', '.nnOOnn.'], m);
              outer(s, 'head', 'front').paint(['nWbWWbWn', 'NnWOOWnN', 'n.NRRN.n'], m);
              for (const f of HEAD_SIDES) outer(s, 'head', f).paint(['nNnNNnNn', 'N..n.N..'], m);
              outer(s, 'body', 'front').paint(['W.......', '.......w'], m);
            },
            finish: (s, m) => { outer(s, 'leftArm', 'front').paint(['.W..', '..w.'], m, { y: 4 }); }
          })
        },
        {
          name: 'Zombie Farmer Pig',
          story: 'He spent one hot summer rolling in the mud with the pigs, and when the mud finally dried he came out pink, snouted and with a curly little tail.',
          build: kit => zf(kit, {
            skin: '#e08a96', shirt: '#e6e2d6', pants: '#6a4a2e', belt: '#3a2618', boots: '#3a2a1c', sleeve: 0,
            colors: { q: '#f4b0b8', Q: '#f8c8cc', n: '#5a2a30', e: '#c06070', E: '#a84858', u: '#6a4a24', U: '#8a6430', r: '#b02a2a' },
            inner: (s, m) => {
              s.face('body', 'front').paint(['.r....r.', '.r...ur.', '.r..uur.', '.r....r.', '.ru...r.'], m);
              s.face('body', 'front').col(0, m[1], 0, 4).col(7, m[1], 0, 4);
              s.face('body', 'back').paint(['.r....r.', '..r..r..', '...rr...', '...rr...', '...rr...'], m);
              s.face('rightLeg', 'front').paint(['....', '....', '.u..', 'uUu.', '....', '....', '..u.', '.uUu'], m);
              s.face('head', 'front').paint(['.....u..', '....uUu.'], m);
            },
            face: ['........', '........', '........', '.YP..PY.', '..qQQq..', '..nQQn..', '...kk...', '........'],
            hat: (s, m) => { // floppy ears, a snout that stands off the face, mud on the boots
              outer(s, 'head', 'top').paint(['........', '........', '........', '........', '........', '........', 'ee....ee', 'Ee....eE'], m);
              outer(s, 'head', 'front').paint(['Ee....eE', 'e......e'], m);
              outer(s, 'head', 'front').paint(['qQQq', 'nQQn'], m, { x: 2, y: 4 });
              for (const f of ALL_SIDES) outer(s, 'rightLeg', f).paint(['U.u.', 'uUuU'], m, { y: 8 });
              outer(s, 'body', 'back').paint(['...Q....', '....q...', '...q....'], m, { y: 7 });
            }
          })
        }
      ]
    },
    {
      title: 'Wild Weather',
      note: 'Rain, sun and fog all arrived at the farm in the same week, and three farmers came back changed: one with his own personal storm cloud, one who turned towards the sun, and one who never left the flooded field.',
      skins: [
        {
          name: 'Zombie Farmer Storm',
          story: 'A small grey rain cloud followed him home from the fields one afternoon, and now it waters his crops, soaks his coat and strikes his hat whenever he complains.',
          build: kit => zf(kit, {
            skin: '#6f8a9a', shirt: '#e8c22a', pants: '#4a4a52', belt: '#a88a14', boots: '#3f7a3a', sleeve: 10, shirtRows: 8, bootRows: 6,
            colors: { n: '#3a2e10', w: '#7ac8ff', W: '#c8ecff', C: '#d8dee6', c: '#a8b2be', V: '#7a8692', B: '#fff27a', b: '#ffc21e' },
            inner: (s, m) => {
              s.face('body', 'front').col(4, m[2], 1, 7).paint(['...n....', '........', '...n....', '........', '...n....', '........', '...n....'], m, { y: 1 });
              for (const f of s.sides('rightLeg')) pillow(f, [m[1], m[2], m[3], m[4]], { y1: 3 });
              s.face('rightLeg', 'top').fill(m[3]);
            },
            face: ['........', '........', '........', '.DD..DD.', '.YP..PY.', '.w......', '..kkkk..', '.k....k.'],
            hat: (s, m) => { // the rain cloud sits on his head, a little lightning bolt drops out of it
              outer(s, 'head', 'top').texture([[m.C, 4], [m.c, 3], [m.W, 1]], 'storm-cloud');
              for (const f of ALL_SIDES) outer(s, 'head', f).paint(['cCCcCCcC', 'VcCVcCcV', 'V..V..cV'], m);
              outer(s, 'head', 'front').paint(['....B...', '...Bb...', '...b....'], m, { y: 1 });
              outer(s, 'head', 'front').paint(['.w.....w', '......w.'], m, { y: 3 });
              outer(s, 'rightArm', 'top').paint(['.w..', '...W'], m);
              outer(s, 'body', 'front').paint(['.w....W.', '........', '......w.'], m, { y: 2 });
            }
          })
        },
        {
          name: 'Zombie Farmer Sunflower',
          story: 'He stood in the sunflower field for so many summers, always turned towards the sun, that the petals finally grew all the way around his face.',
          build: kit => zf(kit, {
            skin: '#5a9a3c', shirt: '#5a9ad0', pants: '#5a4030', belt: '#3a2a1c', boots: '#2e2218', folds: false,
            colors: { p: '#f2b81e', P: '#ffd84a', o: '#c88a10', V: '#5ab83a', v: '#2e7a1e', u: '#8a6a3a', U: '#b08a4a' },
            inner: (s, m) => {
              s.face('body', 'front').paint(['......u.', '.....uUu', '.....uuu'], m, { y: 5 });
              s.face('body', 'front').paint(['.v......', '.v.v....', '.vv.....', '.v......'], m, { y: 1 });
              s.face('body', 'back').paint(['..pPp...', '.pouUop.', 'PuUuuUuP', 'pUuUUuUp', '.pouUop.', '..pPp...'], m, { y: 1 });
            },
            face: ['........', '........', '........', '.kk..kk.', '........', '.k....k.', '..kkkk..', '........'],
            hat: (s, m) => { // a ring of petals around the face, seeds on top, leaves on the shoulders
              outer(s, 'head', 'front').paint(['oP.PP.Po', 'P......P', 'p......p', '........', 'P......P', 'p......p', '........', 'oP.PP.Po'], m);
              outer(s, 'head', 'right').paint(['......Po', '......pP', '.......p', '........', '......PP', '.......p', '........', '......oP'], m);
              outer(s, 'head', 'left').paint(['oP......', 'Pp......', 'p.......', '........', 'PP......', 'p.......', '........', 'Po......'], m);
              outer(s, 'head', 'top').paint(['........', '........', '..uUu...', '.uUuUu..', '..uUuU..', '...uu...', 'P.pPPp.P', 'oP.PP.Po'], m);
              outer(s, 'rightArm', 'front').paint(['.Vv.', 'VVv.', '.v..'], m);
              outer(s, 'rightArm', 'right').paint(['..vV', '.vVV'], m);
            }
          })
        },
        {
          name: 'Zombie Farmer Swamp',
          story: 'He went to check the flooded rice field and simply never came back out, so now a lily pad shades his head, a frog keeps him company and his eyes glow like fireflies.',
          build: kit => zf(kit, {
            skin: '#6b7a3a', shirt: '#6a5236', pants: '#2f4a3a', belt: '#1e3026', boots: '#1e3026', sleeve: 2,
            colors: { s: '#1e3026', S: '#2f4a3a', o: '#a8a8a0', G: '#d8ff5a', v: '#3a6a1e', V: '#5a9a2a', l: '#2e6a22', L: '#4a9a32', f: '#8ad03a', F: '#b8f05a', e: '#f0f0d8', b: '#141414', w: '#5aa8b8' },
            inner: (s, m) => {
              s.face('body', 'front').paint(['.s....s.', '.oSSSSo.', '.SSSSSS.', '.SSSSSS.', '.SSSSSS.', 'SSSSSSSS'], m);
              s.face('body', 'back').paint(['.s....s.', '.s....s.', '.SSSSSS.', '.SSSSSS.', '.SSSSSS.', 'SSSSSSSS'], m);
              s.face('rightLeg', 'front').paint(['....', '....', '....', '....', '.w..', 'wwww'], m, { y: 3 });
            },
            face: ['........', '........', '.D....D.', '.GP..PG.', '........', '..kkkk..', '..v..v..', '..V.....'],
            hat: (s, m) => { // a lily pad with a frog on it, moss hanging from the arms
              outer(s, 'head', 'top').paint(['..lLLl..', '.lLLLLl.', 'lLLLlLLl', 'lLLfFfLl', 'lLfFFFfl', 'lLeFFeLl', '.lfbLbf.', '..lLLl..'], m);
              outer(s, 'head', 'front').paint(['lLbFFbLl', '.lFffF..', '..f..f..'], m);
              for (const f of HEAD_SIDES) outer(s, 'head', f).paint(['lLlLLlLl', '.l....l.'], m);
              outer(s, 'head', 'back').paint(['lL  lLlL'], m);
              for (const f of ['front', 'right']) outer(s, 'rightArm', f).paint(['V..v', 'v..V', '...v', '...V', '....', '...v'], m, { y: 2 });
              for (const f of ['front', 'left']) outer(s, 'rightLeg', f).paint(['v...', 'V...', 'v...'], m);
            }
          })
        }
      ]
    }
  ]
};
