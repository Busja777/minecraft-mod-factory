// Glowing Samurai (Samurai Saga) — glow pack. Existing chapters: Three Realms (RAIJIN, ONI-KAI, MUGEN),
// Four Fallen Generals, Celestial Guardians, Evolution Arc (sealed/ascended), The Outliers (KAGAMI, JIKOKU …).
// All of them share one hand-made template: pitch-black armour, a black overlay of plate seams, the glow in
// eyes, chest, glowing gauntlet frames at the hands and shin squares. Single neon colour each.
//
// glow() does not draw that template, so the pack has its own builder: samurai(opts, paint).
// Each new samurai keeps the material (black plates, glowing hands and shins) but gets its own helmet,
// face, chest, gauntlets and greaves, and two neon colours (the old ones use one).
// Paint map: K/0 black, 1–7 neon ramp, a–g second ramp (a = 1 … g = 7); '.' keeps, ' ' clears.

import { glowBleed } from '../glow.js';

const PARTS = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
const FACES = ['top', 'bottom', 'right', 'front', 'left', 'back'];

function samurai(opts, paint) {
  return ({ Skin, color }) => {
    const s = new Skin({ slim: false });
    const R = color.neonRamp(opts.neon), R2 = color.neonRamp(opts.neon2 || opts.neon);
    const map = { K: color.BLACK, 0: color.BLACK };
    for (let i = 1; i <= 7; i++) { map[i] = R[i]; map['abcdefg'[i - 1]] = R2[i]; }
    for (const part of PARTS) for (const f of FACES) s.face(part, f).fill(color.BLACK);
    const P = (part, face, rows, { layer = 'inner', x = 0, y = 0 } = {}) => {
      const f = s.face(part, face, layer);
      rows.forEach((r, i) => { if (r.length !== f.w) throw new Error(`${part}.${face}.${layer} row ${i} is ${r.length} wide, want ${f.w}`); });
      f.paint(rows, map, { x, y });
    };
    const O = (part, face, rows, at = {}) => P(part, face, rows, { ...at, layer: 'outer' });
    const flip = rows => rows.map(r => [...r].reverse().join(''));

    // The pack's base: shoulder seam on the body top, side seams, ring seams on the limb sides.
    O('body', 'top', ['KKKKKKKK', '        ', '        ', '        ']);
    for (const side of ['right', 'left']) O('body', side, [' KK ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ']);
    const ring = ['KKKK', '    ', '    ', '    ', 'KKKK', '    ', '    ', '    ', 'KKKK', '    ', '    ', 'KKKK'];
    for (const side of ['right', 'left', 'back']) O('rightArm', side, ring);
    const greave = ['KKKK', '    ', '    ', '    ', 'KKKK', '    ', 'KKKK', '    ', '    ', '    ', 'KKKK', 'KKKK'];
    for (const side of ['right', 'left', 'back']) O('rightLeg', side, greave);

    paint({ s, P, O, flip });
    s.mirrorLimbs();
    glowBleed(s, R, { bleed: opts.bleed ?? 0.45, sparkle: opts.sparkle ?? 0.01, seed: opts.seed });
    s.revealBright();
    return s;
  };
}

