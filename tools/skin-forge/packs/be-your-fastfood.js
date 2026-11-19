// BE YOUR FASTFOOD: walking dishes. The hand-made skins are pure inner-layer food with no overlay at all:
// every face is shaded in columns (dark outer column, lighter towards the middle, darker corners), each
// food layer gets its own 4–5 tone ramp, faces are hinted at most (two coloured eye pixels, no mouth).
// Existing: Doner Kebab, Fries, Cheesy Burger, Currywurst, Fried Rice, Kimchi, Pelmeni, Pizza, Doughnut,
// Cheesecake, Taco, Ramen, Sushi. New dishes come from other kitchens of the world; the overlay is used
// only for one topping that stands off the food (cream, a pretzel knot, a skewer).

const F = (s, part, face, layer = 'inner') => s.face(part, face, layer);
const ALL = ['top', 'bottom', 'front', 'back', 'right', 'left'];
const SIDES = ['front', 'right', 'back', 'left'];

// 5-tone ramp (darkest … brightest) around a base colour.
const ramp5 = (color, base) => { const b = color.hex(base); return [color.shade(b, 0.55), color.shade(b, 0.75), color.shade(b, 0.9), b, color.shade(b, 1.22)]; };

// The pack's column shading: outer columns dark, middle light, top/bottom rows and corners one step darker.
function cols(f, R, y0 = 0, y1 = f.h - 1, { capTop = true, capBottom = true } = {}) {
  const idx = f.w === 8 ? [1, 2, 3, 4, 4, 3, 2, 1] : f.w === 4 ? [1, 3, 4, 2] : [1, 3, 2];
  for (let y = y0; y <= y1; y++) for (let x = 0; x < f.w; x++) {
    let i = idx[x];
    if ((capTop && y === y0) || (capBottom && y === y1)) i -= 1;
    f.set(x, y, R[Math.max(0, Math.min(4, i))]);
  }
}
const part = (s, p, R, opts) => ALL.forEach(face => cols(F(s, p, face), R, 0, F(s, p, face).h - 1, opts));
const mapOf = (color, m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, color.hex(v)]));

