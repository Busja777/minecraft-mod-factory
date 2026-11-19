// Cosy Sleeper — knitted onesies. Existing: Red/Blue/Green/Yellow/Purple/Orange Wool Sweater, one design in
// six colours: a full-body wool onesie with a hood, only a small 6×4 face window open (rows 3–6), each with an
// emoji-like expression (toothy grin, wink, grin, closed-eye smile, tears, neutral).
// The pack's look: every pixel is wool, picked at random from ~25 close shades of one colour (0.71–1.0 of the
// base, no edge darkening), flat light skin in the window (#ffd2af / #ebb994 / #c8946c), near-black pupils
// with a white eye pixel. The overlay is ~77 % transparent → style 'accent': a hood rim around the face
// window, wool clumps on the head sides, two bands of clumps on the arms and legs.
// The new sleepers keep that wool material and the face window, but each one gets its own idea
// (pattern, headwear, garment, expression); three wear pyjamas with an open face and hair.

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const flip = rows => rows.map(r => [...r].reverse().join(''));
const rep = (row, n) => Array(n).fill(row);

// Skin tones in the window (S highlight, s base, d shadow, l eyelid line, b blush) and face pixels.
const SKIN = {
  light: { S: '#ffd2af', s: '#ebb994', d: '#c8946c', l: '#6a3c26', b: '#eb9b87' },
  warm: { S: '#f0c294', s: '#d9a072', d: '#b07a4e', l: '#4e2a18', b: '#e08670' },
  brown: { S: '#b98458', s: '#9c6a42', d: '#7a4e2c', l: '#2e1a0e', b: '#c06a58' }
};
const FACE = { W: '#fefefe', E: '#14110f', m: '#502319', t: '#faf8f4', k: '#e06878', g: '#c9927e' };

// The builder. o: {
//   seed, skin: 'light'|'warm'|'brown', hood (default true: face window with a wool rim),
//   knit: { letter: colour | [colour, lo] }  wool colours (every pixel a random shade between lo and 1),
//   flat: { letter: colour }                  flat pixels (eyes, buttons, …),
//   face: 8 rows for the head front ('.' = keep the wool/hood underneath),
//   head/body/arm/leg: { all, sides, top, bottom, front, back, right, left }  inner templates,
//   headO/bodyO/armO/legO: the same for the overlay. Rows may be an array or { rowIndex: 'row' }.
//   fuzz: { head, body, arm, leg }  chance of a wool clump on the overlay, rim: letter for the hood rim,
//   inner(ctx), outer(ctx), finish(ctx)  hooks }
// Arms and legs are painted on the right side and mirrored. In a template '.' keeps, ' ' clears.
function cosy({ Skin, color }, o) {
  const { hex, shade, rng, T } = color;
  const s = new Skin();
  const r = rng(`cosy:${o.seed}`);
  const KN = {}, FL = {};
  for (const [k, v] of Object.entries(o.knit)) { const [c, lo = 0.72] = Array.isArray(v) ? v : [v]; KN[k] = { c: hex(c), lo }; }
  for (const [k, v] of Object.entries({ ...FACE, ...SKIN[o.skin || 'light'], ...o.flat })) {
    if (KN[k]) continue; // a knit letter wins over a default face letter
    FL[k] = hex(v);
  }
  const knit = k => { const { c, lo } = KN[k]; return shade(c, lo + (1 - lo) * Math.floor(r() * 6) / 5); };
  const px = ch => (KN[ch] ? knit(ch) : FL[ch]);
  const paint = (f, spec) => {
    const rows = Array.isArray(spec) ? spec : Array.from({ length: f.h }, (_, y) => spec[y] ?? '');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.' || x >= f.w || y >= f.h) return;
      if (ch === ' ') return f.set(x, y, T);
      const c = px(ch);
      if (!c) throw new Error(`cosy: no colour for "${ch}" on ${f.part}.${f.face}`);
      f.set(x, y, c);
    }));
  };
  const apply = (part, spec, layer = 'inner') => {
    if (!spec) return;
    if (spec.all) for (const f of s.faces(part, layer)) paint(f, spec.all);
    if (spec.sides) for (const f of s.sides(part, layer)) paint(f, spec.sides);
    for (const face of ['top', 'bottom', 'front', 'back', 'right', 'left']) {
      let rows = spec[face];
      if (!rows && face === 'left' && Array.isArray(spec.right)) rows = flip(spec.right);
      if (rows) paint(s.face(part, face, layer), rows);
    }
  };
  const ctx = { s, paint, knit, px, apply, r, color, KN };

  // ── Inner: wool everywhere, then the design ──
  for (const p of ['head', 'body', 'rightArm', 'rightLeg']) for (const f of s.faces(p)) paint(f, rep('K'.repeat(f.w), f.h));
  o.inner?.(ctx);
  apply('head', o.head); apply('body', o.body); apply('rightArm', o.arm); apply('rightLeg', o.leg);
  paint(s.face('head', 'front'), o.face);

  // ── Overlay: hood rim around the face window, wool clumps ──
  const hood = o.hood !== false;
  const fz = { head: hood ? 0.35 : 0, body: 0.25, arm: 0.72, leg: 0.72, ...o.fuzz };
  const copy = (part, face, x, y) => {
    const c = s.face(part, face, 'inner').get(x, y);
    s.face(part, face, 'outer').set(x, y, shade(c, 0.93 + r() * 0.15));
  };
  if (hood) {
    const isWool = (x, y) => { const ch = (o.face[y] || '')[x]; return ch === undefined || ch === '.' || !!KN[ch]; };
    const of = s.face('head', 'front', 'outer');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (!isWool(x, y)) continue;
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && x + dx < 8 && y + dy >= 0 && y + dy < 8 && !isWool(x + dx, y + dy));
      if (rim) { if (o.rim) of.set(x, y, px(o.rim)); else copy('head', 'front', x, y); }
    }
  }
  for (const face of ['right', 'left', 'back']) for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) if (r() < fz.head) copy('head', face, x, y);
  for (const face of ['right', 'left']) for (let y = 5; y < 11; y++) for (let x = 0; x < 4; x++) if (r() < fz.body) copy('body', face, x, y);
  for (const f of s.sides('rightArm')) for (const y of [2, 3, 4, 5, 7, 8, 9]) for (let x = 0; x < f.w; x++) if (r() < fz.arm) copy('rightArm', f.face, x, y);
  for (const f of s.sides('rightLeg')) for (const y of [0, 1, 2, 3, 6, 7]) for (let x = 0; x < f.w; x++) if (r() < fz.leg) copy('rightLeg', f.face, x, y);
  apply('head', o.headO, 'outer'); apply('body', o.bodyO, 'outer'); apply('rightArm', o.armO, 'outer'); apply('rightLeg', o.legO, 'outer');
  o.outer?.(ctx);

  s.mirrorLimbs();
  o.finish?.(ctx);
  return s;
}