export default {
  style: 'glow',
  updates: [
    {
      title: 'The Lantern Road',
      note: 'Once a year the lanterns are lit along the old mountain road, and three samurai who died guarding it walk again: TOMOSHIBI with a burning lantern in his chest, HOTARU under a hat full of fireflies and SUIGETSU with the moon on his helm. When the last lantern goes out, so do they.',
      skins: [
        {
          name: 'TOMOSHIBI (灯火) — Lantern Keeper',
          story: 'TOMOSHIBI, the Lantern Keeper, carries the first flame of the mountain road inside his chest, a red paper lantern ringed in gold that never burns down.',
          build: samurai({ neon: '#ff3d1f', neon2: '#ffc23a', seed: 71 }, ({ P, O, flip }) => {
            // Face: ember slits and a gold-toothed mempo.
            P('head', 'front', ['00000000', '00000000', '00000000', '17700771', '00000000', '00000000', '0e0ee0e0', '00e00e00']);
            P('head', 'right', flip(['00000000', '00000000', '00000000', '30000000', '00000000', '00000000', '00000000', '00000000']));
            P('head', 'left', ['00000000', '00000000', '00000000', '30000000', '00000000', '00000000', '00000000', '00000000']);
            // Kabuto with wide wings and a small flame crest.
            O('head', 'front', ['   gg   ', 'KKKKKKKK', 'K      K', 'KK    KK', 'K      K', '        ', 'K      K', 'KK KK KK']);
            O('head', 'right', ['      KK', 'KKKKKKKK', 'K      K', 'KKKKKKKK', 'K     KK', 'KKKKKKKK', '  K     ', '        ']);
            O('head', 'left', ['KK      ', 'KKKKKKKK', 'K      K', 'KKKKKKKK', 'KK     K', 'KKKKKKKK', '     K  ', '        ']);
            O('head', 'back', ['KKKKKKKK', 'K      K', 'KKKKKKKK', '        ', '   KK   ', '        ', 'KKKKKKKK', '        ']);
            O('head', 'top', ['        ', '  KKKK  ', ' K    K ', ' K    K ', ' K    K ', ' K    K ', '  KKKK  ', '   g7   ']);
            // The paper lantern: gold caps, red ribs, a tassel.
            P('body', 'front', ['00000000', '000ee000', '00eeee00', '07000070', '70333307', '70000007', '70333307', '70000007', '07333370', '00eeee00', '000e0000', '000e0000']);
            O('body', 'front', ['KKKKKKKK', 'KK    KK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KK    KK', 'KKKKKKKK']);
            // Back: a gold family crest ring.
            P('body', 'back', ['00000000', '00000000', '000ee000', '00e00e00', '0e0770e0', '0e0770e0', '00e00e00', '000ee000', '00000000', '00000000', '22222222', '00000000']);
            O('body', 'back', ['KKKKKKKK', ' K    K ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK', '        ', 'KKKKKKKK']);
            // Gauntlets: a little lantern at each wrist.
            P('rightArm', 'front', ['0000', '0ee0', '0000', '0000', '0000', '2222', '0000', '0770', '7ee7', '7ee7', '0770', '7777']);
            P('rightArm', 'right', ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0007', '0007', '0000', '0007']);
            P('rightArm', 'left', ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '7000', '7000', '0000', '7000']);
            P('rightArm', 'bottom', ['7777', '7777', '7777', '7777']);
            O('rightArm', 'front', ['KKKK', 'K  K', 'KKKK', '    ', 'KKKK', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK']);
            O('rightArm', 'top', ['KKKK', '    ', '    ', '    ']);
            // Greaves: gold knee cap, a single red flame line down the shin.
            P('rightLeg', 'front', ['0000', '0000', '0000', '0000', '0ee0', 'e00e', '0ee0', '0000', '0770', '0770', '0000', '7777']);
            O('rightLeg', 'front', ['KKKK', '    ', 'KKKK', '    ', '    ', '    ', '    ', 'KKKK', '    ', '    ', 'K  K', 'KKKK']);
          })
        },
        {
          name: 'HOTARU (蛍) — Firefly Ronin',
          story: 'HOTARU, the Firefly Ronin, walks the road under a wide straw hat, and the fireflies that follow him are the souls of everyone he swore to protect.',
          build: samurai({ neon: '#c6ff2e', neon2: '#2effc4', seed: 72 }, ({ P, O, flip }) => {
            // Face in the hat's shadow: two small eyes, a cloth mask below.
            P('head', 'front', ['00000000', '00000000', '00000000', '02700720', '00000000', '00000000', '00000000', '00000000']);
            // Jingasa: flat hat on top with a mint band, cloth mask over the mouth.
            O('head', 'top', ['bbbbbbbb', 'bKKKKKKb', 'bKccccKb', 'bKc7dcKb', 'bKcddcKb', 'bKccccKb', 'bKKKKKKb', 'bbbbbbbb']);
            O('head', 'front', ['KKKKKKKK', 'dddddddd', '        ', '        ', '        ', 'KK    KK', 'KKKKKKKK', 'KKKKKKKK']);
            for (const side of ['right', 'left']) O('head', side, ['KKKKKKKK', 'dddddddd', 'K      K', '        ', '        ', 'K      K', 'KK    KK', 'KKKKKKKK']);
            O('head', 'back', ['KKKKKKKK', 'dddddddd', 'KKKKKKKK', '   dd   ', '    d   ', '        ', '        ', '        ']);
            // Kimono collar, a mint obi and fireflies drifting over the chest.
            P('body', 'front', ['00000000', '00000020', '02700070', '00000000', '00070000', '70000000', 'ffffffff', '00000000', '00000700', '07000000', '00000000', '00700070']);
            O('body', 'front', ['KK    KK', ' KK  KK ', '  K  K  ', '   KK   ', '        ', '        ', 'KKKKKKKK', 'K      K', '        ', '        ', 'K      K', 'KKKKKKKK']);
            P('body', 'back', ['00000000', '07000000', '00000700', '00000000', '00700000', '00000070', 'ffffffff', '00000000', '07000000', '00000000', '00007000', '00000000']);
            O('body', 'back', ['KKKKKKKK', 'K      K', '        ', '        ', '        ', '        ', 'KKKKKKKK', '   KK   ', '  K  K  ', '        ', '        ', 'KKKKKKKK']);
            // Arms: wide kimono sleeves, a cloth wrap round the forearm, a firefly resting on each hand.
            P('rightArm', 'front', ['0000', '0000', '0700', '0000', '0000', '0000', '0000', '7000', '0f00', '00f0', '000f', '7777']);
            P('rightArm', 'right', ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0007', '0007']);
            P('rightArm', 'left', ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '7000', '7000']);
            P('rightArm', 'bottom', ['7777', '7777', '7777', '7777']);
            O('rightArm', 'front', ['KKKK', 'K  K', 'K  K', 'K  K', 'K  K', 'KKKK', '    ', '    ', '    ', '    ', '    ', 'KKKK']);
            for (const side of ['right', 'left', 'back']) O('rightArm', side, ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'K KK', '    ', '    ', '    ', '    ', '    ', 'KKKK']);
            // Legs: hakama pleats, mint sandal straps.
            P('rightLeg', 'front', ['0000', '0000', '0000', '0070', '0000', '0000', '0000', '0000', '0000', '0f0f', 'f0f0', '7777']);
            O('rightLeg', 'front', ['KKKK', 'K  K', 'K K ', 'K  K', 'K K ', 'K  K', 'K K ', 'KKKK', '    ', '    ', '    ', 'KKKK']);
            for (const side of ['right', 'left', 'back']) O('rightLeg', side, ['KKKK', 'K  K', '    ', '    ', '    ', '    ', '    ', 'KKKK', '    ', '    ', '    ', 'KKKK']);
          })
        },
        {
          name: 'SUIGETSU (水月) — Moon on the Water',
          story: 'SUIGETSU, the Moon on the Water, wears a golden crescent on his helm and fights where the river is calm, so every enemy sees two moons before the end.',
          build: samurai({ neon: '#ffd23c', neon2: '#2a8cff', seed: 73 }, ({ P, O }) => {
            // Face: cold blue eyes under the brim, a dim mempo grille.
            P('head', 'front', ['00000000', '00000000', '00000000', '00000000', '0fg00gf0', '00000000', '0c0cc0c0', '00000000']);
            // Crescent maedate rising off the brim, kabuto bowl, wide neck guard.
            O('head', 'front', ['7      7', '57    75', ' 577775 ', 'KKKKKKKK', 'K      K', 'K      K', 'KK    KK', 'KKK  KKK']);
            O('head', 'top', [' KKKKKK ', 'K  KK  K', 'K  KK  K', 'K  KK  K', 'K  KK  K', 'K  KK  K', '5  KK  5', '7      7']);
            for (const side of ['right', 'left']) O('head', side, ['        ', 'KKKKKKKK', '        ', 'KKKKKKKK', 'K      K', 'KKKKKKKK', 'K      K', 'KKKKKKKK']);
            O('head', 'back', ['KKKKKKKK', '        ', 'KKKKKKKK', 'K      K', 'KKKKKKKK', 'K      K', 'KKKKKKKK', '        ']);
            // Chest: the full moon above blue ripples.
            P('body', 'front', ['00000000', '00055000', '00577500', '00577500', '00055000', '00000000', '00000000', '0gg00gg0', 'g00gg00g', '00000000', '0cc00cc0', 'c00cc00c']);
            O('body', 'front', ['KKKKKKKK', 'K      K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK', '        ', '        ', '        ', 'KKKKKKKK', '        ', '        ']);
            // Back: the crescent again, reflected.
            P('body', 'back', ['00000000', '07000070', '05700750', '00577500', '00000000', '00000000', '00cggc00', '0c0000c0', '00000000', '00000000', '22222222', '00000000']);
            O('body', 'back', ['KKKKKKKK', '        ', '        ', '        ', 'KKKKKKKK', ' K    K ', '        ', '        ', 'KKKKKKKK', ' K    K ', '        ', 'KKKKKKKK']);
            // Gauntlets: waves breaking over the wrist, a gold moon on the shoulder.
            P('rightArm', 'front', ['0000', '0550', '0000', '0000', '0000', '0000', '0000', '0000', '0gg0', 'g00g', '0000', 'gggg']);
            P('rightArm', 'right', ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '000g', '0000', '000g']);
            P('rightArm', 'left', ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', 'g000', '0000', 'g000']);
            P('rightArm', 'bottom', ['gggg', 'gggg', 'gggg', 'gggg']);
            O('rightArm', 'front', ['KKKK', 'K  K', 'KKKK', '    ', 'KKKK', ' KK ', '    ', '    ', '    ', '    ', '    ', '    ']);
            O('rightArm', 'top', ['KKKK', 'K  K', 'K  K', 'KKKK']);
            // Greaves: gold knee, rippling water at the ankle.
            P('rightLeg', 'front', ['0000', '0000', '0000', '0000', '0550', '5775', '0550', '0000', '0000', 'g0g0', '0g0g', 'gggg']);
            O('rightLeg', 'front', ['KKKK', 'K  K', 'KKKK', '    ', '    ', '    ', '    ', 'KKKK', ' KK ', '    ', '    ', '    ']);
          })
        }
      ]
    }
  ]
};
