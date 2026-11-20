// Dark Villains PVP — dim ember villains. Existing (V1.0): twelve close variants of one design
// (Ember Reaver, Ashen Wraith, Cinder Brute, Blood Harbinger, …): charred brown-black body with
// vertical streaks, a few glowing cracks, red/orange eyes, grey metal pads on shoulders and boots.
// They glow dimly (~71 % black, only ~1.3 % bright pixels, overlay ~79 % transparent), so the pack
// runs as 'accent', not 'glow'. The new villains keep the charred material and the dim embers but
// each gets its own silhouette: crown, horns, veil, cage helm, executioner hood, beast snout,
// eclipse hood, skull and cloak, obsidian full helm.

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

const PARTS = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
const SIDES = ['front', 'right', 'back', 'left'];
const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
const mul = (c, f) => [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f), 255];
const flip = rows => rows.map(r => [...r].reverse().join(''));

// Paint map (inner and overlay alike): '.' keeps, ' ' clears.
//   K near black · 0–4 charred body shades (dark → light) · E ember, e ember mid, d ember dark, H hot core
//   F second colour, f mid, g dark · L/M/m/n metal light → dark · plus extra colours per villain.
function villain(opts, decorate) {
  return ({ Skin, color }) => {
    const { seed, slim = false, tint = '#1c120e', ember, second = ember, metal = '#4e4a54', extra = {}, bleed = 0.4, sparks = 0.004 } = opts;
    const s = new Skin({ slim });
    const r = color.rng(`dark-villain-${seed}`);
    const t = color.hex(tint), E = color.hex(ember), F = color.hex(second), Mt = color.hex(metal);
    const D = [mul(t, 0.36), mul(t, 0.55), mul(t, 0.78), t, mul(t, 1.55)];
    const map = {
      K: [6, 4, 4, 255], 0: D[0], 1: D[1], 2: D[2], 3: D[3], 4: D[4],
      E, e: mul(E, 0.6), d: mul(E, 0.32), H: color.mix(E, '#fff4d6', 0.55),
      F, f: mul(F, 0.6), g: mul(F, 0.32),
      L: color.mix(Mt, '#ffffff', 0.25), M: Mt, m: mul(Mt, 0.62), n: mul(Mt, 0.36)
    };
    for (const [k, v] of Object.entries(extra)) map[k] = color.hex(v);

    // Charred base: vertical streaks like the hand-made villains.
    for (const part of PARTS) for (const f of s.faces(part)) {
      for (let x = 0; x < f.w; x++) {
        const p = r(), base = p < 0.12 ? 0 : p < 0.45 ? 1 : p < 0.8 ? 2 : 3;
        for (let y = 0; y < f.h; y++) {
          const i = base + (r() < 0.16 ? (r() < 0.5 ? -1 : 1) : 0);
          f.set(x, y, D[Math.max(0, Math.min(3, i))]);
        }
      }
    }

    const P = (part, face, rows, { layer = 'inner', x = 0, y = 0 } = {}) => s.face(part, face, layer).paint(rows, map, { x, y });
    const O = (part, face, rows, at = {}) => P(part, face, rows, { ...at, layer: 'outer' });
    // Same rows on all four sides of a part (limbs: written 4 wide, sliced for slim arms).
    const W = (part, rows, { layer = 'inner', y = 0 } = {}) => {
      for (const face of SIDES) {
        const f = s.face(part, face, layer);
        P(part, face, rows.map(x => (f.w < 4 ? x.slice(4 - f.w) : x)), { layer, y });
      }
    };
    const Wo = (part, rows, at = {}) => W(part, rows, { ...at, layer: 'outer' });
    // A small glowing crack: a short wandering line, hot in the middle, dark at the ends.
    const crack = (part, face, n = 4, { x, y } = {}) => {
      const f = s.face(part, face);
      let cx = x ?? Math.floor(r() * f.w), cy = y ?? Math.floor(r() * Math.max(1, f.h - n));
      for (let i = 0; i < n; i++) {
        f.set(cx, cy, map[i === 0 || i === n - 1 ? 'd' : i % 2 ? 'E' : 'e']);
        cy++;
        if (r() < 0.65) cx = Math.max(0, Math.min(f.w - 1, cx + (r() < 0.5 ? -1 : 1)));
      }
    };

    const after = decorate({ s, P, O, W, Wo, crack, map, r });
    if (opts.mirror !== false) s.mirrorLimbs();
    if (typeof after === 'function') after({ s, P, O, W, Wo, crack, map, r });

    // Dim glow: dark pixels next to a bright one pick up a dark shade of it, plus a few drifting sparks.
    const bright = c => Math.max(c[0], c[1], c[2]) >= 190;
    for (const part of PARTS) for (const f of s.faces(part)) {
      const snap = [];
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) snap.push(f.get(x, y));
      const at = (x, y) => (x < 0 || y < 0 || x >= f.w || y >= f.h ? null : snap[y * f.w + x]);
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const c = at(x, y);
        if (Math.max(c[0], c[1], c[2]) > 48) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(x + dx, y + dy)).find(v => v && bright(v));
        if (n && r() < bleed) f.set(x, y, mul(n, 0.26));
        else if (!n && r() < sparks) f.set(x, y, mul(E, 0.42));
      }
    }
    s.revealBright();
    return s;
  };
}

