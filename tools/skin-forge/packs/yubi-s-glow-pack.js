// Yubi's Glow Pack — glow pack. Existing: Phantom Cyan, Voltage Pink, Sentinel Orange (minimal armor),
// KitsuneGold, StormRonin, VoidWraith, NeonShogun, CursedMarionette (the classic ninja concepts, also in
// The Last Ninjas). New skins leave the ninja world: city, wild creatures and space, each with its own
// head shape painted by hand (headphones, hood, monitor, antennae, lure, antlers, ring, helmet).

import { glowBleed } from '../glow.js';

// glow() without bleed, then our own details, then the soft glow over everything (so the hand-painted
// details glow too) and revealBright (black overlay never hides neon).
// Paint map: K/0 black, 1–7 neon ramp, a–g second ramp (a = 1 … g = 7), W white; '.' keeps, ' ' clears.
function forge(opts, decorate) {
  return ({ glow, color }) => {
    const s = glow({ ...opts, bleed: 0, sparkle: 0 });
    const R = color.neonRamp(opts.neon), R2 = color.neonRamp(opts.neon2 || opts.neon);
    const map = { K: color.BLACK, 0: color.BLACK, W: color.WHITE };
    for (let i = 1; i <= 7; i++) { map[i] = R[i]; map['abcdefg'[i - 1]] = R2[i]; }
    const P = (part, face, rows, { layer = 'inner', x = 0, y = 0 } = {}) => s.face(part, face, layer).paint(rows, map, { x, y });
    const O = (part, face, rows, at = {}) => P(part, face, rows, { ...at, layer: 'outer' });
    const clear = (part, ...faces) => faces.forEach(f => s.face(part, f, 'outer').clear());
    const flip = rows => rows.map(r => [...r].reverse().join(''));
    decorate({ s, P, O, clear, flip });
    glowBleed(s, R, { bleed: opts.bleed ?? 0.55, sparkle: opts.sparkle ?? 0.025, seed: opts.seed });
    s.revealBright();
    return s;
  };
}

const HEAD = ['top', 'front', 'right', 'left', 'back'];

