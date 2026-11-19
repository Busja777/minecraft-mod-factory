// Old Grandpa Skinpack: friendly grandpas on the Steve template. Pack look (hand-made V1.0–V1.1): soft
// shading on every face (dark corners, one step darker at the edges, light middle), a V of shade on the
// shirt, the shirt ends at body row 7 and the trousers take the last four rows, sleeves end above the
// elbow or at the wrist, shoes are the darkest three leg rows. Eyes are a white pixel and a coloured iris on
// the inner side; grey or white hair and beards sit on the overlay (≈ 90 % transparent). Existing:
// Herbert, Clarence, Friedrich, Takeshi, Gunther, Gunter, Heinz, Leopold, Walter. Each new grandpa
// gets a hobby or outfit idea that reads from the front (a hat, glasses, an apron, a beard, a lantern).

const F = (s, part, face, layer = 'inner') => s.face(part, face, layer);
const SIDES = ['front', 'right', 'back', 'left'];
const ALL = ['top', 'bottom', ...SIDES];

// 5 tones: corner, edge, mid, light, highlight.
const tones = (color, base) => { const b = color.hex(base); return [color.shade(b, 0.62), color.shade(b, 0.76), color.shade(b, 0.89), b, color.shade(b, 1.12)]; };

// The pack's soft shading between rows y0..y1 of a face.
function soft(f, R, y0 = 0, y1 = f.h - 1) {
  const h = y1 - y0 + 1;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < f.w; x++) {
    const ex = Math.min(x, f.w - 1 - x), ly = y - y0;
    let i = f.w === 4 ? [1, 2, 3, 1][x] : ex === 0 ? 1 : ex === 1 ? 2 : 3;
    if (ly === 0 && y0 === 0 || ly === h - 1) i -= 1;
    if (f.w === 8 && ex >= 2 && ly >= 1 && ly <= 2 && h > 6) i += 1;
    f.set(x, y, R[Math.max(0, Math.min(4, i))]);
  }
}
// The V of shade on the shirt front (from the collar down to the waist).
function vShade(f, R) { f.paint(['........', '........', '........', 'd......d', 'dd....dd', 'dd....dd', 'ddd..ddd', 'dddddddd'], { d: R[1] }); }