const HEAD = ['top', 'front', 'right', 'left', 'back'];

export default {
  style: 'accent',
  updates: [
    {
      title: 'The Infernal Court',
      note: 'The villains of the pit crown their own rulers: a king of cinders, a horned tyrant and a widow in violet flame who mourns nobody.',
      skins: [
        {
          name: 'Cinder King',
          story: 'He sits on a throne of cooling slag and wears a crown forged from the swords of every champion he burned.',
          build: villain({ seed: 101, ember: '#ff7a1a', second: '#ffc63a', extra: { R: '#3c0e0a', r: '#260806' } }, ({ P, O, W, Wo, crack }) => {
            // Face: glowing eyes under a burning brow, a beard that ends in molten drops.
            P('head', 'front', ['22222222', '21111112', '1d1111d1', '1HE11EH1', '0d0000d0', '00011000', '0d0dd0d0', '00dEEd00']);
            // The crown: three gold spikes, an ember gem on the band.
            O('head', 'front', ['F  FF  F', 'f  ff  f', 'gffEEffg', '        ', '        ', '        ', '        ', '        ']);
            O('head', 'right', [' F   F  ', ' f   f  ', 'gffgfffg']);
            O('head', 'left', flip([' F   F  ', ' f   f  ', 'gffgfffg']));
            O('head', 'back', ['F  FF  F', 'f  ff  f', 'gffggffg']);
            // Royal chest: crown sigil, gold-trimmed open robe, ash-fur collar, gold belt.
            P('body', 'front', ['33333333', '32222223', '21111112', '1F0FF0F1', '1FfFFfF1', '1gFFFFg1', '11gggg11', 'nnnffnnn', '11111111', '11111111', '1d111111', '11111111']);
            O('body', 'front', ['MLMLLMLM', 'mMmMMmMm', 'g      g', 'g      g', 'g      g', 'g      g', 'g      g', 'g  FF  g', 'g      g', 'g      g', 'g      g', 'f      f']);
            O('body', 'top', ['MLMLMLML', 'LMLMLMLM', 'MLMLMLML', 'LMLMLMLM']);
            for (const side of ['right', 'left']) O('body', side, ['MLML', 'mMmM', '    ', '    ', '    ', '    ', '    ', 'nnnn']);
            // A blood-red cape hangs from the fur collar.
            O('body', 'back', ['MLMLLMLM', 'gRRRRRRg', 'gRrRRrRg', 'gRrRRrRg', 'gRRrRRrg', 'gRrRRrRg', 'gRRRrRRg', 'gRrRRrRg', 'gRrRRRrg', 'gRRrRrRg', 'gRrRRrRg', 'g g gg g']);
            // Arms: dark sleeves, fur mantle on the shoulders, gold cuffs.
            W('rightArm', ['3333', '2222', '2112', '1111', '1111', '1111', '1111', '1111', '1111', 'gffg', '1111', '0000']);
            crack('rightArm', 'front', 4, { x: 1, y: 3 });
            Wo('rightArm', ['MLML', 'mMmM', 'm  m', '    ', '    ', '    ', '    ', '    ', 'fFFf', '    ', '    ', '    ']);
            O('rightArm', 'top', ['LMLM', 'MLML', 'LMLM', 'MLML']);
            // Legs: dark hose, gold-trimmed boots.
            W('rightLeg', ['1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', 'gffg', '2222', '1111', '0000']);
            crack('rightLeg', 'front', 3, { x: 2, y: 2 });
            Wo('rightLeg', ['    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'gffg', 'nMMn', 'nmmn', '    ']);
          })
        },
        {
          name: 'Horned Tyrant',
          story: 'The pit grew him two black horns for every arena he conquered, and the molten grin never leaves his face.',
          build: villain({ seed: 102, ember: '#ff3418', second: '#ff9a3a', tint: '#1a0e0c', metal: '#46424a', extra: { h: '#3a302a', j: '#5e5044', k: '#8c7c68' } }, ({ P, O, W, Wo, crack }) => {
            // Angry burning eyes, a jagged glowing maw.
            P('head', 'front', ['11111111', '21111112', 'd000000d', '0EH00HE0', '00d00d00', '0d0000d0', '0EdEEdE0', '00d00d00']);
            // Horns: bases at the temples, sweeping back over the sides, ember tips.
            O('head', 'front', ['kj    jk', 'hj    jh', 'h      h', '        ', '        ', '        ', '        ', '        ']);
            const horn = ['E       ', 'kj      ', ' kjj    ', '   jjjhh', '     hhh', '        ', '        ', '        '];
            O('head', 'right', horn);
            O('head', 'left', flip(horn));
            O('head', 'top', ['k      k', 'j      j', 'j      j', 'h      h', 'h      h', 'h      h', 'j      j', 'kj    jk']);
            // Chest: a molten V-crack meeting in a core, heavy plates on both sides, a belt with tassets.
            P('body', 'front', ['21111112', '1e0000e1', '10e00e01', '100EE001', '10dHHd01', '100EE001', '1000d001', '11111111', '1d111111', '11111111', '111111d1', '11111111']);
            O('body', 'front', ['mLM  MLm', ' mM  Mm ', '  m  m  ', '        ', '        ', '        ', '        ', 'nmmmmmmn', 'm nmmn m', 'm n  n m', '        ', '        ']);
            O('body', 'back', ['mLMMMMLm', ' mMMMMm ', '  mmmm  ', '        ', '        ', '        ', '        ', 'nmmmmmmn', 'm nmmn m', 'm n  n m', '        ', '        ']);
            for (const side of ['right', 'left']) O('body', side, ['mMMm', '    ', '    ', '    ', '    ', '    ', '    ', 'nmmn', 'm  m']);
            // Arms: spiked pauldrons, cracks down the forearms, iron knuckles.
            crack('rightArm', 'front', 5, { x: 1, y: 4 });
            P('rightArm', 'front', ['....', '....', '....', '....', '....', '....', '....', '....', '....', '....', 'mMMm', 'nmmn']);
            Wo('rightArm', ['MLLM', 'mMMm', ' mm ', '    ', '    ', '    ', '    ', '    ', '    ', 'nmmn', '    ', '    ']);
            O('rightArm', 'top', ['MkkM', 'kLLk', 'kLLk', 'MkkM']);
            O('rightArm', 'right', ['MkLM', 'mLkm', ' mm ']);
            // Legs: spiked knee guards and iron boots.
            crack('rightLeg', 'front', 3, { x: 1, y: 1 });
            P('rightLeg', 'front', ['....', '....', '....', '....', '....', '....', '....', '....', '....', 'nmmn', 'mMMm', 'nnnn']);
            O('rightLeg', 'front', ['    ', '    ', '    ', '    ', ' LL ', 'mMMm', ' mm ', '    ', '    ', 'nmmn', '    ', '    ']);
            for (const side of ['right', 'left', 'back']) O('rightLeg', side, ['    ', '    ', '    ', '    ', '    ', 'mmmm', '    ', '    ', '    ', 'nmmn']);
          })
        },
        {
          name: 'Ash Widow',
          slim: true,
          story: 'She wears a veil of black lace for every rival she outlived, and her violet fire burns colder than grief.',
          build: villain({ seed: 103, slim: true, ember: '#c23cff', second: '#ff4fa8', tint: '#150c16', metal: '#3c3446' }, ({ P, O, W, Wo, crack }) => {
            // Face: violet eyes, glowing tear tracks, pink lips.
            P('head', 'front', ['11111111', '11111111', '10000001', '0FE00EF0', '0d0000d0', '0e0000e0', '0d0ff0d0', '00000000']);
            // Hood with a violet brooch and a lace veil over the lower face.
            O('head', 'front', ['dddddddd', 'd 1EE1 d', '2      2', '1      1', '1 K K K1', '1K K K 1', ' K K K K', 'K K K K ']);
            const hood = ['dddddddd', '2222222d', '2212122d', '22222222', '21222122', '22222222', '2222222 ', '2 2 2 2 '];
            O('head', 'right', hood);
            O('head', 'left', flip(hood));
            O('head', 'back', ['22222222', '22g22g22', '222gg222', '2g2gg2g2', '222gg222', '22g22g22', '22222222', ' 2 22 2 ']);
            O('head', 'top', ['22222222', '22222222', '22212222', '22222222', '22222222', '22221222', '22222222', '33333333']);
            // Corset with the violet spider, a long dark skirt with a pink hem.
            P('body', 'front', ['11111111', '10000001', 'e000000e', '0e0ee0e0', '00eEEe00', 'eeeHHeee', '00eEEe00', '0e0EE0e0', 'e000000e', '11111111', '11111111', '11111111']);
            O('body', 'front', ['f      f', 'g      g', 'g      g', 'g      g', 'g      g', 'g      g', 'g      g', 'gggggggg', '21222212', '22122122', '12222221', 'gfgffgfg']);
            O('body', 'back', ['g      g', 'g      g', 'g      g', 'g      g', 'g      g', 'g      g', 'g      g', 'gggggggg', '21222212', '22122122', '12222221', 'gfgffgfg']);
            for (const side of ['right', 'left']) O('body', side, ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'gggg', '2122', '2212', '1222', 'gfgf']);
            // A spider web on the back.
            P('body', 'back', ['d00d00d0', '0d0d0d00', '00ddd000', 'dddEddd0', '00ddd000', '0d0d0d00', 'd00d00d0', '00000000', '11111111', '11111111', '11111111', '11111111']);
            // Slim arms: lace gloves from the elbow, violet bracelets.
            W('rightArm', ['1111', '1111', '1111', '1111', '1111', '1111', '0000', '0000', '0000', '0000', 'eEEe', '0000']);
            Wo('rightArm', ['    ', '    ', '    ', '    ', '    ', 'KKKK', 'K K ', ' K K', 'K K ', ' K K', '    ', '    ']);
            // Legs: the skirt goes on to the knees, then dark stockings.
            Wo('rightLeg', ['2122', '2212', 'gfgf', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ']);
            crack('rightLeg', 'front', 3, { x: 1, y: 7 });
          })
        }
      ]
    },
    {
      title: 'Chains of the Pit',
      note: 'Below the infernal court lies the prison of the pit, where a warden, an executioner and the beast they never tamed wait for new challengers.',
      skins: [
        {
          name: 'Chain Warden',
          story: 'He locked his own head in an iron cage so no prisoner could ever see him blink, and he never loses a key.',
          build: villain({ seed: 201, ember: '#ff6a1a', tint: '#16100e', metal: '#5a5660' }, ({ P, O, W, Wo, crack }) => {
            // Eyes and a glowing mouth slit behind the bars.
            P('head', 'front', ['11111111', '11111111', '0dd00dd0', '0EH00HE0', '00000000', '00000000', '0deeeed0', '00000000']);
            // The cage helm: bars at the edges and down the nose, a band at the forehead and chin.
            O('head', 'front', ['nMMMMMMn', 'M  MM  M', 'M  MM  M', 'm  mm  m', 'MMMMMMMM', 'm  mm  m', 'm  mm  m', 'nmmnnmmn']);
            const bars = ['nMMMMMMn', 'M  M  M ', 'M  M  M ', 'm  m  m ', 'MMMMMMMM', 'm  m  m ', 'm  m  m ', 'nmmnnmmn'];
            O('head', 'right', bars);
            O('head', 'left', flip(bars));
            // A padlock on the back of the cage.
            O('head', 'back', ['nMMMMMMn', 'M  mm  M', 'M mMMm M', 'm MEEM m', 'MMMddMMM', 'm mMMm m', 'm      m', 'nmmnnmmn']);
            O('head', 'top', ['nMMMMMMn', 'M  MM  M', 'M  MM  M', 'MMMMMMMM', 'MMMMMMMM', 'M  MM  M', 'M  MM  M', 'nMMMMMMn']);
            // Chest: two chains crossing at a big padlock with a glowing keyhole, a key ring at the belt.
            P('body', 'front', ['22222222', '21111112', '1d1111d1', '11111111', '11111111', '11111111', '1e1111e1', '11111111', 'nnnnnnnn', '11111111', '11111111', '11111111']);
            O('body', 'front', ['M      M', ' m    m ', '  M  M  ', '  mMMm  ', '  MEEM  ', '  mMMm  ', '  M  M  ', ' m    m ', 'MnnnnnnM', '    mMm ', '    M M ', '    mMm ']);
            O('body', 'back', ['M      M', ' m    m ', '  M  M  ', '   mm   ', '   MM   ', '   mm   ', '  M  M  ', ' m    m ', 'MnnnnnnM']);
            // Arms: iron manacles with a broken link.
            W('rightArm', ['2222', '1111', '1111', '1111', '1111', '1111', '1111', '1111', 'mMMm', 'nddn', 'mMMm', '0000']);
            crack('rightArm', 'front', 5, { x: 2, y: 1 });
            Wo('rightArm', ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'nmmn', 'MLLM', '    ', 'MLLM', ' mm ']);
            O('rightArm', 'top', ['mMMm', 'M  M', 'M  M', 'mMMm']);
            // Legs: shackles at the ankles.
            W('rightLeg', ['1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', 'mMMm', 'nmmn', '0000']);
            crack('rightLeg', 'front', 3, { x: 1, y: 2 });
            Wo('rightLeg', ['    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'MLLM', '    ', 'MmmM', '    ']);
          })
        },
        {
          name: 'Brimstone Executioner',
          story: 'Nobody has seen the face under his hood, only the sulfur light in his eyes and the burning axe scar on his back.',
          build: villain({ seed: 202, ember: '#ffae1a', second: '#ff5a10', tint: '#1a110c', metal: '#4e4a52', extra: { q: '#170e0a', Q: '#241610', w: '#0c0605' } }, ({ P, O, W, Wo, crack }) => {
            P('head', 'front', ['11111111', '11111111', '1d0dd0d1', '0EH00HE0', '0d0000d0', '00000000', '00000000', '00000000']);
            // The executioner's hood: closed everywhere, two eye holes.
            O('head', 'front', ['QQQQQQQQ', 'QqqqqqqQ', 'qq qq qq', 'q  qq  q', 'qqqqqqqq', 'qqqqqqqq', 'wqqqqqqw', 'wwwwwwww']);
            const side = ['QQQQQQQQ', 'qqqqqqqQ', 'qqqqqqqq', 'qqqqqqqq', 'qqqqqqqq', 'qqqqqqqq', 'wqqqqqqw', 'wwwwwwww'];
            O('head', 'right', side);
            O('head', 'left', flip(side));
            O('head', 'back', ['QQQQQQQQ', 'qqqqqqqq', 'qqqqqqqq', 'qqqqqqqq', 'qqqqqqqq', 'qqqqqqqq', 'wqqqqqqw', 'wwwwwwww']);
            O('head', 'top', ['qqqqqqqq', 'qqqQQqqq', 'qqqQQqqq', 'qqqQQqqq', 'qqqQQqqq', 'qqqQQqqq', 'qqqQQqqq', 'QQQQQQQQ']);
            // Bare charred chest, cracked open around a burning brimstone heart; a strap and a wide belt.
            P('body', 'front', ['22222222', '21e11112', '110e1d11', '1d0eE011', '10eHHe01', '110EEd01', '1d0e00e1', '1e0d0010', 'wwwwwwww', '11111111', '11111111', '11111111']);
            O('body', 'front', ['Qq      ', ' qQ     ', '  qQ    ', '        ', '        ', '        ', '        ', '      Qq', 'wqqMMqqw', 'wqqEMqqw', '        ', '        ']);
            // The burning axe on the back.
            P('body', 'back', ['00000000', '0EmmM000', 'EmmmM000', 'EmmmM000', '0EmmM000', '0000n000', '0000n000', '0000n000', 'wwwwnwww', '0000n000', '00000000', '00000000']);
            O('body', 'back', ['      qQ', '     Qq ', '    Qq  ', '   Qq   ', '  Qq    ', ' Qq     ', 'Qq      ', 'q       ', 'wqqqqqqw', 'wqqqqqqw']);
            for (const s of ['right', 'left']) O('body', s, ['    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'wqqw', 'wqqw']);
            // Bare arms with cracks, leather bracers and gloves.
            crack('rightArm', 'front', 4, { x: 1, y: 1 });
            crack('rightArm', 'right', 3, { x: 2, y: 2 });
            W('rightArm', ['....', '....', '....', '....', '....', '....', 'qQQq', 'qqqq', 'qQQq', 'wwww', 'wwww', 'wwww']);
            Wo('rightArm', ['    ', '    ', '    ', '    ', '    ', 'wqqw', 'QddQ', 'qqqq', 'QqqQ', '    ', '    ', '    ']);
            // Legs: dark trousers, heavy boots.
            W('rightLeg', ['1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', 'wqqw', 'qqqq', 'qQQq', 'wwww']);
            Wo('rightLeg', ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'QqqQ', 'q  q', '    ', '    ', '    ']);
            crack('rightLeg', 'front', 3, { x: 1, y: 2 });
          })
        },
        {
          name: 'Shackled Beast',
          story: 'The pit kept it chained for a hundred years, and the day it broke free it kept the shackles as trophies.',
          build: villain({ seed: 203, bleed: 0.2, ember: '#ff2a1e', second: '#ffcc40', tint: '#170c0a', metal: '#55505a', extra: { u: '#3a2418', U: '#5c3a26', b: '#9a8c76' } }, ({ P, O, W, Wo, crack }) => {
            // Slanted burning eyes, a glowing maw.
            P('head', 'front', ['11111111', '21111112', '1d1111d1', '0EH00HE0', '00d00d00', '00000000', '00000000', '0eEEEEe0']);
            // Ears on top, a snout with fangs.
            O('head', 'front', ['UU    UU', 'uU    Uu', 'u      u', 'u      u', 'U      U', 'uuUUUUuu', 'u uKKu u', ' b    b ']);
            const ear = ['     uUu', '      uU', '      u ', '        ', '        ', 'u u     ', ' u u    ', 'u u u   '];
            O('head', 'right', ear);
            O('head', 'left', flip(ear));
            O('head', 'top', ['        ', '        ', '        ', '        ', 'u      u', 'U      U', 'Uu    uU', 'UU    UU']);
            O('head', 'back', ['        ', '   uu   ', '  uUUu  ', '   uu   ', '  uUUu  ', '   uu   ', ' u uu u ', 'u u  u u']);
            // Chest: three glowing claw slashes, an iron collar with a torn chain.
            P('body', 'front', ['22222222', 'd11d11d1', 'e11e11e1', 'E11E11E1', '1E11E11E', '1e11e11e', '1d11d11d', '11111111', '11d11111', '11111111', '11111111', '11111111']);
            O('body', 'front', ['MLMMMMLM', '   mM   ', '    m   ', '        ', '        ', '        ', '        ', 'u u  u u', '        ', '        ', '        ', '        ']);
            // Spine ridge on the back.
            P('body', 'back', ['00011000', '000dd000', '000EE000', '000dd000', '000EE000', '000dd000', '000EE000', '000dd000', '000ee000', '00000000', '00000000', '00000000']);
            O('body', 'back', ['MMMMMMMM', '  U  U  ', '        ', '  U  U  ', '        ', '  U  U  ', '        ', '  u  u  ']);
            for (const side of ['right', 'left']) O('body', side, ['MMMM']);
            // Arms: fur on the shoulders, broken shackles, bone claws.
            W('rightArm', ['2222', '1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', 'b0b0']);
            crack('rightArm', 'front', 4, { x: 1, y: 3 });
            Wo('rightArm', ['uUuU', 'u u ', ' u u', '    ', '    ', '    ', '    ', '    ', 'MLLM', 'mmmm', '    ', '    ']);
            O('rightArm', 'top', ['uUuU', 'UuUu', 'uUuU', 'UuUu']);
            // Legs: shaggy fur trousers, clawed feet.
            W('rightLeg', ['1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', '1111', 'b0b0']);
            Wo('rightLeg', ['    ', '    ', '    ', '    ', '    ', 'u u ', ' u u', 'uUuU', '    ', '    ', '    ', '    ']);
            crack('rightLeg', 'front', 3, { x: 2, y: 1 });
            // After mirroring: a torn chain link hangs from the right wrist only.
            return ({ O }) => O('rightArm', 'front', ['....', '....', '....', '....', '....', '....', '....', '....', '....', '....', '  m ', '  M ']);
          })
        }
      ]
    },
    {
      title: 'The Black Eclipse',
      note: 'When the sun goes dark over the battlefield, the oldest villains rise: a prophet of the eclipse, a revenant of cold soulfire and an obsidian juggernaut.',
      skins: [
        {
          name: 'Eclipse Prophet',
          story: 'He wears the dead sun on his brow and reads the end of every duel in the runes that burn down his robe.',
          build: villain({ seed: 301, ember: '#ff7010', second: '#ffe39a', tint: '#120c10', extra: { v: '#1e1218', V: '#2c1a24', z: '#0c070a' } }, ({ P, O, W, Wo }) => {
            // A face in deep shadow, two white-hot pin eyes.
            P('head', 'front', ['zzzzzzzz', 'zzzzzzzz', 'zzzzzzzz', '0z0000z0', '0F0000F0', '00000000', '00000000', '00000000']);
            // Hood with the eclipse on the brow: a black sun in a ring of fire.
            O('head', 'front', ['vzeEEezv', 'vEKKKKEv', 'vzeEEezv', 'v      v', 'v      v', 'V      V', '        ', '        ']);
            const hood = ['VVVVVVVV', 'vvvvvvvV', 'vvvvvvvV', 'vvvvvvvV', 'vvvvvvvV', 'vvvvvvvV', 'vvvvvvV ', ' vvvvV  '];
            O('head', 'right', hood);
            O('head', 'left', flip(hood));
            O('head', 'back', ['VVVVVVVV', 'vvvvvvvv', 'vvvEEvvv', 'vveKKevv', 'vvvEEvvv', 'vvvvvvvv', 'vvvvvvvv', ' vvvvvv ']);
            O('head', 'top', ['vvvvvvvv', 'vvvvvvvv', 'vvvvvvvv', 'vvvvvvvv', 'vvvvvvvv', 'vvvvvvvv', 'vvvvvvvv', 'VVVVVVVV']);
            // Robe with a column of burning runes, a pale-gold sash.
            P('body', 'front', ['vVzzzzVv', 'vVzEdzVv', 'vVzdEzVv', 'vVzzzzVv', 'vVzEEzVv', 'vVzdzzVv', 'vVzzzzVv', 'ffffffff', 'vVzEzEVv', 'vVzzEzVv', 'vVzEzEVv', 'vVzzzzVv']);
            P('body', 'back', ['vvvvvvvv', 'vvvvvvvv', 'vvvEEvvv', 'vveKKevv', 'vvvEEvvv', 'vvvvvvvv', 'vvvvvvvv', 'ffffffff', 'vvvvvvvv', 'vvvvvvvv', 'vvvvvvvv', 'vvvvvvvv']);
            for (const side of ['right', 'left']) P('body', side, ['vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'ffff', 'vvvv', 'vvvv', 'vvvv', 'vvvv']);
            O('body', 'front', ['V      V', 'V      V', 'V      V', 'V      V', 'V      V', 'V      V', 'V      V', 'gFgggggg', 'V      V', 'V    g V', 'V    g V', 'V      V']);
            O('body', 'top', ['VVVVVVVV', 'vvvvvvvv', 'vvvvvvvv', 'VVVVVVVV']);
            // Wide sleeves, glowing palms.
            W('rightArm', ['vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'zzzz', '0000', 'dddd', 'eEEe']);
            P('rightArm', 'bottom', ['EeeE', 'eHHe', 'eHHe', 'EeeE']);
            Wo('rightArm', ['VVVV', '    ', '    ', '    ', '    ', '    ', 'vvvv', 'vvvv', 'vvvv', 'VVVV', '    ', '    ']);
            // The robe reaches the ankles with a rune hem.
            W('rightLeg', ['vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'vvvv', 'zzzz', 'dEzE', 'zzzz', '0000']);
            Wo('rightLeg', ['    ', '    ', '    ', '    ', '    ', '    ', '    ', 'VVVV', '    ', '    ', '    ', '    ']);
          })
        },
        {
          name: 'Soulfire Revenant',
          story: 'Even the pit could not keep him dead; now cold blue soulfire burns where his heart and eyes used to be.',
          build: villain({ seed: 302, ember: '#38d4ff', second: '#c0f4ff', tint: '#0e1016', metal: '#3a3e48', extra: { b: '#6c6658', B: '#958c7a', c: '#46413a', x: '#171920', X: '#242833' } }, ({ P, O, W, Wo, crack }) => {
            // Skull with soulfire in the sockets.
            P('head', 'front', ['cbbbbbbc', 'bBBBBBBb', 'b00BB00b', 'b0EBBE0b', 'bBBccBBb', 'cbb00bbc', 'cBcBBcBc', '0cbbbbc0']);
            // Tattered hood.
            O('head', 'front', ['XXXXXXXX', 'xX    Xx', 'x      x', 'x      x', 'x       ', 'x       ', '        ', '        ']);
            const hood = ['XXXXXXXX', 'xxxxxxxx', 'xxXxxxxx', 'xxxxxxxx', 'xxxxXxxx', 'xxxxxxx ', 'x xxx x ', 'x  x    '];
            O('head', 'right', hood);
            O('head', 'left', flip(hood));
            O('head', 'back', ['XXXXXXXX', 'xxxxxxxx', 'xxxxxxxx', 'xxxxXxxx', 'xxxxxxxx', 'xxxxxxxx', 'x xxx xx', 'x  x  x ']);
            O('head', 'top', ['xxxxxxxx', 'xxxxxxxx', 'xxxXxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxXxxx', 'xxxxxxxx', 'XXXXXXXX']);
            // Ribcage with a soulfire heart, the cloak hanging open on both sides.
            P('body', 'front', ['000BB000', '0bbBBbb0', '0000B000', 'bbb0HEb0', '000eEe00', '0bbBdbb0', '0000B000', '00bBBb00', '00000000', '0d0000d0', '00000000', '00000000']);
            O('body', 'front', ['XX    XX', 'xX    Xx', 'x      x', 'xx    xx', 'x      x', 'x      x', 'xx    xx', 'x      x', 'x      x', 'xx    x ', 'x     x ', ' x     x']);
            O('body', 'back', ['XXXXXXXX', 'xxxxxxxx', 'xxxXxxxx', 'xxxxxxxx', 'xxxxxXxx', 'xxxxxxxx', 'xxXxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xx xxx x', 'x  x x  ', 'x     x ']);
            for (const side of ['right', 'left']) O('body', side, ['XXXX', 'xxxx', 'xxxx', 'xxxx', 'xxxx', 'xxxx', 'xxxx', 'xxxx', 'x xx', ' x x', 'x   ']);
            // Arms: cloak to the elbow, bony forearms, soulfire at the wrists.
            W('rightArm', ['xxxx', 'xxxx', 'xxxx', 'xxxx', 'xxxx', '0000', '0b0B', '0b0B', '0b0B', 'eEEe', 'BbBb', 'cbcb']);
            Wo('rightArm', ['XXXX', 'xxxx', 'x xx', 'x  x', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ']);
            O('rightArm', 'top', ['XXXX', 'xxxx', 'xxxx', 'XXXX']);
            // Legs: dark wraps, bone feet.
            W('rightLeg', ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', 'cbbc', 'BbbB']);
            crack('rightLeg', 'front', 3, { x: 1, y: 3 });
            Wo('rightLeg', ['x x ', ' x x', 'x   ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ']);
          })
        },
        {
          name: 'Obsidian Juggernaut',
          story: 'Forged out of a cooled lava flow, he walks through arrows and fireballs alike, and the magma inside him never sets.',
          build: villain({ seed: 303, ember: '#ff4a10', second: '#ffaa30', tint: '#120c10', metal: '#3c3248', extra: { o: '#141019', O: '#221a2c', p: '#3a2e4a' } }, ({ P, O, W, Wo }) => {
            // T-visor glowing out of the full helm.
            P('head', 'front', ['00000000', '00000000', '00000000', '0dEHHEd0', '000ee000', '000dd000', '00000000', '00000000']);
            O('head', 'front', ['OppppppO', 'OooooooO', 'oooooooo', 'o      o', 'ooo  ooo', 'ooo  ooo', 'OooooooO', 'OOOOOOOO']);
            const helm = ['pppppppO', 'oooooooO', 'oOooooOo', 'oooooooo', 'oooFoooo', 'oooooooo', 'oOooooOo', 'OOOOOOOO'];
            O('head', 'right', helm);
            O('head', 'left', flip(helm));
            O('head', 'back', ['OppppppO', 'oooooooo', 'ooodoooo', 'oooooooo', 'ooooodoo', 'oooooooo', 'oooooooo', 'OOOOOOOO']);
            O('head', 'top', ['ooopoooo', 'ooopoooo', 'ooopoooo', 'ooopoooo', 'ooopoooo', 'ooopoooo', 'ooopoooo', 'OOOpOOOO']);
            // Obsidian chest plates split by magma seams.
            P('body', 'front', ['OppppppO', 'OoooEooO', 'OoooeooO', 'ooodEooo', 'eEdeedEe', 'oooodooo', 'OooodooO', 'OooodooO', 'nnndEnnn', 'oooodooo', 'ooooeooo', 'OooodooO']);
            P('body', 'back', ['OppppppO', 'oooooooo', 'oooooooo', 'ooodEooo', 'eEdeedEe', 'ooodoooo', 'oooooooo', 'oooooooo', 'nnnnnnnn', 'oooooooo', 'oooooooo', 'OooooooO']);
            for (const side of ['right', 'left']) P('body', side, ['oooo', 'oooo', 'oOoo', 'oooo', 'deed', 'oooo', 'oooo', 'ooOo', 'nnnn', 'oooo', 'oooo', 'oooo']);
            // Massive stacked pauldrons, magma at the elbow, heavy gauntlets.
            W('rightArm', ['oooo', 'oooo', 'oooo', 'oooo', 'oooo', 'dEEd', 'oooo', 'oOoo', 'oooo', 'pppp', 'oOOo', 'oooo']);
            Wo('rightArm', ['pppp', 'OOOO', 'oooo', 'pppp', 'OOOO', '    ', '    ', '    ', '    ', 'pppp', '    ', '    ']);
            O('rightArm', 'top', ['pppp', 'pOOp', 'pOOp', 'pppp']);
            // Legs: greaves with magma at the knee.
            W('rightLeg', ['oooo', 'oooo', 'oOoo', 'oooo', 'oooo', 'dEEd', 'oooo', 'oooo', 'ooOo', 'oooo', 'pppp', 'OOOO']);
            Wo('rightLeg', ['    ', '    ', '    ', '    ', 'pppp', '    ', 'pppp', '    ', '    ', '    ', 'pppp', '    ']);
          })
        }
      ]
    }
  ]
};