// Patchwork: every face split into 4×4 knitted squares, cream running stitches along the seams.
function patchwork({ s, paint }, letters, salt = 0) {
  const FI = { top: 0, bottom: 1, right: 2, front: 3, left: 4, back: 5 };
  const PI = { head: 0, body: 1, rightArm: 2, rightLeg: 3 };
  for (const part of Object.keys(PI)) for (const f of s.faces(part)) {
    const rows = [];
    for (let y = 0; y < f.h; y++) {
      let row = '';
      for (let x = 0; x < f.w; x++) {
        const bx = Math.floor(x / 4), by = Math.floor(y / 4);
        const stitch = (x % 4 === 3 || y % 4 === 3) && (x + y) % 2 === 0;
        row += stitch ? 'C' : letters[(bx * 2 + by * 3 + FI[f.face] * 4 + PI[part] + salt) % letters.length];
      }
      rows.push(row);
    }
    paint(f, rows);
  }
}

// Short and long hair for the open-face pyjama sleepers. Side rows are for the right face (front edge right).
const HAIR = {
  shortSide: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHd', 'HHHHdHss', 'HHHddsss', 'HHHHssss', 'HHHHdsss'],
  shortBack: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'dHHHHHHd'],
  longSide: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHs', 'HHHHHHds', 'HHHHHHss', 'HHHHHHsd']
};

// ── Updates ───────────────────────────────────────────────────────────────────────────────────