export default {
  style: 'minimal',
  updates: [
    {
      title: 'The Night Market',
      note: 'Three wanderers drift in from the night markets of distant cities: the gridded Belgian Waffle, the salt-crusted Pretzel and the three-coloured Dango on its wooden skewer.',
      skins: [
        {
          name: 'Belgian Waffle',
          story: 'Belgian Waffle, the Grid Knight, wears a crown of whipped cream and a strawberry, and warm syrup still drips down his golden armour of squares.',
          build: ({ Skin, color }) => {
            const s = new Skin();
            const W = ramp5(color, '#d99a3a'), G = ramp5(color, '#a8661c');
            const m = mapOf(color, { p: '#8a4c12', P: '#6a360a', c: '#fffaf0', C: '#ece4d4', r: '#c81e30', R: '#ff4a4a', y: '#ffe08a', l: '#3a9a32', s: '#c8740e', S: '#e8961e', e: '#4a2406' });
            for (const p of ['head', 'body', 'rightArm', 'rightLeg']) part(s, p, W);
            // The waffle grid: ridges stay light, the square pockets sink in
            const grid = (f, ox = 0, oy = 0) => {
              for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
                const rx = (x + ox) % 3 === 0, ry = (y + oy) % 3 === 0, edge = x === 0 || x === f.w - 1;
                if (rx || ry) f.set(x, y, edge ? W[2] : rx && ry ? W[3] : W[4]);
                else f.set(x, y, (x + ox) % 3 === 1 && (y + oy) % 3 === 1 ? G[0] : G[edge ? 1 : 2]);
              }
            };
            for (const face of ALL) { grid(F(s, 'body', face)); grid(F(s, 'rightArm', face), 1, 0); grid(F(s, 'rightLeg', face), 1, 1); }
            for (const face of ['front', 'right', 'left', 'back', 'bottom']) grid(F(s, 'head', face), 1, 1);
            // Face: cream on top, syrup running down, two dark syrup eyes
            F(s, 'head', 'top').fill(m.c).paint(['CccccccC', 'cc.cc..c', 'c.......', 'c..rR...', 'c..rr..c', 'cc.....c', 'cccc.ccc', 'CccccccC'], m);
            F(s, 'head', 'front').paint(['cCccCccC', 'c.sc.c.c', '..s...s.', '.yy..yy.', '.ye..ey.', '..S...s.', '........', '........'], m);
            for (const face of ['right', 'left', 'back']) F(s, 'head', face).paint(['cCccCccC', 'c.c.Cc.c', '..s..s..', '.....S..'], m);
            // Syrup drips on the chest and a strawberry slice on the belly
            F(s, 'body', 'front').paint(['.ss..ss.', '..S...s.', '..s.....', '......S.', '........'], m);
            F(s, 'body', 'back').paint(['.s....s.', '.S......'], m);
            // Overlay: a dollop of whipped cream with a strawberry on top
            F(s, 'head', 'top', 'outer').paint(['........', '..cccc..', '.cCcccc.', '.crRRrC.', '.crRyrc.', '.ccrrCc.', '..cccc..', '........'], m);
            F(s, 'head', 'front', 'outer').paint(['.cccCc..', '..s..c..', '......S.'], m);
            for (const face of ['right', 'left', 'back']) F(s, 'head', face, 'outer').paint(['..cCcc..', '...c....'], m);
            F(s, 'head', 'top', 'outer').paint(['...ll...', '....l...'], m, { y: 1 });
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Pretzel',
          story: 'Pretzel, the Twisted Baker, ties his dark glossy dough into a knot across his chest and sheds coarse salt crystals with every heavy step.',
          build: ({ Skin, color }) => {
            const s = new Skin();
            const B = ramp5(color, '#7a3a10'), L = ramp5(color, '#b86a2a');
            const m = mapOf(color, { h: '#2e1606', H: '#45220a', o: '#c47a3c', O: '#e09a58', w: '#ffffff', W: '#dcdcd8', y: '#ffd860', k: '#1a0c02', g: '#5e2e0e' });
            for (const p of ['head', 'body', 'rightArm', 'rightLeg']) part(s, p, B);
            // Twisted dough limbs: diagonal light/dark rope bands
            for (const p of ['rightArm', 'rightLeg']) for (const face of SIDES) {
              const f = F(s, p, face);
              for (let y = 0; y < 12; y++) for (let x = 0; x < 4; x++) if ((x + y) % 4 === 0) f.set(x, y, L[x === 0 || x === 3 ? 2 : 4]); else if ((x + y) % 4 === 1) f.set(x, y, L[x === 0 || x === 3 ? 1 : 3]);
            }
            for (const [p, face] of [['rightArm', 'front'], ['rightArm', 'back'], ['rightLeg', 'front'], ['rightLeg', 'right']]) F(s, p, face).paint(['....', '.w..', '....', '....', '....', '....', '....', '..W.'], m);
            // Head: a round bread roll with a split, two warm eyes, salt
            F(s, 'head', 'front').paint(['....w...', '....oOo.', '...o....', '.ky..yk.', '.kk..kk.', '......w.', '..w.....', '........'], m);
            F(s, 'head', 'top').paint(['........', '.w......', '...oO...', '..oOOo..', '..oOOo..', '...Oo...', '......W.', '........'], m);
            for (const face of ['right', 'left', 'back']) F(s, 'head', face).paint(['........', '..w.....', '.....o..', '....o...', '...o..W.', '........', '........'], m);
            // The knot on the chest: two loops above, the twist in the middle, one wide loop below (holes are dark)
            F(s, 'body', 'front').paint(['.oOOOOo.', 'oO.OO.Oo', 'O.hOOh.O', 'O.hhhh.O', 'oO.hh.Oo', '.oOooOo.', '..OOOO..', '.oO..Oo.', 'oO.hh.Oo', 'O.hhhh.O', 'oO.hh.Oo', '.oOOOOo.'], m);
            F(s, 'body', 'front').paint(['..w.....', '........', '........', '........', '......W.', '........', '....w...', '........', '........', '........', '.......w'], m);
            F(s, 'body', 'back').paint(['.oOOOOo.', 'oO.ww.Oo', 'O......O', 'O..W...O', 'oO....Oo', '.oOooOo.', '..O..O..', '.oO..Oo.', 'O..w...O', 'O......O', 'oO..W.Oo', '.oOOOOo.'], m);
            // Overlay: a little pretzel knot sits on top of the head like a crest, salt grains stand off the dough
            F(s, 'head', 'top', 'outer').paint(['........', '..OOOO..', '.Oo..oO.', '.O.OO.O.', '.Oo..oO.', '..OOOO..', '........', '........'], m);
            F(s, 'head', 'front', 'outer').paint(['..oOOo..', '.O....O.'], m);
            F(s, 'head', 'back', 'outer').paint(['..oOOo..', '.O....O.'], m);
            F(s, 'body', 'front', 'outer').paint(['........', '...w....', '........', '........', '........', '........', '.......W', '........', '..w.....'], m);
            F(s, 'rightArm', 'front', 'outer').paint(['....', '....', '..w.', '....', '....', '....', 'W...'], m);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Dango',
          story: 'Dango, the Sakura Wanderer, is three sweet rice balls threaded on one wooden skewer, pink, white and green, and blossom petals follow wherever he rolls.',
          build: ({ Skin, color }) => {
            const s = new Skin();
            const P = ramp5(color, '#f29ab8'), Wh = ramp5(color, '#efe9de'), G = ramp5(color, '#7cbf5a'), Wd = ramp5(color, '#c8a064');
            const m = mapOf(color, { e: '#3a2030', b: '#ff6f9c', w: '#ffffff', p: '#ffc4d8', P: '#ff8fb6', t: '#9a7240', T: '#d8b278', k: '#5a8a3a' });
            // Pink ball head, white ball body and arms, green ball legs
            part(s, 'head', P); part(s, 'body', Wh); part(s, 'rightArm', Wh); part(s, 'rightLeg', G);
            // Round the balls off: darker corners where one ball meets the next
            for (const face of SIDES) {
              const f = F(s, 'body', face);
              for (const y of [0, 11]) { f.set(0, y, Wh[0]); f.set(f.w - 1, y, Wh[0]); }
              F(s, 'rightLeg', face).row(0, G[1]);
            }
            F(s, 'head', 'front').paint(['........', '........', '........', '.e....e.', '.ew..ew.', 'b......b', '...ee...', '........'], m);
            // The skewer runs right through: a wooden stick down the middle of the back and between the legs
            F(s, 'body', 'back').col(3, Wd[2]).col(4, Wd[3]);
            F(s, 'body', 'front').paint(['........', '........', '....P...', '...PpP..', '....P...', '........', '........', '.P......', 'PpP.....', '.P......'], m);
            F(s, 'body', 'back').paint(['........', '.P......', 'PpP.....', '.P......'], m, { y: 5 });
            F(s, 'head', 'back').col(3, Wd[2], 5, 7).col(4, Wd[3], 5, 7);
            F(s, 'body', 'bottom').paint(['........', '...tT...', '...tT...', '........'], m);
            F(s, 'rightArm', 'front').paint(['....', '....', '....', '....', '....', '....', '....', '....', '....', '.p..', 'pPp.', '.p..'], m);
            // Overlay: the end of the skewer pokes out of the head, petals cling to the white ball
            F(s, 'head', 'top', 'outer').paint(['........', '........', '........', '...tT...', '...Tt...', '........', '........', '........'], m);
            F(s, 'head', 'front', 'outer').paint(['...tT...'], m);
            F(s, 'head', 'back', 'outer').paint(['...Tt...', '...tT...'], m);
            F(s, 'body', 'front', 'outer').paint(['.p......', '........', '........', '........', '........', '......P.', '........', '........', '........', '........', '...p....'], m);
            F(s, 'body', 'back', 'outer').paint(['......p.', '........', '........', '........', '........', '........', '........', '.....P..'], m);
            s.mirrorLimbs();
            F(s, 'leftArm', 'front', 'outer').paint(['....', '..p.'], m, { y: 3 });
            return s;
          }
        }
      ]
    }
  ]
};