// o: skin, eyes, shirt, pants, shoes, sleeve ('short' | 'long' | 'rolled'), hair { color, style }, brows,
//    mouth, beard { color, kind: 'moustache' | 'full' | 'stubble' }, vNeck, extras(s, m) before mirroring,
//    finish(s, m) after mirroring. m holds every ramp as a map of paint keys.
function opa({ Skin, color }, o) {
  const s = new Skin();
  const SK = tones(color, o.skin), SH = tones(color, o.shirt), PA = tones(color, o.pants), SO = tones(color, o.shoes || '#3a2e24');
  const HA = tones(color, o.hair?.color || '#c8c6c0');
  const m = {
    a: SK[0], b: SK[1], c: SK[2], d: SK[3], e: SK[4],
    1: SH[0], 2: SH[1], 3: SH[2], 4: SH[3], 5: SH[4],
    6: PA[0], 7: PA[1], 8: PA[2], 9: PA[3],
    h: HA[1], H: HA[2], j: HA[3], J: HA[4],
    W: color.hex('#f2f0ec'), I: color.hex(o.eyes || '#4a6a3a'), m: color.shade(SK[0], 0.8), r: color.mix(SK[3], '#e07a70', 0.45),
    ...Object.fromEntries(Object.entries(o.colors || {}).map(([k, v]) => [k, color.hex(v)]))
  };
  // Head
  for (const face of ALL) soft(F(s, 'head', face), SK);
  const hf = F(s, 'head', 'front');
  hf.paint(['........', '..b..b..', o.brows || '.hh..hh.', o.eyeRow || '.WI..IW.', '.b.cc.b.', '........', o.mouth || '..mmmm..', '........'], m);
  if (o.cheeks !== false) hf.paint(['.r....r.'], m, { y: 4 });
  // Hair on the inner head (top, a little at the sides and back) and as volume on the overlay
  const style = o.hair?.style || 'side';
  if (style !== 'bald') {
    soft(F(s, 'head', 'top'), [HA[0], HA[1], HA[2], HA[3], HA[4]]);
    for (const face of ['right', 'left']) F(s, 'head', face).paint(['hHHHHHHh', 'hHH..HHh', 'hH......'], m);
    F(s, 'head', 'back').paint(['hHHHHHHh', 'HjHHjHHH', 'hHHHHHHh', '.hHHHHh.'], m);
    hf.paint(['hHHjjHHh', 'h......h'], m);
  } else {
    for (const face of ['right', 'left']) F(s, 'head', face).paint(['........', '........', '.hHH....', 'hHHHh...', 'hHHh....'].map(r => face === 'left' ? r : [...r].reverse().join('')), m);
    F(s, 'head', 'back').paint(['........', '........', 'hH....Hh', 'HHhHHhHH', 'hHHHHHHh'], m);
  }
  if (style === 'side' || style === 'full') {
    F(s, 'head', 'top', 'outer').paint(['hHjjjjHh', 'HjjJJjjH', 'hHjjjjHh'], m);
    F(s, 'head', 'front', 'outer').paint(['hHjjjjHh', 'hjhHHhjh'], m);
    for (const face of ['right', 'left']) F(s, 'head', face, 'outer').paint(['hHjHjHh.', 'hjhHh...', '.h......', '........', '........'].map(r => face === 'right' ? r : [...r].reverse().join('')), m);
    F(s, 'head', 'back', 'outer').paint(['hHjjjjHh', 'HjjJJjjH', 'hHjjjjHh', '.hHHHHh.'], m);
  }
  if (style === 'full') F(s, 'head', 'top', 'outer').paint(['hHjjjjHh', 'HjjJJjjH', 'hjjJjjjh', 'hHjjjjHh', 'HjjjjJjH', 'hHjJjjHh', 'HjjjjjjH', 'hHjjjjHh'], m);
  // Beard
  if (o.beard) {
    const B = tones(color, o.beard.color || '#d8d6d0');
    Object.assign(m, { q: B[1], Q: B[2], z: B[3], Z: B[4] });
    if (o.beard.kind === 'moustache') { hf.paint(['.qQzzQq.'], m, { y: 5 }); F(s, 'head', 'front', 'outer').paint(['.qQzzQq.', '.q....q.'], m, { y: 5 }); }
    if (o.beard.kind === 'stubble') hf.paint(['..qzzq..', 'q.mmmm.q', 'QqzQqzqQ'], m, { y: 5 });
    if (o.beard.kind === 'full') {
      hf.paint(['QqzzzzqQ', 'zQzmmzQz', 'qzQzzQzq'], m, { y: 5 });
      for (const face of ['right', 'left']) F(s, 'head', face).paint(['.......q', '.....qQz', '....qzQz'].map(r => face === 'right' ? r : [...r].reverse().join('')), m, { y: 5 });
      F(s, 'head', 'front', 'outer').paint(['.QzZZzQ.', 'qzQ..Qzq', 'qQzZZzQq'], m, { y: 5 });
      F(s, 'head', 'bottom').paint(['qQzzzzQq', 'qzQzzQzq', 'qQzzzzQq', '.qQQQQq.'], m);
    }
  }
  // Body: shirt rows 0–7, trousers 8–11
  for (const face of SIDES) { const f = F(s, 'body', face); soft(f, SH, 0, 7); soft(f, PA, 8, 11); }
  soft(F(s, 'body', 'top'), SH); soft(F(s, 'body', 'bottom'), PA);
  if (o.vNeck !== false) { vShade(F(s, 'body', 'front'), SH); F(s, 'body', 'front').paint(['..d..d..', '...dd...'], { d: SK[3] }); }
  F(s, 'body', 'front').paint(['..7..7..', '..7..7..'], m, { y: 9 });
  // Arms
  const sleeve = o.sleeve || 'short';
  const rows = sleeve === 'long' ? 10 : sleeve === 'rolled' ? 8 : 6;
  for (const face of SIDES) { const f = F(s, 'rightArm', face); soft(f, SK); soft(f, SH, 0, rows - 1); }
  soft(F(s, 'rightArm', 'top'), SH); soft(F(s, 'rightArm', 'bottom'), SK);
  if (sleeve === 'rolled') for (const face of SIDES) F(s, 'rightArm', face).row(6, SH[3]).row(7, SH[1]);
  // Legs: trousers, shoes
  for (const face of SIDES) { const f = F(s, 'rightLeg', face); soft(f, PA, 0, 8); soft(f, SO, 9, 11); }
  soft(F(s, 'rightLeg', 'top'), PA); F(s, 'rightLeg', 'bottom').fill(SO[0]);
  Object.assign(m, { s: SO[1], S: SO[2], t: SO[3] });
  if (o.extras) o.extras(s, m, { SK, SH, PA, SO, HA, soft, tones: c => tones(color, c) });
  s.mirrorLimbs();
  if (o.finish) o.finish(s, m);
  return s;
}