export default {
  style: 'accent',
  updates: [
    {
      title: 'Lights Out',
      note: 'The lamps go off and three new sleepyheads shuffle into the pack: a stargazer in a drooping nightcap, a very tired pyjama fan and a little sheep who counts herself to sleep.',
      skins: [
        {
          name: 'Starry Nightcap',
          story: 'She falls asleep counting the yellow stars on her midnight pyjamas, and the pompom of her nightcap always ends up on her ear.',
          build: kit => cosy(kit, {
            seed: 101, hood: false,
            knit: { K: '#27386e', Y: ['#f2d36b', 0.86], C: ['#efe6d0', 0.86], H: ['#6b3f24', 0.78] },
            face: ['KKKKKKKK', 'CCCCCCCC', 'HHHHsHHH', 'HSssssSH', 'dllssllD', 'dbsmmsbd', 'dssmmssd', 'ddssssdd'],
            flat: { D: '#c8946c' },
            head: {
              top: ['KKKKKKKK', 'KYKKKKKK', 'KKKKKYKK', 'KKKKKKKK', 'KKYKKKKK', 'KKKKKKYK', 'KKKKKKKK', 'KKKKKKKK'],
              right: ['KKKKKKKK', 'CCCCCCCC', ...HAIR.shortSide.slice(2)],
              back: ['KKKKKKKK', 'CCCCCCCC', ...HAIR.shortBack.slice(2)],
              bottom: rep('dddddddd', 8)
            },
            headO: {
              top: ['KKKKKKKK', 'KYKKKKKK', 'KKKKKYKK', 'KKKKKKKK', 'KKYKKKKK', 'KKKKKKYK', 'KKKKKKKK', 'KKKKKKKK'],
              front: ['KKKKKKKK', 'CCCCCCCC', 'H.HH..HH'],
              right: ['KKKKKKKK', 'CCCCCCCC', '.HHHH...'],
              left: ['KKKKKKKK', 'CCCCCCCC', '..HKKK..', '...KK...', '..YYY...', '..YYYY..', '...YY...'],
              back: ['KKKKKKKK', 'CCCCCCCC', '........', '........', '........', '........', 'H.HH.HH.', '.H..H..H']
            },
            body: {
              front: ['CCKKKKCC', 'KCKKKKCK', 'KKKKKKKK', 'KKYYKKKK', 'KYYKKKYK', 'KYYKKYYY', 'KYYKKKYK', 'KKYYKKKK', 'KKKKKKKK', 'KKKKKYKK', 'KKKKKKKK', 'CCCCCCCC'],
              back: ['CCCCCCCC', 'KYKKKKKK', 'KKKKKYKK', 'KKKKYYYK', 'KKKKKYKK', 'KKKKKKKK', 'KYKKKKKK', 'KKKKKKKK', 'KKKKKKYK', 'KKYKKKKK', 'KKKKKKKK', 'CCCCCCCC'],
              right: ['CCCC', 'KKKK', 'KKYK', 'KKKK', 'KKKK', 'KYKK', 'KKKK', 'KKKK', 'KKKY', 'KKKK', 'KKKK', 'CCCC']
            },
            bodyO: { front: { 0: 'CC....CC', 1: '.C....C.' } },
            arm: {
              sides: ['KKKK', 'KKKK', 'KYKK', 'KKKK', 'KKKK', 'KKYK', 'KKKK', 'KKKK', 'YKKK', 'KKKK', 'CCCC', 'ssss'],
              bottom: rep('dddd', 4)
            },
            armO: { sides: { 10: 'CCCC', 11: '    ' } },
            leg: {
              sides: ['KKKK', 'KKYK', 'KKKK', 'KKKK', 'YKKK', 'KKKK', 'KKKY', 'KKKK', 'KKKK', 'CCCC', 'YYYY', 'YYYY'],
              bottom: rep('YYYY', 4)
            },
            legO: { sides: { 9: '    ', 10: 'YYYY' }, front: { 9: '.YY.', 10: 'YYYY' } }
          })
        },
        {
          name: 'Mint Stripe Pyjamas',
          story: 'He has worn his mint striped pyjamas for three lazy days in a row, and his bed hair has stopped listening to the comb.',
          build: kit => cosy(kit, {
            seed: 102, hood: false,
            knit: { K: ['#6fcca4', 0.8], C: ['#f2eee0', 0.88], H: ['#5a3a22', 0.78], G: ['#3a8a68', 0.82], P: ['#f29ab4', 0.86] },
            flat: { B: '#245a44' },
            face: ['HHHHHHHH', 'HHHHHHHH', 'HsHHsHHH', 'HllssllH', 'dWEssWEd', 'dggssggd', 'dssmmmsd', 'ddssssdd'],
            head: { top: rep('HHHHHHHH', 8), right: HAIR.shortSide, back: HAIR.shortBack, bottom: rep('dddddddd', 8) },
            headO: {
              top: ['H..H...H', '.H...H..', '...H..H.', 'H......H', '..H.HH..', '.H..HH..', 'H..H...H', '.HH..H.H'],
              front: ['H.HH.H.H', '.H....H.'],
              right: ['HHH.HH.H', 'H.H....H'],
              back: ['HHHHHHHH', 'H.HH.HH.', '.H..H..H']
            },
            body: {
              front: ['CKKCCKKC', 'CKKCCKKC', 'CKKBCKKC', 'CKKCCKKC', 'CKKCCKKC', 'CKKBCKKC', 'CKKCCKKC', 'CKKCCKKC', 'CKKBCKKC', 'CKKCCKKC', 'CKKCCKKC', 'GGGGGGGG'],
              back: [...rep('CKKCCKKC', 11), 'GGGGGGGG'],
              right: [...rep('KCCK', 11), 'GGGG']
            },
            bodyO: { front: { 0: 'GG....GG', 1: '.GG..GG.', 3: '.....GG.', 4: '.....G..' }, back: { 0: 'GGGGGGGG' } },
            fuzz: { body: 0.15 },
            arm: { sides: [...rep('CKKC', 10), 'GGGG', 'ssss'], bottom: rep('dddd', 4) },
            armO: { sides: { 10: 'GGGG', 11: '    ' } },
            leg: { sides: [...rep('CKKC', 9), 'GGGG', 'PPPP', 'PPPP'], bottom: rep('PPPP', 4) },
            legO: { sides: { 9: '    ', 10: 'PPPP' }, front: { 9: '.PP.', 10: 'PPPP' } }
          })
        },
        {
          name: 'Counting Sheep',
          story: 'She counts sheep every night until she is the sheep, curled up in a woolly onesie with floppy grey ears.',
          build: kit => cosy(kit, {
            seed: 103,
            knit: { K: ['#f1ebdf', 0.86], C: ['#ffffff', 0.93], G: ['#45414a', 0.78], P: ['#f0a6b4', 0.86], V: ['#7fb8e8', 0.86] },
            flat: { Y: '#f2c230', y: '#b8861a' },
            face: ['........', '........', '........', '.SssssS.', '.sEssEs.', '.bbssbb.', '.sdmmds.', '........'],
            head: { bottom: rep('KKKKKKKK', 8) },
            headO: {
              top: ['C.C.C.C.', '.C.C.C.C', 'C.C.C.C.', '.C.C.C.C', 'C.C.C.C.', '.C.C.C.C', 'C.C.C.C.', '.CCCCCC.'],
              front: ['.CCCCCC.', 'GC.CC.CG', 'G......G', 'G......G'],
              right: ['C.C.C...', '.....GGG', '....GPPG', '....GPGG', '.....GG.'],
              back: ['C.C.C.C.', '.C.C.C.C']
            },
            fuzz: { head: 0.3 },
            bodyO: {
              front: ['VVVVVVVV', 'CC.YY.CC', 'C..yy..C', 'C..C..C.', '.C..C..C', '........', 'C.C..C.C', '.C.CC.C.', '........', '.C..C..C', 'C..C..C.', '........'],
              back: ['VVVVVVVV', 'C.C.C.C.', '........', '.C..C..C', 'C..C..C.', '........', '.C.C.C.C', 'C.C.C.C.', '........', 'C..CC..C', '.C.CC.C.', '........']
            },
            body: { sides: { 0: 'VVVV' }, front: { 0: 'VVVVVVVV', 1: '...YY...', 2: '...yy...' } },
            arm: { sides: { 10: 'GGGG', 11: 'GGGG' }, bottom: rep('GGGG', 4) },
            armO: { sides: { 9: 'CCCC', 10: '    ' } },
            leg: { sides: { 10: 'GGGG', 11: 'GGGG' }, bottom: rep('GGGG', 4) },
            legO: { sides: { 9: 'CCCC' } }
          })
        }
      ]
    },
    {
      title: 'Snow Day Knits',
      note: 'School is snowed in, so the sleepers pull out their warmest winter knits: a Fair Isle jumper with a pompom beanie, a reindeer jumper with antlers and an argyle sweater with fluffy earmuffs.',
      skins: [
        {
          name: 'Fair Isle Snowflake',
          story: 'He was the first one out in the snow this morning, and his teal Fair Isle jumper still has a snowflake on the chest to prove it.',
          build: kit => cosy(kit, {
            seed: 201,
            knit: { K: '#1f8a8c', C: ['#f1ead6', 0.86], R: ['#c8323a', 0.8] },
            face: ['........', '........', '........', '.SssssS.', '.sEssEs.', '.bmmmmb.', '.dmkkmd.', '........'],
            head: { top: rep('RRRRRRRR', 8) },
            headO: {
              top: ['RRRRRRRR', 'RRRRRRRR', 'RRCCCCRR', 'RRCCCCRR', 'RRCCCCRR', 'RRCCCCRR', 'RRRRRRRR', 'RRRRRRRR'],
              front: ['RRRRRRRR', 'CRCRCRCR', 'CCCCCCCC'],
              right: ['RRRRRRRR', 'CRCRCRCR', 'CCCCCCCC'],
              back: ['RRRRRRRR', 'CRCRCRCR', 'CCCCCCCC']
            },
            body: {
              front: ['CCCCCCCC', 'CKKCCKKC', 'RRRRRRRR', 'KKKKKKKK', 'KCKCCKCK', 'KKCCCCKK', 'KCCRRCCK', 'KCCRRCCK', 'KKCCCCKK', 'KCKCCKCK', 'RRRRRRRR', 'CCCCCCCC'],
              back: ['CCCCCCCC', 'CKKCCKKC', 'RRRRRRRR', 'KKKKKKKK', 'KKCKKKKK', 'KKKKKKCK', 'KKKKKKKK', 'KKKCKKKK', 'KCKKKKKK', 'KKKKKCKK', 'RRRRRRRR', 'CCCCCCCC'],
              right: ['CCCC', 'KCCK', 'RRRR', 'KKKK', 'KKKK', 'KCKK', 'KKKK', 'KKKK', 'KKCK', 'KKKK', 'RRRR', 'CCCC']
            },
            arm: { sides: ['CKKC', 'RRRR', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KCCK', 'RRRR', 'CCCC', 'CCCC'], top: rep('CCCC', 4), bottom: rep('CCCC', 4) },
            leg: { sides: ['KKKK', 'KKKK', 'KKKK', 'KCKK', 'KKKK', 'KKKK', 'KKKK', 'KCCK', 'RRRR', 'CKKC', 'CCCC', 'CCCC'], bottom: rep('CCCC', 4) },
            legO: { sides: { 10: 'CCCC' } }
          })
        },
        {
          name: 'Reindeer Jumper',
          story: 'His grandma knitted a reindeer on his jumper and two antlers on his hood, and he has refused to take either off since.',
          build: kit => cosy(kit, {
            seed: 202,
            knit: { K: '#7a4a2c', T: ['#cfa67c', 0.86], A: ['#e6d3aa', 0.86], C: ['#efe6d0', 0.86], D: ['#3e2616', 0.8] },
            flat: { N: '#e0242c', e: '#2a1a12' },
            face: ['........', '........', '........', '.WWssWW.', '.WEssEW.', '.bmssmb.', '.dsmmsd.', '........'],
            headO: {
              top: ['........', '........', '........', '........', '.A....A.', 'AA....AA', '.A....A.', '.AA..AA.'],
              front: ['A.A..A.A', '.AA..AA.'],
              right: ['........', '........', '....TT..', '....TTT.', '.....T..']
            },
            body: {
              front: ['CCCCCCCC', 'KAKKKKAK', 'KAAKKAAK', 'KKATTAKK', 'KKTTTTKK', 'KKeTTeKK', 'KKTTTTKK', 'KKTNNTKK', 'KKKTTKKK', 'KKKKKKKK', 'CKCKCKCK', 'CCCCCCCC'],
              back: ['CCCCCCCC', 'KCKCKCKC', 'KKKKKKKK', 'KKKKKKKK', 'KKKCKKKK', 'KKKKKKKK', 'KKKKKKCK', 'KKKKKKKK', 'KCKKKKKK', 'KKKKKKKK', 'CKCKCKCK', 'CCCCCCCC'],
              right: ['CCCC', 'CKCK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'CKCK', 'CCCC']
            },
            bodyO: { front: { 7: '...NN...' } },
            arm: { sides: ['KKKK', 'KKKK', 'CKCK', 'KCKC', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'CKCK', 'CCCC', 'CCCC'], bottom: rep('CCCC', 4) },
            leg: { sides: { 9: 'CCCC', 10: 'DDDD', 11: 'DDDD' }, bottom: rep('DDDD', 4) },
            legO: { sides: { 9: 'CCCC' } }
          })
        },
        {
          name: 'Hot Cocoa Argyle',
          story: 'He drinks his hot cocoa so fast that he always wears a chocolate moustache under his fluffy earmuffs.',
          build: kit => cosy(kit, {
            seed: 203,
            knit: { K: ['#cc9450', 0.82], D: ['#5a3420', 0.82], C: ['#f4e8cc', 0.9], M: ['#f6f2ea', 0.9] },
            flat: { c: '#5a321c' },
            face: ['........', '........', '........', '.SssssS.', '.llssll.', '.bccccb.', '.dsmmsd.', '........'],
            headO: {
              top: ['........', '........', '........', 'DDDDDDDD', 'DDDDDDDD'],
              front: ['........', '........', '........', 'M......M', 'M......M', 'M......M'],
              right: ['...DD...', '...DD...', '..MMMM..', '.MMMMMM.', '.MMMMMM.', '.MMMMMM.', '..MMMM..']
            },
            body: {
              front: ['CCCCCCCC', 'KKKDDKKK', 'KKDDDDKK', 'KDDDDDDK', 'KKDDDDKK', 'CKKDDKKC', 'CCKKKKCC', 'CKKDDKKC', 'KKDDDDKK', 'KDDDDDDK', 'KKDDDDKK', 'DDDDDDDD'],
              back: ['CCCCCCCC', 'KKKDDKKK', 'KKDDDDKK', 'KDDDDDDK', 'KKDDDDKK', 'CKKDDKKC', 'CCKKKKCC', 'CKKDDKKC', 'KKDDDDKK', 'KDDDDDDK', 'KKDDDDKK', 'DDDDDDDD'],
              right: ['CCCC', 'KDDK', 'DDDD', 'KDDK', 'KKKK', 'CKKC', 'KKKK', 'KDDK', 'DDDD', 'KDDK', 'KKKK', 'DDDD']
            },
            arm: { sides: ['KKKK', 'KDDK', 'DDDD', 'KDDK', 'CKKC', 'KDDK', 'DDDD', 'KDDK', 'CKKC', 'KKKK', 'DDDD', 'DDDD'], bottom: rep('DDDD', 4) },
            leg: { sides: [...rep('DDDD', 10), 'CCCC', 'CCCC'], bottom: rep('CCCC', 4) },
            legO: { sides: { 10: 'CCCC' } }
          })
        }
      ]
    },
    {
      title: 'Sweet Dreams Club',
      note: 'The sleepers start a club for the best naps in the world: one wrapped in a patchwork quilt, a panda who snores in bubbles and a dreamer in a heart cardigan.',
      skins: [
        {
          name: 'Patchwork Quilt',
          story: 'She never got out of bed this winter, so her grandma simply stitched her favourite quilt into a hood and a onesie.',
          build: kit => cosy(kit, {
            seed: 301, rim: 'C',
            knit: { K: ['#d86a7a', 0.78], U: ['#d9a640', 0.8], G: ['#7fa86a', 0.78], Y: ['#6aa0d8', 0.78], L: ['#a88ad0', 0.78], C: ['#f2ead8', 0.88] },
            inner: ctx => patchwork(ctx, ['K', 'U', 'G', 'Y', 'L'], 1),
            face: ['........', '........', '........', '.llssll.', '.EEssEE.', '.bssssb.', '.dsmmsd.', '........']
          })
        },
        {
          name: 'Sleepy Panda',
          story: 'He sleeps twenty hours a day in his panda onesie and still wakes up smiling, already looking forward to the next nap.',
          build: kit => cosy(kit, {
            seed: 302,
            knit: { K: ['#f0f0ec', 0.84], X: ['#2c2c32', 0.8], G: ['#8a8a92', 0.86] },
            face: ['........', '.XX..XX.', '........', '.SssssS.', '.llssll.', '.bmssmb.', '.dsmmsd.', '........'],
            headO: {
              top: ['........', '........', '........', '........', '........', 'XX....XX', 'XX....XX', 'XX....XX'],
              front: ['XX....XX', 'X......X'],
              right: ['......XX', '.......X']
            },
            body: {
              front: ['XXXXXXXX', 'XXXXXXXX', 'XXKKKKXX', 'XKKKKKKX', ...rep('KKKKKKKK', 8)],
              back: ['XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXKKKKXX', ...rep('KKKKKKKK', 8)],
              right: [...rep('XXXX', 4), ...rep('KKKK', 8)],
              top: rep('XXXXXXXX', 4)
            },
            bodyO: { back: { 9: '...KK...', 10: '..KKKK..', 11: '...KK...' } },
            arm: { all: rep('XXXX', 12), bottom: ['GGGG', 'GXXG', 'GXXG', 'GGGG'] },
            leg: { all: rep('XXXX', 12), bottom: ['GGGG', 'GXXG', 'GXXG', 'GGGG'] }
          })
        },
        {
          name: 'Sweetheart Cardigan',
          story: 'She knitted her pink cardigan heart by heart, and whenever she thinks of her warm bed her eyes turn into hearts too.',
          build: kit => cosy(kit, {
            seed: 303, hood: false, skin: 'warm',
            knit: { P: ['#e0708e', 0.76], Q: ['#b84868', 0.8], C: ['#f3ead8', 0.88], R: ['#d8283c', 0.84], H: ['#9a4a28', 0.78], K: ['#e0708e', 0.76] },
            flat: { h: '#d4142c', j: '#d4142c', B: '#fff1c8' },
            face: ['HHHHHHHH', 'HHHHHHHH', 'HsHHHHsH', 'SssssssS', 'hshsshsh', 'hhhsshhh', 'bhssssjb', 'dssmmssd'],
            head: { top: rep('HHHHHHHH', 8), right: HAIR.longSide, back: rep('HHHHHHHH', 8), bottom: rep('dddddddd', 8) },
            headO: {
              top: ['........', '........', '...HH...', '..HHHH..', '..HHHH..', '...HH...', '........', 'H.HH.HH.'],
              front: ['HH.HH.HH', 'H......H', 'H......H'],
              right: ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHH.', 'HHHHHH..', 'HHHHHH..', 'HHHHHH..', 'HHHHHH..', '.HHHHH..'],
              back: [...rep('HHHHHHHH', 7), '.HHHHHH.']
            },
            body: {
              all: rep('PPPPPPPP', 12),
              front: ['PCCCCCCP', 'PPPQPPPP', 'PPPBPRPR', 'PPPQPRRR', 'PPPQPPRP', 'PPPBPPPP', 'RPRQPPPP', 'RRRQPPPP', 'PRPBPPPP', 'PPPQPPPP', 'QQQQQQQQ', 'QQQQQQQQ'],
              back: ['PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPRPRPPP', 'PPRRRPPP', 'PPPRPPPP', 'PPPPPPPP', 'PPPPPRPR', 'PPPPPRRR', 'PPPPPPRP', 'QQQQQQQQ', 'QQQQQQQQ'],
              right: [...rep('PPPP', 10), 'QQQQ', 'QQQQ'],
              top: ['PPPPPPPP', 'PCCCCCCP', 'PCCCCCCP', 'PPPPPPPP']
            },
            bodyO: { front: { 0: 'CCCCCCCC' }, back: { 0: 'HHHHHHHH', 1: '.HHHHHH.', 2: '..HHHH..' } },
            arm: {
              all: rep('PPPP', 12),
              sides: [...rep('PPPP', 9), 'QQQQ', 'QQQQ', 'ssss'],
              right: ['PPPP', 'PPPP', 'PPPP', 'PPPP', 'RPRP', 'RRRP', 'PRPP', 'PPPP', 'PPPP', 'QQQQ', 'QQQQ', 'ssss'],
              bottom: rep('dddd', 4)
            },
            armO: { sides: { 10: 'QQQQ', 11: '    ' } },
            leg: { all: rep('CCCC', 12), sides: ['CCCC', 'CPCC', 'CCCC', 'CCCP', 'CCCC', 'PCCC', 'CCCC', 'CCPC', 'CCCC', 'CCCC', 'PPPP', 'PPPP'], bottom: rep('PPPP', 4) },
            legO: { sides: { 9: '    ', 10: 'PPPP' }, front: { 9: '.PP.', 10: 'PPPP' } }
          })
        }
      ]
    }
  ]
};