export default {
  style: 'glow',
  updates: [
    {
      title: 'Circuit City',
      note: "Yubi's glow spills into the city at night: a DJ whose headphones never go quiet, a hacker who reads the wires like a book and a droid with a smile on its screen.",
      skins: [
        {
          name: 'Bass Pulse',
          story: "She plays the last club in the city every night, and the cyan beat in her headphones keeps the whole district's lights pulsing.",
          build: forge({ neon: '#ff2bd6', neon2: '#00e5ff', archetype: 'armor', body: 'plates', arms: 'rings', legs: 'joints', back: 'sigil', seed: 41 }, ({ P, O, clear }) => {
            // Glasses: magenta frame, cyan lenses.
            P('head', 'front', ['00000000', '00000000', '00000000', '07700770', '0gg77gg0', '00000000', '00000000', '00000000']);
            clear('head', ...HEAD);
            // Headphones: band over the top, glowing ear cups on both sides.
            O('head', 'top', ['        ', '        ', '        ', 'KKKKKKKK', 'KKKKKKKK', '        ', '        ', '        ']);
            for (const side of ['right', 'left']) O('head', side, ['   KK   ', '   KK   ', '  KKKK  ', ' KK77KK ', ' K7gg7K ', ' K7gg7K ', ' KK77KK ', '  KKKK  ']);
            O('head', 'front', ['K      K', '        ', '        ', '        ', '        ', '        ', '        ', '        ']);
            // Equalizer on the chest.
            P('body', 'front', ['00000000', '00000000', '00000000', '0000g000', '00g07000', '00707g00', '0g707700', '077g7700', '077777g0', '07777770', '00000000', '0cccccc0']);
            O('body', 'front', ['KKKKKKKK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK', '        ']);
          })
        },
        {
          name: 'Circuit Hacker',
          story: 'He hides under a lime-lit hood and draws a new circuit on his own chest every time he breaks into a system.',
          build: forge({ neon: '#9dff2e', neon2: '#f0ffd0', archetype: 'headband', body: 'plates', arms: 'edge', legs: 'stripes', back: 'banner', seed: 42 }, ({ P, O, clear }) => {
            // Shadowed face: a HUD monocle on one eye.
            P('head', 'front', ['00000000', '00000000', '00000000', '05550000', '57750770', '05550000', '00000000', '00000000']);
            clear('head', ...HEAD);
            // The hood: glowing rim, closed sides and back, a collar under the chin.
            O('head', 'front', ['K666666K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KK    KK', 'KKK  KKK']);
            for (const side of ['right', 'left']) O('head', side, ['6KKKKKK6', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KK    KK']);
            O('head', 'top', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', '66666666']);
            O('head', 'back', ['66666666', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKK66KKK', 'KKKKKKKK', ' KKKKKK ']);
            // Circuit board on the chest: traces, nodes, two chips.
            P('body', 'front', ['00000000', '0g777000', '00007000', '0dd07770', '0dd0000g', '00700000', '00777g00', '00000700', '0g777700', '07000000', '07000dd0', '0g000dd0']);
            O('body', 'front', [' K    K ', '  K  K  ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK']);
          })
        },
        {
          name: 'Screen Droid',
          story: 'An old city patrol droid whose blue screen face still smiles at everyone, powered by the hex reactor humming in its chest.',
          build: forge({ neon: '#4a6bff', neon2: '#e6ecff', archetype: 'armor', body: 'circles', arms: 'joints', legs: 'plates', back: 'spine', seed: 43 }, ({ P, O, clear }) => {
            // Monitor face: happy pixel eyes and a smile.
            P('head', 'front', ['00000000', '000000e0', '00700700', '07077070', '00000000', '07000070', '00777700', '00000000']);
            clear('head', ...HEAD);
            // The monitor case: thick frame, power LED, side bolts, vents on the back, a small antenna on top.
            O('head', 'front', ['KKKKKKKK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KKKKK7KK']);
            for (const side of ['right', 'left']) O('head', side, ['KKKKKKKK', 'K      K', 'K      K', 'K  77  K', 'K  77  K', 'K      K', 'K      K', 'KKKKKKKK']);
            O('head', 'back', ['KKKKKKKK', 'K      K', 'K KKKK K', 'K      K', 'K KKKK K', 'K      K', 'K KKKK K', 'KKKKKKKK']);
            O('head', 'top', ['KKKKKKKK', 'K g  g K', 'K  KK  K', 'K  KK  K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK']);
            // Hex reactor core.
            P('body', 'front', ['00000000', '00000000', '00777700', '07cccc70', '7ccggcc7', '7ccggcc7', '07cccc70', '00777700', '00000000', '03333330', '00000000', '07000070']);
            O('body', 'front', ['K      K', 'K      K', '        ', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK', 'K      K', 'KKKKKKKK']);
          })
        }
      ]
    },
    {
      title: 'Glowing Wilds',
      note: 'Far from the city lights, the wild things glow on their own: a moth queen, a hunter from the deep sea and the warden of the old forest.',
      skins: [
        {
          name: 'Moth Queen',
          slim: true,
          story: 'She rules the night sky over the marshes, and every lamp in the world pulls at her violet wings.',
          build: forge({ neon: '#c77dff', neon2: '#ffe08a', archetype: 'creature', body: 'diagonal', arms: 'diagonal', legs: 'edge', back: 'banner', seed: 51, slim: true }, ({ s, P, O }) => {
            // Big round moth eyes and a tiny golden mouth.
            P('head', 'front', ['00000000', '00000000', '00000000', '06600660', '67700776', '06600660', '00000000', '000dd000']);
            // Feathered antennae on top, starting at the forehead.
            O('head', 'top', ['g      g', 'gK    Kg', ' K    K ', 'g K  K g', '  K  K  ', ' g KK g ', '   KK   ', '   KK   ']);
            O('head', 'front', ['g..KK..g', '.K....K.', '..K..K..']);
            // Fluffy golden collar.
            O('body', 'front', ['eKeKKeKe', ' eKeeKe ']);
            // Segmented moth abdomen between the wing edges.
            P('body', 'front', ['70000007', '07000070', '00777700', '00700700', '00777700', '00700700', '00777700', '00077000', '00000000', '00000000', '00000000', '00000000']);
            // Wings with eye spots on the back.
            P('body', 'back', ['70000007', '07000070', '07700770', '7ff77ff7', '7ff77ff7', '07700770', '00000000', '07000070', '00700700', '00077000', '00000000', '00000000']);
            // A wing eye spot on each arm.
            P('rightArm', 'front', ['.7.', '7f7', '.7.'], { y: 1 });
            s.mirrorLimbs();
          })
        },
        {
          name: 'Deep Angler',
          story: 'It hunts in the darkest trench of the ocean, where its golden lure is the only light anyone ever follows.',
          build: forge({ neon: '#1ec8ff', neon2: '#ffe14a', archetype: 'creature', body: 'constellation', arms: 'joints', legs: 'edge', back: 'spine', seed: 52 }, ({ P, O, clear }) => {
            // Small eyes, a jaw full of jagged teeth.
            P('head', 'front', ['00000000', '00000000', '00000000', '07000070', '00000000', '73737373', '00000000', '37373737']);
            clear('head', 'top', 'front', 'right', 'left');
            // The lure: a stalk over the head ending in a golden bulb in front of the forehead.
            O('head', 'top', ['        ', '        ', '        ', '   K    ', '   K    ', '   K    ', '   K    ', '   K    ']);
            O('head', 'front', ['  KK    ', '   Kgg  ', '    gg  ', '        ', 'K      K', 'K      K', 'K      K', 'KK    KK']);
            // Gill fins on the sides.
            for (const side of ['right', 'left']) O('head', side, ['        ', '        ', '  K7K7K ', '  K7K7K ', '  KKKKK ', '   KKK  ', '        ', '        ']);
            O('body', 'back', ['...KK...', '..K77K..', '...KK...', '..K77K..', '...KK...', '..K77K..', '...KK...', '...KK...', '........', '........', '........', '........']);
            O('head', 'back', ['...KK...', '..KKKK..', '...KK...']);
            // Photophores along the sides and a lantern heart.
            P('body', 'front', ['00000000', '70000007', '00000000', '07000070', '000dd000', '70dggd07', '00dggd00', '070dd070', '00000000', '70000007', '00000000', '07777770']);
          })
        },
        {
          name: 'Antler Warden',
          story: 'A forest spirit in a bone mask who carries the glowing tree of the old woods on his chest wherever he walks.',
          build: forge({ neon: '#2bff7a', neon2: '#f4efe0', archetype: 'armor', body: 'plates', arms: 'edge', legs: 'joints', back: 'sigil', seed: 53 }, ({ P, O, clear }) => {
            // Deer skull mask with green eyes.
            P('head', 'front', ['00000000', '0gffffg0', 'gf7ff7fg', '0f7ff7f0', '00ffff00', '00eeee00', '000ee000', '000dd000']);
            clear('head', ...HEAD);
            // Bone antlers branching back over the head.
            O('head', 'top', ['g      g', 'd g  g d', ' d    d ', 'gd    dg', ' d    d ', '  d  d  ', '  d  d  ', '        ']);
            O('head', 'front', [' gd  dg ', '  d  d  ', '        ', '        ', '        ', '        ', '        ', 'K      K']);
            for (const side of ['right', 'left']) O('head', side, ['d g  g d', 'dddddddd', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK']);
            O('head', 'back', ['dddddddd', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK']);
            // The tree of the old woods.
            P('body', 'front', ['07000070', '00700700', '70077007', '07077070', '00777700', '00077000', '00077000', '00077000', '00777700', '07077070', '70000007', '00000000']);
          })
        }
      ]
    },
    {
      title: 'Signals from Orbit',
      note: 'Strange signals reach the ground from far above: a keeper of the planets, a broken broadcast that learned to walk and a diver who fell from the stars.',
      skins: [
        {
          name: 'Orbit Keeper',
          story: 'He winds the paths of the planets every night, and a golden ring still circles his head from the last one he tamed.',
          build: forge({ neon: '#ffd23a', neon2: '#a77bff', archetype: 'armor', body: 'plates', arms: 'joints', legs: 'stripes', back: 'sigil', seed: 61 }, ({ P, O, clear }) => {
            // Star eyes.
            P('head', 'front', ['00000000', '00000000', '07000070', '77700777', '07000070', '00000000', '00000000', '00000000']);
            clear('head', ...HEAD);
            // A tilted planet ring around the head (low at the front, high at the back), with a violet moon.
            O('head', 'front', ['        ', '        ', '        ', '        ', '        ', '        ', '777g7777', '        ']);
            O('head', 'right', ['        ', '        ', '77      ', '  7     ', '   77   ', '     7  ', '      77', '        ']);
            O('head', 'left', ['        ', '        ', '      77', '     7  ', '   77   ', '  7     ', '77      ', '        ']);
            O('head', 'back', ['KKKKKKKK', 'K      K', '77777777', '        ', '        ', '        ', '        ', '        ']);
            O('head', 'front', ['KKKKKKKK', 'K......K']);
            for (const side of ['right', 'left']) O('head', side, ['KKKKKKKK', 'K......K']);
            O('head', 'top', [' KKKKKK ', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', ' KKKKKK ']);
            // A sun with its orbit and two planets.
            P('body', 'front', ['00000000', '00000000', '00555500', '0500005g', '50077005', '50077005', 'e5000050', '00555500', '00000000', '00000000', '05555550', '00000000']);
            O('body', 'front', ['KK    KK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK', 'K      K', 'K      K', 'K      K', 'KKKKKKKK']);
          })
        },
        {
          name: 'Static Glitch',
          story: 'Born from a corrupted satellite signal, it flickers between red and cyan and never stands in one place for long.',
          build: forge({ neon: '#ff2a3c', neon2: '#00f0ff', archetype: 'cracked', body: 'zigzag', arms: 'rings', legs: 'plates', back: 'same', seed: 62 }, ({ P, O }) => {
            // Doubled eyes: red, with a cyan copy shifted off the grid.
            P('head', 'front', ['00000000', 'ggg00000', '00000000', '07700770', '00gg00gg', '00000000', '00007777', '00000000']);
            // Dead pixels stuck on the outside.
            O('head', 'right', ['        ', '        ', '        ', '        ', '        ', '  77    ', '        ', '        ']);
            O('head', 'left', ['        ', '        ', '    gg  ', '        ', '        ', '        ', '        ', '        ']);
            O('head', 'top', ['.KK..KKK', '........', 'KKK..K..', '......KK', '.K......', '....KKK.', 'KK......', '...KK...']);
            O('body', 'front', ['KK.....K', '......KK', '.K......', '........', '.....K..', '........', 'K.......', '........', '..KK....', '........', '.......K', 'KKK.....']);
            // Torn scan lines.
            P('body', 'front', ['00000000', '07777000', '00gggg00', '00000000', '00000777', '000ggg00', '77700000', '0ggg0000', '00000000', '00777770', '000ggggg', '00000000']);
            P('body', 'back', ['00000000', '00007770', '000gggg0', '00000000', '77700000', '0ggg0000', '00000777', '0000ggg0', '00000000', '07777700', 'ggggg000', '00000000']);
            // The left side broadcasts in cyan.
            P('leftArm', 'front', ['0000', 'gg00', '0000', '00gg', '0000', '0ggg', '0000', 'g000', '0000', '00gg', '0000', 'gggg']);
            P('leftLeg', 'front', ['0000', '0000', 'gg00', '0000', '0000', '00gg', '0000', '0000', '0ggg', '0000', '0000', 'gggg']);
          })
        },
        {
          name: 'Star Diver',
          story: 'Her capsule crashed in the night, but the coral lights of her helmet still glow, calling home through the dark.',
          build: forge({ neon: '#ff6a3d', neon2: '#fff4e8', archetype: 'armor', body: 'plates', arms: 'rings', legs: 'plates', back: 'banner', seed: 63 }, ({ P, O, clear }) => {
            // Helmet visor: dark glass with a white glare and the reflection of a burning sunset.
            P('head', 'front', ['00000000', '00666600', '06g00060', '6g000006', '60000006', '60000006', '06777760', '00666600']);
            clear('head', ...HEAD);
            // Round helmet shell with side lamps.
            O('head', 'front', ['KK    KK', 'K      K', '        ', '        ', '        ', '        ', 'K      K', 'KK    KK']);
            for (const side of ['right', 'left']) O('head', side, [' KKKKKK ', 'K      K', 'K      K', 'K  7   K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK']);
            O('head', 'top', [' KKKKKK ', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', ' KKKKKK ']);
            O('head', 'back', ['KKKKKKKK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK']);
            // Mission star on the chest.
            P('body', 'front', ['00000000', '00000000', '00077000', '077gg770', '00777700', '00700700', '00000000', '00000000', '00000000', '00000000', '07777770', '00000000']);
            // Oxygen pack on the back.
            O('body', 'back', ['        ', ' KKKKKK ', ' K7KK7K ', ' KKKKKK ', ' KKKKKK ', ' KgKKgK ', ' KKKKKK ', ' KKKKKK ', ' KKKKKK ', ' KKKKKK ', '        ', '        ']);
          })
        }
      ]
    }
  ]
};