export default {
  style: 'hair',
  updates: [
    {
      title: 'The Hobby Bench',
      note: 'Spring brings three more grandpas to the bench by the well, and every one of them brought his hobby along: a fishing rod, a garden trowel and a carpenter\'s pencil.',
      skins: [
        {
          name: 'Grandpa Bernard',
          story: 'Grandpa Bernard wears a bucket hat full of fishing lures and a vest with a pocket for every bait, and the fish he caught grows a little bigger every time he tells it.',
          build: kit => opa(kit, {
            skin: '#e2b08c', eyes: '#3c78c8', shirt: '#8cbcd8', pants: '#8a7a5a', shoes: '#2e5a32', sleeve: 'short',
            hair: { color: '#e4e2dc', style: 'none' }, beard: { color: '#e8e6e0', kind: 'moustache' }, brows: '.jj..jj.',
            colors: { v: '#4e5a32', V: '#66744a', x: '#3a4424', k: '#b8a87a', K: '#d0c294', y: '#8a7c50', R: '#d02a2a', w: '#ffffff', g: '#c8b040', n: '#3a6a3a', N: '#4c8a4c' },
            extras: (s, m) => {
              // Olive fishing vest with four pockets over the light-blue shirt
              F(s, 'body', 'front').paint(['vVv..vVv', 'vVv..vVv', 'xVVx.VVx', 'vxxv.xxv', 'VVVv.VVV', 'vxxv.xxv', 'vVVv.VVv', 'xxxx.xxx'], m);
              F(s, 'body', 'front').paint(['........', '........', '........', '........', '....g...', '........', '....g...'], m);
              F(s, 'body', 'back').paint(['vVVVVVVv', 'VvVVVVvV', 'vVVVVVVv', 'VVxxxxVV', 'vVVVVVVv', 'VVVVVVVV', 'vVVVVVVv', 'xxxxxxxx'], m);
              for (const face of ['right', 'left']) F(s, 'body', face).paint(['vVVv', 'vVVv', 'VvvV', 'vVVv', 'VVVV', 'vVVv', 'VvvV', 'xxxx'], m);
              // Tall rubber boots up to the knee
              for (const face of SIDES) { const f = F(s, 'rightLeg', face); f.paint(['....', '....', '....', '....', '....', 'nNNn', 'nNNn', 'nNNn', 'nNNn', 'NnnN', 'nNNn', 'nnnn'], m); }
              // Bucket hat with a red-and-white float pinned to the band
              F(s, 'head', 'top').paint(['kKKKKKKk', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'kKKKKKKk'], m);
              for (const face of SIDES) F(s, 'head', face).paint(['kKKKKKKk', 'yyyyyyyy'], m);
              F(s, 'head', 'top', 'outer').paint(['.kkkkkk.', 'kKKKKKKk', 'kKKKKKKk', 'kKKKKKKk', 'kKKKKKKk', 'kKKKKKKk', 'kKKKKKKk', '.kkkkkk.'], m);
              for (const face of SIDES) F(s, 'head', face, 'outer').paint(['KKKKKKKK', 'yyyyyyyy', 'kkkkkkkk'], m);
              F(s, 'head', 'front', 'outer').paint(['.....R..', '.....w..'], m);
              F(s, 'head', 'front').paint(['......g.'], m, { y: 1 });
              F(s, 'head', 'right', 'outer').paint(['.g......', '..g.....'], m);
            }
          })
        },
        {
          name: 'Grandpa Alfredo',
          story: 'Grandpa Alfredo grows the biggest tomatoes in the village under his wide straw hat, and his green apron always has one more seed packet in the pocket for you.',
          build: kit => opa(kit, {
            skin: '#c08a5c', eyes: '#5a3a1e', shirt: '#ece2c8', pants: '#5a4430', shoes: '#4a3424', sleeve: 'rolled',
            hair: { color: '#d4d2cc', style: 'none' }, beard: { color: '#d8d6d0', kind: 'stubble' }, mouth: '........',
            colors: { A: '#3e7a3a', B: '#2e5e2c', C: '#5a9a4a', k: '#e4c46a', K: '#f2dc8a', y: '#b8963e', G: '#3a8a3a', R: '#d42a2a', o: '#7a5a3a', O: '#a0784a', p: '#e86a3a', u: '#6a4a2a' },
            extras: (s, m) => {
              // Green garden apron with a big pocket, seed packets and a trowel handle sticking out
              F(s, 'body', 'front').paint(['..A..A..', '..AAAA..', '.AAAAAA.', '.ACAACA.', '.AAAAAA.', 'BBBBBBBB', '.AAAAAA.', '.ApRAOo.', '.ARRAOA.', '.BBBBBB.', '.AAAAAA.', '.AAAAAA.'], m);
              F(s, 'body', 'back').paint(['...AA...', '........', '........', '........', '........', 'BBBBBBBB', '..B..B..', '.B....B.'], m);
              for (const face of ['right', 'left']) F(s, 'body', face).row(5, m.B);
              F(s, 'rightLeg', 'front').paint(['.AAA', '.AAA', '.AAA', '.BBB'], m);
              for (const face of SIDES) F(s, 'rightLeg', face).paint(['....', '....', '....', '....', '....', '....', '....', '....', '....', '.u..', 'u..u', '....'], m);
              // Wide straw hat with a green band
              F(s, 'head', 'top').texture([[m.k, 3], [m.K, 2], [m.y, 1]], 'alfredo-hat');
              for (const face of SIDES) F(s, 'head', face).paint(['kKkKkKkK', 'GGGGGGGG'], m);
              F(s, 'head', 'top', 'outer').texture([[m.k, 3], [m.K, 2], [m.y, 1]], 'alfredo-brim');
              for (const face of SIDES) F(s, 'head', face, 'outer').paint(['KkKkKkKk', 'GGGGGGGG', 'kKykKkyK'], m);
              F(s, 'head', 'front', 'outer').paint(['.......R', '......RG'], m);
            }
          })
        },
        {
          name: 'Grandpa Desmond',
          story: 'Grandpa Desmond keeps a pencil behind his ear and sawdust in his white beard, and every chair around the well was built by his hands.',
          build: kit => opa(kit, {
            skin: '#7a4e34', eyes: '#3a2414', shirt: '#b8342a', pants: '#3e5a86', shoes: '#a87a44', sleeve: 'long', vNeck: false,
            hair: { color: '#ecebe6', style: 'side' }, beard: { color: '#f0efea', kind: 'full' }, brows: '.jj..jj.', cheeks: false,
            colors: { f: '#2a1e1e', F: '#5a1a16', u: '#5a3a1e', U: '#7a5228', g: '#e0b030', y: '#f2d050', Y: '#c89a30', P: '#e86a7a', l: '#2a2a2a', w: '#d8c8a0' },
            extras: (s, m) => {
              // Red-and-black flannel checks on shirt and sleeves
              for (const p of ['body', 'rightArm']) for (const face of SIDES) {
                const f = F(s, p, face), last = p === 'body' ? 7 : 9;
                for (let y = 0; y <= last; y++) for (let x = 0; x < f.w; x++) if (x % 3 === 1 && y % 3 === 1) f.set(x, y, m.f); else if (x % 3 === 1 || y % 3 === 1) f.set(x, y, m.F);
              }
              for (const face of SIDES) F(s, 'rightArm', face).row(9, m[2]);
              // Brown suspenders with brass clips, a shirt collar under the beard
              F(s, 'body', 'front').paint(['3....3..', '.u....u.', '.U....U.', '.u....u.', '.U....U.', '.u....u.', '.U....U.', '.g....g.'], m);
              F(s, 'body', 'back').paint(['.u....u.', '..U..U..', '...uU...', '...Uu...', '..u..U..', '.u....u.', '.U....U.', '.g....g.'], m);
              F(s, 'body', 'front').paint(['.Y......', '.y......', '.Y......'], m, { y: 8 });
              // Pencil behind the right ear, sawdust in the beard
              F(s, 'head', 'right', 'outer').paint(['........', '........', '..lYyyP.'], m);
              F(s, 'head', 'front', 'outer').paint(['........', '........', '........', '........', '........', '........', '.w......', '.....w..'], m);
              for (const face of SIDES) F(s, 'rightLeg', face).row(8, m[6]);
            }
          })
        }
      ]
    },
    {
      title: 'Sunday Best',
      note: 'On Sundays the grandpas dress up for the village: one in tweed and a bow tie, one in a flower shirt straight from the seaside, and one in his old navy peacoat with a lantern at his hip.',
      skins: [
        {
          name: 'Grandpa Archibald',
          story: 'Grandpa Archibald peers through round glasses from under his tweed cap, straightens his red bow tie and corrects your grammar with the kindest smile in the village.',
          build: kit => opa(kit, {
            skin: '#eac0a0', eyes: '#3e7a4a', shirt: '#d0a440', pants: '#6a6a70', shoes: '#5a3a22', sleeve: 'long', vNeck: false,
            hair: { color: '#bcbab4', style: 'none' }, beard: { color: '#c8c6c0', kind: 'moustache' }, brows: '.hh..hh.',
            eyeRow: 'kWIkkIWk',
            colors: { k: '#3a2a1a', w: '#f4f2ee', R: '#c42a2a', o: '#e8d8a8', T: '#7a6a52', t: '#5a4c3a', u: '#9a8a6a', n: '#7a5a1e' },
            extras: (s, m) => {
              // Mustard cardigan: white collar, red bow tie, buttons, ribbed hem and cuffs
              F(s, 'body', 'front').paint(['.4wwww4.', '.3RwwR3.', '..3RR3..', '...ww...', '...ow...', '...ww...', '...ow...', '22222222'], m);
              F(s, 'body', 'front').paint(['........', '........', '..2..2..', '..2..2..', '..2..2..', '..2..2..', '..2..2..'], m);
              F(s, 'body', 'back').row(7, m[2]);
              for (const face of SIDES) F(s, 'rightArm', face).row(9, m[2]);
              // Round glasses frames on the overlay, grey hair at the sides only
              F(s, 'head', 'front', 'outer').paint(['........', '........', '........', 'k..kk..k', '.kk..kk.'], m);
              // Tweed flat cap
              F(s, 'head', 'top').texture([[m.T, 3], [m.t, 2], [m.u, 2]], 'tweed');
              for (const face of SIDES) F(s, 'head', face).paint(['TtTuTtTu', 'tTtTtTtT'], m);
              F(s, 'head', 'top', 'outer').texture([[m.T, 3], [m.t, 2], [m.u, 2]], 'tweed-o', { only: (x, y) => y >= 1 });
              F(s, 'head', 'front', 'outer').paint(['TtTuTtTu', 'tttttttt'], m);
              for (const face of ['right', 'left', 'back']) F(s, 'head', face, 'outer').paint(['TuTtTuTt'], m);
              for (const face of ['right', 'left']) F(s, 'head', face).paint(['........', '........', 'hhH.....', 'hH......'].map(r => face === 'left' ? r : [...r].reverse().join('')), m);
              F(s, 'head', 'back').paint(['........', '........', 'hHhHHhHh', 'HhHHhHHh'], m);
            }
          })
        },
        {
          name: 'Grandpa Ramon',
          story: 'Grandpa Ramon came back from the seaside with a sunburnt head, dark sunglasses and a flower shirt, and he has refused to wear long trousers ever since.',
          build: kit => opa(kit, {
            skin: '#c8906a', eyes: '#2a2a2a', shirt: '#2aa0a0', pants: '#34466e', shoes: '#6a4428', sleeve: 'short',
            hair: { color: '#e6e4de', style: 'bald' }, beard: { color: '#dcdad4', kind: 'moustache' }, brows: '.hh..hh.', eyeRow: 'kgggkggk', mouth: '..m..m..',
            colors: { k: '#1a1a1e', g: '#2e3a46', G: '#5a7a96', p: '#f07ab0', P: '#ffb0d0', y: '#ffe060', l: '#f4f4f0', x: '#d87050', w: '#ffffff' },
            extras: (s, m, { SK, soft }) => {
              // Sunburnt bald top
              soft(F(s, 'head', 'top'), [SK[1], SK[2], m.x, m.x, SK[4]]);
              F(s, 'head', 'front').paint(['.xxxxxx.'], m);
              F(s, 'head', 'front').paint(['.G...G..'], m, { y: 3 });
              // Flower shirt: pink and yellow blossoms, open collar
              F(s, 'body', 'front').paint(['..d..d..', '.P.dd...', 'PyP...p.', '.P...pyp', '....P.p.', '.p.PyP..', 'pyp.P..y', '.p.....P'], { ...m, d: SK[3] });
              F(s, 'body', 'back').paint(['.P....p.', 'PyP..pyp', '.P....p.', '...p....', '..pyp.P.', '...p.PyP', '.y....P.', '....y...'], m);
              for (const face of SIDES) F(s, 'rightArm', face).paint(['.P..', 'PyP.', '.P.y', '....', '..p.', '....'], m);
              // Shorts, bare legs, white socks and sandals
              for (const face of SIDES) { const f = F(s, 'rightLeg', face); soft(f, SK, 2, 8); f.paint(['....', '....', '....', '....', '....', '....', '....', 'llll', 'wllw', 'ssss', 'S..S', 'ssss'], m); }
              // Sunglasses stand off the face
              F(s, 'head', 'front', 'outer').paint(['........', '........', '........', 'kGgkkGgk', '.kk..kk.'], m);
              for (const face of ['right', 'left']) F(s, 'head', face, 'outer').paint(['........', '........', '........', 'kkk.....'].map(r => face === 'left' ? r : [...r].reverse().join('')), m);
            }
          })
        },
        {
          name: 'Grandpa Seamus',
          story: 'Grandpa Seamus keeps watch over the village at night in his old navy peacoat and knitted cap, and the little lantern at his hip has never once gone out.',
          build: kit => opa(kit, {
            skin: '#e6b496', eyes: '#3c7ad0', shirt: '#24304e', pants: '#3a3a40', shoes: '#1e1e22', sleeve: 'long', vNeck: false,
            hair: { color: '#f0efea', style: 'none' }, beard: { color: '#f2f1ec', kind: 'full' }, brows: '.jj..jj.',
            colors: { g: '#d8a83a', G: '#f2cc5a', n: '#1a2238', N: '#2e3c62', c: '#ece4d0', C: '#d4cab0', L: '#2a2a2a', y: '#ffd84a', Y: '#fff2a0', o: '#c87a1e', R: '#d04a4a' },
            extras: (s, m) => {
              // Navy peacoat, double row of brass buttons, cream knit collar, wide lapels
              F(s, 'body', 'front').paint(['CccccccC', 'N2cccc2N', '.N2cc2N.', '.g.NN.g.', '........', '.g....g.', '........', '.g....g.'], m);
              F(s, 'body', 'front').col(4, m[1], 3, 7);
              for (const face of SIDES) { F(s, 'body', face).row(8, m[2]); F(s, 'body', face).row(9, m[1]); }
              F(s, 'body', 'front').paint(['.2....2.', '.2....2.'], m, { y: 8 });
              F(s, 'body', 'back').paint(['CccccccC'], m);
              for (const face of SIDES) { F(s, 'rightArm', face).row(8, m[4]).row(9, m[2]); }
              F(s, 'rightArm', 'front').paint(['....', '....', '....', '....', '....', '....', '....', '....', '.g..'], m);
              // Rosy nose
              F(s, 'head', 'front').paint(['...RR...'], m, { y: 4 });
              // Navy knitted cap with a turned-up cuff
              F(s, 'head', 'top').fill(m.N);
              for (const face of SIDES) F(s, 'head', face).paint(['NnNnNnNn', 'nnnnnnnn'], m);
              F(s, 'head', 'top', 'outer').paint(['nNNnnNNn', 'NNnNNnNN', 'NnNNNNnN', 'nNNNNNNn', 'nNNNNNNn', 'NnNNNNnN', 'NNnNNnNN', 'nNNnnNNn'], m);
              for (const face of SIDES) F(s, 'head', face, 'outer').paint(['NNNNNNNN', 'nNnNnNnN', 'nnnnnnnn'], m);
              for (const face of ['right', 'left']) F(s, 'head', face).paint(['........', '........', 'jjj.....', 'jj......'].map(r => face === 'left' ? r : [...r].reverse().join('')), m);
              F(s, 'head', 'back').paint(['........', '........', 'jjjjjjjj', 'JjjJjjJj', '.jjjjjj.'], m);
            },
            finish: (s, m) => {
              // The lantern hangs from the belt on his left hip, glowing
              F(s, 'body', 'front', 'outer').paint(['......L.', '.....LLL', '.....LyL', '.....LYL', '.....LyL', '.....LLL'], m, { y: 6 });
              F(s, 'body', 'left', 'outer').paint(['L...', 'LL..', 'yL..', 'YL..', 'yL..', 'LL..'], m, { y: 7 });
            }
          })
        }
      ]
    }
  ]
};
