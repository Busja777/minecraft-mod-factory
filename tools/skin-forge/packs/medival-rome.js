// Medival Rome: Roman soldiers, gladiators and generals. Pack look (hand-made V1.0–V1.2): everything is
// shaded in vertical columns (dark edge, then alternating light/mid columns), warm gold metal with a
// 5-step ramp, big white cartoon eyes with a black pupil on the inner side, faces often framed by a
// helmet. The overlay carries only crests, capes and a few bands. Existing: Centurion, Legionary,
// Murmillo, Praetorian Guard, General, Retiarius, Eques, Thraex, Auxiliary. The builder paints every face
// directly in that column style.

const F = (s, part, face, layer = 'inner') => s.face(part, face, layer);
const SIDES = ['front', 'right', 'back', 'left'];
const ALL = ['top', 'bottom', ...SIDES];

// Column shading: T = [dark edge, mid-dark, mid, light]. 8 wide: edge, mid-dark, then light/mid alternating.
function vfill(f, T, y0 = 0, y1 = f.h - 1) {
  const idx = f.w === 8 ? [0, 1, 3, 2, 3, 2, 1, 0] : f.w === 4 ? [0, 2, 3, 1] : [0, 2, 1];
  for (let y = y0; y <= y1; y++) for (let x = 0; x < f.w; x++) f.set(x, y, T[idx[x]]);
}
const whole = (s, part, T, faces = ALL) => faces.forEach(face => vfill(F(s, part, face), T));
const limbs = (s, which, fn) => which.forEach(p => SIDES.forEach(face => fn(F(s, p, face), face, p)));
const both = (kind) => kind === 'arm' ? ['rightArm', 'leftArm'] : ['rightLeg', 'leftLeg'];
const mapOf = (color, m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Array.isArray(v) ? v : color.hex(v)]));
const tones = (color, list) => list.map(c => color.hex(c));

// The pack's materials
const GOLD = ['#372308', '#5c3e0f', '#8a6219', '#bc942d', '#e4bc4e', '#f8d24e'];
const SKIN = ['#764b2a', '#a27048', '#c8986c', '#e8bc94'];
const EYES = { i: '#e1dad0', j: '#120e0a' };

