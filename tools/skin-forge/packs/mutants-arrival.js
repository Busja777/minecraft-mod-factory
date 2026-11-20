// Mutants Arrival: Steve split straight down the middle. The character's right half (viewer's left) is
// always the same Steve (brown hair, blue eye, blue shirt, grey trousers); the left half is a mob.
// Existing: Enderman, Skeleton, Enderdragon, Pig, Slime, Chicken, Cow, Creeper, Baby Chicken, Sheep,
// Zombie, Blaze, Fox. The hand-made skins are flat-shaded with a 3-tone pixel texture on the mob side
// and keep the overlay almost empty (ears, a few specks). The builder takes the Steve half from an
// existing skin and paints a new mob half; the overlay only carries the mob's 3D bits.

const F = (s, part, face, layer = 'inner') => s.face(part, face, layer);

// The mob half: which columns of each face belong to the mob.
const HALF = [
  ['head', 'top', 4, 7], ['head', 'bottom', 4, 7], ['head', 'front', 4, 7], ['head', 'back', 0, 3], ['head', 'left', 0, 7],
  ['body', 'top', 4, 7], ['body', 'bottom', 4, 7], ['body', 'front', 4, 7], ['body', 'back', 0, 3], ['body', 'left', 0, 3],
  ...['top', 'bottom', 'front', 'back', 'left', 'right'].flatMap(f => [['leftArm', f, 0, 3], ['leftLeg', f, 0, 3]])
];

// Steve from an existing skin, overlay cleared, mob half filled with a pixel texture of the given tones.
function steveHalf({ existing, color }, tones, seed) {
  const s = existing('Steve x Creeper');
  s.clearLayer('outer');
  const T = tones.map(t => [color.hex(t[0]), t[1]]);
  for (const [part, face, x0, x1] of HALF) {
    const f = F(s, part, face);
    f.texture(T, `${seed}:${part}:${face}`, { only: x => x >= x0 && x <= x1 });
  }
  return s;
}
// Paints 4-wide rows onto the mob half of a split face (front: x 4–7, back: x 0–3).
const onHalf = (s, part, face, rows, map, y = 0, layer = 'inner') =>
  F(s, part, face, layer).paint(rows, map, { x: face === 'back' ? 0 : 4, y });
const limbSides = ['front', 'left', 'back', 'right'];