export default {
  style: 'accent',
  updates: [
    {
      title: 'Eagles, Arrows and Steel',
      note: 'The horn sounds again over the ruined arena: the lion-cloaked Roman Aquilifer raises the golden eagle, the Roman Archer strings his bow, and the smooth-helmeted Secutor Gladiator hunts across the sand.',
      skins: [
        {
          name: 'Roman Aquilifer',
          story: 'The Roman Aquilifer wears a whole lion pelt over his helmet and a golden eagle on his bronze chest, and the legion still marches wherever that eagle points.',
          build: ({ Skin, color }) => {
            const s = new Skin();
            const SK = tones(color, SKIN), BR = tones(color, ['#33373e', '#5c636d', '#8f98a3', '#c3cad3']), RED = tones(color, ['#690a0a', '#9b1212', '#c81e1e', '#ee3737']);
            const LI = tones(color, ['#5a3a12', '#8a5e22', '#b98a3a', '#d8aa58']), LE = tones(color, ['#3e230c', '#623e19', '#8a5f2a', '#a27048']);
            const m = mapOf(color, { ...EYES, a: SK[0], b: SK[1], c: SK[2], d: SK[3], M: LI[1], m: LI[0], L: LI[2], l: LI[3], y: '#f0c030', n: '#2a1606', t: '#f0ead8', G: GOLD[4], g: GOLD[3], h: GOLD[5], k: GOLD[1], r: RED[2], R: RED[1], p: '#e8d0a0' });
            // Head: lion pelt over a bronze cap, face in the middle
            whole(s, 'head', LI);
            F(s, 'head', 'front').paint(['MLlLLlLM', 'MLllllLM', 'mMMnnMMm', 'bccccccb', 'biicciib', 'bijccjib', 'bccbbccb', 'abccccba'], m);
            // Body: bronze muscle cuirass, golden eagle, the lion's paws knotted at the collar, red tunic and leather strips below
            whole(s, 'body', BR);
            F(s, 'body', 'front').paint(['LlM..MlL', '.MLllLM.', '...gg...', 'G..gg..G', 'GG.GG.GG', 'gGGGGGGg', '.gGhhGg.', '...GG...', '..g..g..', 'rRrRrRrR', 'nLnLnLnL', 'nMnMnMnM'], m);
            F(s, 'body', 'back').paint(['........', '........', '........', '........', '........', '........', '........', '........', '........', 'rRrRrRrR', 'nLnLnLnL', 'nMnMnMnM'], m);
            for (const face of ['right', 'left']) F(s, 'body', face).paint(['....', '....', '....', '....', '....', '....', '....', '....', '....', 'rRrR', 'nLnL', 'nMnM'], m);
            // Arms: short red sleeves, bare arms, leather bracers
            limbs(s, both('arm'), f => { vfill(f, SK); vfill(f, RED, 0, 2); vfill(f, LE, 8, 10); f.row(3, RED[0]); });
            for (const p of both('arm')) { vfill(F(s, p, 'top'), RED); vfill(F(s, p, 'bottom'), SK); }
            // Legs: red hem, bare legs, laced sandals
            limbs(s, both('leg'), f => { vfill(f, SK); vfill(f, RED, 0, 1); f.paint(['....', '....', '....', '....', '....', '....', 'n..n', '.nn.', 'n..n', '.nn.', 'nnnn', 'nnnn'], m); });
            for (const p of both('leg')) { vfill(F(s, p, 'top'), RED); F(s, p, 'bottom').fill(LE[0]); }
            // Overlay: the mane frames the face, fangs hang over the brow, the pelt falls down the back like a cape
            F(s, 'head', 'front', 'outer').paint(['MLMllMLM', 'MnL..LnM', 'm.pnnp.m', 'Mt....tM', 'M......M', 'm......m', 'M......M', 'Mm....mM'], m);
            for (const face of ['right', 'left']) F(s, 'head', face, 'outer').paint(['MLMMLMLM', 'MMLMMLMM', 'mMMmMMMm', 'MmMMmMMM', 'M.MmM.mM', 'm..M..Mm', '.m..m..M', '......mm'], m);
            F(s, 'head', 'back', 'outer').paint(['MLMMLMLM', 'MMLMMLMM', 'mMMmMMMm', 'MmMMmMMM', 'MMmMMmMM', 'mMMMMMMm', 'MmMmMmMm', 'MMMMMMMM'], m);
            F(s, 'head', 'top', 'outer').paint(['M.LLLL.M', 'MLlLLlLM', '.LlLLlL.', '.LLLLLL.', '.LLllLL.', '.MLLLLM.', 'MMMLLMMM', 'MMMMMMMM'], m);
            F(s, 'body', 'back', 'outer').paint(['MMMMMMMM', 'MLMMLMML', 'MMLMMLMM', 'MmMMmMMM', 'MMMmMMMm', 'MLMMLMMM', 'MMmMMMmM', 'mMMMmMMM', 'MMMMMMMM', 'm.M.mM.M', '..m...m.'], m);
            F(s, 'body', 'front', 'outer').paint(['lL....Ll', '.lL..Ll.'], m);
            for (const p of both('arm')) F(s, p, 'top', 'outer').paint(['MMMM', 'MLLM', 'MLLM', 'MMMM'], m);
            for (const p of both('arm')) for (const face of SIDES) F(s, p, face, 'outer').paint(['MLMM', 'm..m'], m);
            return s;
          }
        },
        {
          name: 'Roman Archer',
          story: 'The Roman Archer came from the eastern frontier in a pointed helmet and a green tunic, and the arrows in his quiver have never once missed a torch on the arena wall.',
          build: ({ Skin, color }) => {
            const s = new Skin();
            const SK = tones(color, SKIN), GR = tones(color, ['#1f3518', '#34562a', '#4e7a3a', '#6c9a4c']), LE = tones(color, ['#3e230c', '#623e19', '#8a5f2a', '#a27048']);
            const ST = tones(color, ['#3a3f47', '#6a707a', '#9aa1ab', '#c7cdd4']), BE = tones(color, ['#1c140c', '#2e2216', '#3e2e1e', '#4e3a26']);
            const m = mapOf(color, { ...EYES, a: SK[0], b: SK[1], c: SK[2], d: SK[3], s: ST[1], S: ST[2], H: ST[3], k: ST[0], e: BE[1], E: BE[2], l: LE[1], L: LE[2], o: LE[3], g: GOLD[4], G: GOLD[3], w: '#f2eee4', r: '#c81e1e', t: '#c8a878' });
            // Head: pointed steel helmet with a gold rim, dark beard
            whole(s, 'head', ST, ['top', 'right', 'left', 'back']);
            vfill(F(s, 'head', 'bottom'), SK);
            F(s, 'head', 'front').paint(['ksSHHSsk', 'ksSHHSsk', 'GgGgGgGg', 'bccccccb', 'bii..iib', 'bij..jib', 'eccbbcce', 'eeEeeEee'], m);
            F(s, 'head', 'front').paint(['...cc...', '...bb...'], m, { x: 0, y: 4 });
            for (const face of ['right', 'left', 'back']) F(s, 'head', face).paint(['........', '........', 'GgGgGgGg', 'eeeeeeee', 'eEeeEeee', '........', '........', '........'], m);
            for (const face of ['right', 'left']) F(s, 'head', face).paint(['cccccccc', 'cccccccc', 'bccccccb', 'eecccccc', 'eeeecccc'].map(r => face === 'left' ? r : [...r].reverse().join('')), m, { y: 3 });
            // Body: green tunic, a leather baldric across the chest, belt with gold buckle
            whole(s, 'body', GR);
            F(s, 'body', 'front').paint(['......lL', '.....lL.', '....lL..', '...lL...', '..lL....', '.lL.....', 'lL......', 'L.......', 'eEeggeEe', '........', '........', 'kskskssk'].map(r => r), m);
            F(s, 'body', 'back').paint(['lL......', '.lL.....', '..lL....', '...lL...', '....lL..', '.....lL.', '......lL', '.......L', 'eEeEeEeE', '........', '........', 'kskskssk'], m);
            for (const face of ['right', 'left']) F(s, 'body', face).paint(['....', '....', '....', '....', '....', '....', '....', '....', 'eEeE'], m);
            // Arms: long green sleeves, leather bracers, bare hands
            limbs(s, both('arm'), f => { vfill(f, GR); vfill(f, LE, 7, 9); f.row(7, LE[3]); vfill(f, SK, 10, 11); });
            for (const p of both('arm')) { vfill(F(s, p, 'top'), GR); vfill(F(s, p, 'bottom'), SK); }
            // Legs: brown trousers, wrapped boots
            const TR = tones(color, ['#2e2014', '#4a3420', '#66482c', '#7e5c3a']);
            limbs(s, both('leg'), f => { vfill(f, TR); vfill(f, LE, 7, 11); f.paint(['....', '....', '....', '....', '....', '....', '....', 'tttt', 'l.l.', '.l.l', 'l.l.', 'eeee'], m); });
            for (const p of both('leg')) { vfill(F(s, p, 'top'), TR); F(s, p, 'bottom').fill(BE[0]); }
            // Overlay: the pointed helmet tip, the quiver on the back with red-and-white fletching
            F(s, 'head', 'top', 'outer').paint(['........', '........', '..sSSs..', '..SHHS..', '..SHHS..', '..sSSs..', '........', '........'], m);
            F(s, 'head', 'front', 'outer').paint(['..sHHs..', '........', 'GgGgGgGg'], m);
            for (const face of ['right', 'left', 'back']) F(s, 'head', face, 'outer').paint(['..sSSs..', '........', 'GgGgGgGg'], m);
            F(s, 'body', 'back', 'outer').paint(['.rw.wr..', '.lLLLl..', '.lLoLl..', '.lLLLl..', '.lLoLl..', '.lLLLl..', '.lLoLl..', '.lLLLl..', '.eeeee..'], m);
            F(s, 'body', 'right', 'outer').paint(['....', '.L..'], m);
            for (const p of both('arm')) for (const face of SIDES) F(s, p, face, 'outer').paint(['....', '....', '....', '....', '....', '....', '....', 'LoLo'], m);
            return s;
          }
        },
        {
          name: 'Secutor Gladiator',
          story: 'The Secutor Gladiator hides his whole head in a smooth steel egg with two tiny eye holes, built to chase the net-fighters across the sand without ever being caught.',
          build: ({ Skin, color }) => {
            const s = new Skin();
            const SK = tones(color, ['#6a4022', '#93623a', '#bb8a5e', '#dbaa7e']), ST = tones(color, ['#3a3f47', '#6a707a', '#9aa1ab', '#c7cdd4']);
            const LE = tones(color, ['#2e1a0a', '#4a2c12', '#6e4420', '#8e5c30']), WH = tones(color, ['#9b948a', '#c3bcb2', '#e1dcd4', '#f2eee8']);
            const m = mapOf(color, { ...EYES, a: SK[0], b: SK[1], c: SK[2], d: SK[3], k: ST[0], s: ST[1], S: ST[2], H: ST[3], X: '#eef2f6', z: '#20242a', l: LE[1], L: LE[2], o: LE[3], w: WH[2], W: WH[3], v: WH[1], r: '#9b1212', R: '#c81e1e', q: SK[0] });
            // Head: one smooth steel dome, two small round eye holes, a ridge down the middle
            whole(s, 'head', ST);
            F(s, 'head', 'front').paint(['kssHHssk', 'ksSXHSsk', 'ksSSHSsk', 'kiiSHiik', 'kijSHjik', 'ksSSHSsk', 'ksz..zsk', 'kssssssk'], m);
            F(s, 'head', 'front').paint(['........', '........', '........', '........', '........', '........', '...SS...'], m);
            // Body: bare scarred chest, wide leather belt with steel studs, white loincloth with a red edge
            whole(s, 'body', SK);
            F(s, 'body', 'front').paint(['........', '..bb.bb.', '.b..b..b', '........', '..a.....', '.a......', 'a.......', 'lLlLlLlL', 'LSLLLLSL', 'wWwWWwWw', 'wWwrrwWw', 'vrvvvvrv'], m);
            F(s, 'body', 'back').paint(['........', '........', '..bbbb..', '........', '........', '........', '........', 'lLlLlLlL', 'LSLLLLSL', 'wwWwwWww', 'wwwwwwww', 'rrrrrrrr'], m);
            for (const face of ['right', 'left']) F(s, 'body', face).paint(['....', '....', '....', '....', '....', '....', '....', 'lLlL', 'LLLL', 'wWwW', 'wwww', 'vrvr'], m);
            // Right arm: the segmented steel manica; left arm bare with a leather wrist strap
            for (const face of SIDES) { const f = F(s, 'rightArm', face); for (let y = 0; y < 12; y++) vfill(f, y % 2 ? [ST[0], ST[0], ST[1], ST[1]] : ST, y, y); f.row(11, LE[2]); }
            vfill(F(s, 'rightArm', 'top'), ST); F(s, 'rightArm', 'bottom').fill(LE[1]);
            for (const face of SIDES) { const f = F(s, 'leftArm', face); vfill(f, SK); vfill(f, LE, 8, 9); }
            vfill(F(s, 'leftArm', 'top'), SK); vfill(F(s, 'leftArm', 'bottom'), SK);
            // Legs: left leg with a tall steel greave, right leg wrapped in cloth bands, leather sandals
            for (const face of SIDES) {
              const r = F(s, 'rightLeg', face), l = F(s, 'leftLeg', face);
              vfill(r, WH); vfill(r, WH, 0, 0); r.paint(['wwww', 'v.v.', '.v.v', 'v.v.', '.v.v', 'v.v.', '.v.v', 'v.v.', '.v.v', 'v.v.', 'llll', 'LLLL'], m);
              vfill(l, SK, 0, 3); vfill(l, ST, 4, 10); l.row(4, ST[3]); l.row(10, ST[0]); vfill(l, LE, 11, 11);
            }
            for (const p of both('leg')) { vfill(F(s, p, 'top'), WH); F(s, p, 'bottom').fill(LE[0]); }
            // Overlay: the low fin crest along the helmet, the manica shoulder guard, the greave's knee cap
            F(s, 'head', 'top', 'outer').paint(['...HS...', '...HS...', '...HS...', '...HS...', '...HS...', '...HS...', '...HS...', '...HS...'], m);
            F(s, 'head', 'front', 'outer').paint(['...HS...'], m);
            F(s, 'head', 'back', 'outer').paint(['...SH...', '...Ss...'], m);
            for (const face of ['right', 'left']) F(s, 'head', face, 'outer').paint(['........', '........', '........', '........', '........', '........', '........', 'kkkkkkkk'], m);
            F(s, 'head', 'front', 'outer').paint(['k......k'], m, { y: 7 });
            F(s, 'head', 'back', 'outer').paint(['kkkkkkkk'], m, { y: 7 });
            F(s, 'rightArm', 'top', 'outer').paint(['SHHS', 'SHHS', 'SHHS', 'SHHS'], m);
            for (const face of SIDES) F(s, 'rightArm', face, 'outer').paint(['HSSH', 'sSSs', 'k..k'], m);
            for (const face of SIDES) F(s, 'leftLeg', face, 'outer').paint(['....', '....', '....', '....', 'HSSH', 'sssS'], m);
            return s;
          }
        }
      ]
    }
  ]
};