export default {
  style: 'minimal',
  updates: [
    {
      title: 'Webs, Iron and Echoes',
      note: 'The crater reaches deeper: Steve x Spider climbs out of the caves, Steve x Iron Golem stomps in from the village, and the blind Steve x Warden rises from the deep dark.',
      skins: [
        {
          name: 'Steve x Spider',
          story: 'His dark, bristly half clings to the cave walls at night, and a cluster of red eyes watches you even when the human eye is closed.',
          build: kit => {
            const { color } = kit;
            const s = steveHalf(kit, [['#2e2723', 4], ['#3d3430', 3], ['#4c423b', 2], ['#231e1b', 2]], 'spider');
            const m = { R: '#ff2424', r: '#9a1010', o: '#5a0c0c', k: '#141110', h: '#5c5048', H: '#6e6158', w: '#a8a6a0', W: '#d4d2cc', f: '#b8a890' };
            for (const k in m) m[k] = color.hex(m[k]);
            // Eight red eyes: two big ones where the Steve eye sits, small ones around them
            onHalf(s, 'head', 'front', ['.r.r', 'kkkk', 'kRRk', 'oRRr', '...r', '.k.k', '.f.f', '....'], m, 1);
            F(s, 'head', 'left').paint(['........', '........', '..r.....', '.rR.....', '........'], m);
            F(s, 'head', 'top').paint(['....k.k.', '.....k..', '....k.k.'], m, { y: 5 });
            // Darker abdomen stripes on the body, banded legs
            onHalf(s, 'body', 'front', ['hHhh', '....', 'kkkk', '....', '....', 'kkkk', '....', '....', 'kkkk'], m, 1);
            onHalf(s, 'body', 'back', ['hHhh', '.H..', 'Hh.H', '.H..', 'kkkk', '....', '....', 'kkkk', '....', 'kkkk'], m, 1);
            for (const f of limbSides) {
              F(s, 'leftArm', f).paint(['....', 'kkkk', '....', '....', '....', 'kkkk', '....', '....', 'hhhh', 'kkkk', '....', 'kkkk'], m);
              F(s, 'leftLeg', f).paint(['....', '....', 'kkkk', '....', '....', '....', 'kkkk', '....', '....', '....', 'kkkk', 'kkkk'], m);
            }
            // Overlay: bristles, a fang, two extra legs sprouting from the back, a cobweb on the leg
            onHalf(s, 'head', 'front', ['.h.H', '....', '....', '....', '....', '....', '.w..'], m, 0, 'outer');
            F(s, 'head', 'top', 'outer').paint(['.....H..', '....h..h', '......H.', '.....h..', '.......H'], m);
            F(s, 'head', 'left', 'outer').paint(['.H..h..H', 'h.......'], m);
            onHalf(s, 'body', 'back', ['k...', '.k..', '..k.', 'k..k', '.k..', '..k.', '...k'], m, 1, 'outer');
            F(s, 'body', 'left', 'outer').paint(['....', '..kk', '.k..', 'k...', '....', '.kkk', 'k...'], m, { y: 1 });
            for (const f of ['front', 'left']) F(s, 'leftArm', f, 'outer').paint(['h..H', '....', '....', '.h..', '....', '....', 'H..h'], m);
            F(s, 'leftLeg', 'front', 'outer').paint(['....', '....', '....', 'w.W.', '.w.w', 'W.w.', '.W..', 'w...'], m);
            F(s, 'leftLeg', 'left', 'outer').paint(['....', '....', '....', '...w', '..W.', '.w..'], m);
            return s;
          }
        },
        {
          name: 'Steve x Iron Golem',
          story: 'Half of him turned to heavy, vine-wrapped iron, and the villagers sleep easy now because he still carries a red poppy for every child he guards.',
          build: kit => {
            const { color } = kit;
            const s = steveHalf(kit, [['#a8a196', 4], ['#bcb5aa', 4], ['#cfc8bc', 2], ['#948d82', 2]], 'golem');
            const m = { k: '#5a544b', K: '#3e3a34', n: '#d8d1c4', N: '#e4ddd0', R: '#8e1a14', c: '#7a746a', v: '#3a6a22', V: '#5c9a32', l: '#7cba44', p: '#d42a1e', P: '#ff4a36', y: '#f0d040' };
            for (const k in m) m[k] = color.hex(m[k]);
            // Heavy brow, small dark-red eye, the long golem nose on the seam, a vine down the cheek
            onHalf(s, 'head', 'front', ['....', 'kkkk', 'KKKK', 'nRk.', 'nkk.', 'n..v', 'N.V.', 'n.v.'], m);
            F(s, 'head', 'left').paint(['.......V', '......Vv', '..c..V..', '.c..v...', '..cV....', '...v....', '..V.....', '..v.....'], m);
            F(s, 'head', 'top').paint(['....kkkk', '........', '......c.', '.....c..', '........', '.......V', '......v.', '.....V..'], m);
            onHalf(s, 'head', 'back', ['V...', '.v..', '..V.', '.v..', 'v...', '....', 'c...', '.c..'], m);
            // Riveted chest plate with cracks and a vine across it
            onHalf(s, 'body', 'front', ['c..c', '....', '.c..', '..c.', '....', 'V...', '.vV.', '...v', '....', 'kkkk', 'c..c', '....'], m);
            onHalf(s, 'body', 'back', ['c..c', '.V..', 'v.V.', '..v.', '....', '..c.', '.c..', '....', '....', 'kkkk', '....', '....'], m);
            F(s, 'body', 'left').paint(['.V..', 'v...', '.v..', '....', '..c.', '.c..'], m);
            // Long iron arm, a poppy in the hand
            for (const f of limbSides) F(s, 'leftArm', f).paint(['kkkk', '....', '..c.', '.c..', '....', 'kkkk', '....', '.v..', 'V...', 'kkkk', '....', '....'], m);
            F(s, 'leftArm', 'front').paint(['.PpP', 'pyPp', '.Vp.'], m, { y: 9 });
            for (const f of limbSides) F(s, 'leftLeg', f).paint(['....', '....', '..c.', '....', 'kkkk', '....', '....', '....', '....', 'kkkk', 'KKKK', 'KKKK'], m);
            F(s, 'leftLeg', 'front').paint(['....', '.v..', 'V...', 'v...'], m, { y: 5 });
            // Overlay: the nose stands off the face, brow ridge, hanging vines, the poppy petals
            onHalf(s, 'head', 'front', ['....', '....', 'kkkk', '....', 'n...', 'N...', 'n...', 'N...'], m, 0, 'outer');
            F(s, 'head', 'left', 'outer').paint(['......lV', '.......V', '.....V..', '....l...', '...V....', '..V.....', '..l.....'], m);
            F(s, 'head', 'top', 'outer').paint(['........', '........', '........', '........', '........', '.......l', '......V.', '.....l..'], m);
            F(s, 'body', 'front', 'outer').paint(['.....V..', '.....l..', '......V.', '.......l'], m, { y: 5 });
            F(s, 'leftArm', 'top', 'outer').paint(['.V..', 'lV..'], m);
            for (const [f, rows] of [['front', ['V...', 'l...', '.V..', '....', '....', '....', '....', '.l..', 'V...']], ['left', ['.V..', 'V...', 'l...', '....', '....', '....', '....', 'V...', '.l..']]]) F(s, 'leftArm', f, 'outer').paint(rows, m);
            F(s, 'leftArm', 'front', 'outer').paint(['P..P', '..P.'], m, { y: 9 });
            return s;
          }
        },
        {
          name: 'Steve x Warden',
          story: 'He came up from the deep dark without a left eye at all, and the souls trapped in his chest glow brighter every time you make a sound.',
          build: kit => {
            const { color } = kit;
            const s = steveHalf(kit, [['#0b2229', 4], ['#103039', 4], ['#173d47', 2], ['#081a20', 2]], 'warden');
            const m = { c: '#0e8f9a', C: '#29dfeb', G: '#a8fbff', k: '#040e12', t: '#cfd8c8', T: '#a8b4a2', b: '#244e58', B: '#2f6470' };
            for (const k in m) m[k] = color.hex(m[k]);
            // No eye at all, glowing cheek, a pale jaw of teeth
            onHalf(s, 'head', 'front', ['....', 'b...', 'kkkk', 'kkk.', '.c..', 'C..c', 'tTtT', 'k.k.'], m);
            F(s, 'head', 'left').paint(['........', '........', '......c.', '.....cC.', '......c.', '........', 'TtTt....', '........'], m);
            F(s, 'head', 'top').paint(['....b.b.', '.....B..', '....b..b'], m, { y: 2 });
            // Glowing soul ribcage, soul spots down the arm and leg
            onHalf(s, 'body', 'front', ['....', 'C...', 'GC.c', 'Cc..', 'C.c.', 'GC.c', 'Cc..', 'c...', '....', 'kkkk', '....', '.c..'], m);
            onHalf(s, 'body', 'back', ['....', 'b..b', '.bb.', 'b..b', '.bb.', 'b..b', '.bb.', '....', '....', 'kkkk', '....', '....'], m);
            F(s, 'body', 'left').paint(['....', '....', 'c...', 'Cc..', 'c...', '....', '....', '....', '....', 'kkkk'], m);
            F(s, 'leftArm', 'front').paint(['....', '....', '.c..', 'cCc.', '.c..', '....', '....', '..b.', '.bB.', 'kkkk', 'TtTt', 'kkkk'], m);
            F(s, 'leftArm', 'left').paint(['....', '....', '....', '..c.', '....', '....', '.b..', '....', '....', 'kkkk', 'tTtT', 'kkkk'], m);
            F(s, 'leftArm', 'back').paint(['....', '.b..', '....', '..b.', '....', '....', '.b..', '....', '....', 'kkkk', 'TtTt', 'kkkk'], m);
            F(s, 'leftArm', 'right').paint(['....', '....', '....', '....', '....', '....', '....', '....', '....', 'kkkk', 'tTtT', 'kkkk'], m);
            for (const f of limbSides) F(s, 'leftLeg', f).paint(['....', '....', '....', '....', '....', '....', '....', '....', '....', 'kkkk', 'kkkk', 'kkkk'], m);
            F(s, 'leftLeg', 'front').paint(['....', '.c..', 'cCc.', '.c..', '....', '....', '..b.', '.bB.'], m, { y: 1 });
            // Overlay: the curled ear tendrils with glowing tips stick out of the side and top of the head
            F(s, 'head', 'left', 'outer').paint(['bBBb....', 'BCGB....', 'bCCB....', '.bBb....', '..b.....'], m, { y: 1 });
            F(s, 'head', 'top', 'outer').paint(['......bB', '......BC', '.......B'], m);
            onHalf(s, 'head', 'front', ['...B', '...b'], m, 1, 'outer');
            onHalf(s, 'head', 'back', ['B...', 'b...'], m, 1, 'outer');
            onHalf(s, 'body', 'front', ['....', '....', 'G...', '....', '....', 'G...'], m, 0, 'outer');
            return s;
          }
        }
      ]
    }
  ]
};
