// Abandoned Magic Mages — dark, faceless mages tinted in the colour of their element: robes that are
// almost black at the edges and glow faintly towards the centre, burning eyes, a glowing chest sigil,
// hands that hold their magic and a few loose sparks on the overlay.
// Existing: Frostweaver (ice), Ember Oracle (fire), Void Prophet (purple), Nature Sage (green vine),
// Storm Archon (blue lightning), Earth Warden (gold-brown), Tide Caller (cyan), Ash Prophet (grey),
// Rune Forger (crimson/amber). They share one silhouette, so every new mage gets a headpiece of its
// own (hood, hat, circlet, crown, horns, halo, wrap), a new sigil and new hands.

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

// Glow ramp of one element: e dim, g mid, h bright, w hot, W white-hot.
const glowRamp = (color, c) => { const b = color.hex(c); return { e: color.shade(b, 0.32), g: color.shade(b, 0.62), h: b, w: color.shade(b, 1.5), W: color.shade(b, 1.85) }; };

// The pack's material: every inner face darkens strongly towards its edges, legs fade to black.
function vignette(s, color, { strength = 0.75, legFade = 0.6 } = {}) {
  for (const part of ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']) for (const f of s.faces(part)) {
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const dx = Math.abs(x - (f.w - 1) / 2) / (f.w / 2), dy = Math.abs(y - (f.h - 1) / 2) / (f.h / 2);
      let k = 1 - strength * Math.pow(Math.max(dx, dy * 0.8), 1.6);
      if (part.endsWith('Leg') && !['top', 'bottom'].includes(f.face)) k *= 1 - legFade * (y / (f.h - 1));
      if (part.endsWith('Arm') && f.face !== 'top') k *= 1 - 0.25 * (y / (f.h - 1));
      f.set(x, y, color.shade(f.get(x, y), Math.max(0.15, k)));
    }
  }
}

const HANDS = { // rows 6–11 of the arm (front, side)
  flare: [['....', '.e..', 'eg.e', 'ghge', 'hwhg', 'ghhg'], ['....', '....', 'e..e', 'geeg', 'ghhg', 'geeg']],
  bracer: [['....', 'gggg', 'hwwh', 'gggg', '.e..', 'eghe'], ['....', 'gggg', 'hhhh', 'gggg', '....', 'eggE']],
  claw: [['....', '....', 'e..e', 'g.eg', 'hg.h', 'w.hw'], ['....', '....', '....', 'e..e', 'g..g', 'h..h']],
  orb: [['....', '.ee.', 'eghe', 'ghwh', 'ehhe', '.ge.'], ['....', '....', '.e..', 'eg..', 'ge..', 'e...']],
  wisp: [['.e..', '..e.', '.g..', '..g.', '.hg.', 'ghhg'], ['....', '.e..', '..e.', '.g..', 'eg.e', 'gggg']],
  gust: [['....', 'e...', '.gg.', '...h', 'hhw.', '.gwh'], ['....', '....', 'ee..', '..g.', 'gg..', 'ghhg']]
};

function hands(s, kind, L, k) {
  const [front, side] = HANDS[kind];
  const map = { ...L, E: L.e, k };
  for (const f of ['front']) s.face('rightArm', f).paint(front, map, { y: 6 });
  for (const f of ['right', 'left', 'back']) s.face('rightArm', f).paint(side, map, { y: 6 });
  s.face('rightArm', 'bottom').fill(L.g);
  s.mirrorLimbs(['inner']);
}

// A few loose sparks on the overlay, like the hand-made mages: [part, face, x, y, char]
function sparks(s, list, L) {
  for (const [part, face, x, y, ch] of list) s.face(part, face, 'outer').set(x, y, L[ch]);
}

// The mage: human() for robe and headpiece, then the pack's dark material and the glow on top.
function mage({ human, color }, o) {
  const L = glowRamp(color, o.glow);
  const robe = color.hex(o.robe);
  const k = color.shade(robe, 0.35);
  const s = human({
    seed: o.seed,
    skin: o.skin || color.shade(robe, 0.75),
    face: { eyes: o.glow, style: 'none', mouth: 'none' },
    hair: o.hair || null,
    head: o.head,
    top: { kind: 'robe', color: o.robe, trim: o.trim },
    sleeves: 'long',
    pants: o.robe,
    boots: color.shade(robe, 0.6),
    belt: o.belt || color.shade(color.hex(o.glow), 0.3),
    texture: 0.05,
    cape: o.cape
  });
  // Like the hand-made mages, the overlay stays almost empty: only the headpiece and a few sparks.
  for (const part of ['body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']) s.faces(part, 'outer').forEach(f => f.clear());
  vignette(s, color, o.vignette);
  const map = { ...L, k, K: color.shade(robe, 0.15), ...Object.fromEntries(Object.entries(o.colors || {}).map(([c, v]) => [c, color.hex(v)])) };
  if (o.face) s.face('head', 'front').paint(o.face, map);
  if (o.chest) s.face('body', 'front').paint(o.chest, map);
  if (o.backSigil) s.face('body', 'back').paint(o.backSigil, map);
  if (o.legs) { s.face('rightLeg', 'front').paint(o.legs, map); s.face('leftLeg', 'front').paint(o.legs.map(r => [...r].reverse().join('')), map); }
  hands(s, o.hands || 'flare', L, k);
  if (o.sparks) sparks(s, o.sparks, L);
  if (o.finish) o.finish(s, map, color);
  return s;
}

const SPARKS_A = [['body', 'front', 0, 1, 'h'], ['body', 'front', 7, 1, 'h'], ['rightArm', 'front', 1, 3, 'g'], ['leftArm', 'front', 2, 4, 'g'], ['body', 'back', 5, 3, 'w'], ['rightLeg', 'front', 1, 6, 'g']];
const SPARKS_B = [['body', 'front', 1, 9, 'h'], ['body', 'front', 6, 2, 'g'], ['rightArm', 'right', 2, 2, 'h'], ['leftArm', 'front', 1, 1, 'g'], ['body', 'back', 2, 7, 'w'], ['leftLeg', 'front', 2, 4, 'g']];
const SPARKS_C = [['head', 'front', 0, 7, 'g'], ['body', 'front', 7, 4, 'h'], ['rightArm', 'front', 2, 1, 'h'], ['leftArm', 'left', 1, 5, 'g'], ['body', 'back', 4, 9, 'W'], ['rightLeg', 'right', 2, 3, 'g']];

export default {
  style: 'hair',
  updates: [
    {
      title: 'The Hooded Circle',
      note: 'When the academy fell silent, three mages pulled up their hoods and kept practising in the dark: a hermit of the moon, a hexer of blood and a mystic who speaks with serpents.',
      skins: [
        {
          name: 'Moonveil Hermit',
          story: 'She hid in the empty observatory for a hundred nights, and now the pale crescent she prayed to shines on her own chest.',
          build: kit => mage(kit, {
            seed: 201, robe: '#2a1e52', glow: '#c9b8ff',
            head: { kind: 'hood', color: '#30265a', trim: '#8a76d0' },
            face: ['........', '........', '........', '........', '.gW..Wg.', '..e..e..', '........', '........'],
            chest: ['........', '...whh..', '..wh....', '..h...e.', '..h.....', '..wh....', '...whh..', '........', '....e...', '........', '...e....', '........'],
            hands: 'orb', sparks: SPARKS_A
          })
        },
        {
          name: 'Bloodthorn Hexer',
          story: 'He traded his voice for a curse, so he hides his mouth behind a crimson veil and lets the thorns on his chest speak for him.',
          build: kit => mage(kit, {
            seed: 202, robe: '#4a1418', glow: '#ff2a3a',
            head: { kind: 'hood', color: '#36100f', trim: '#a01020', mask: '#5a1218' },
            face: ['........', '........', '........', '.h....h.', '.wh..hw.', '........', '..g..g..', '...gg...'],
            chest: ['.g....g.', '..g..g..', '...hh...', '..hWWh..', '...hh...', '..g..g..', '.g....g.', '........', '........', '..e..e..', '...ee...', '........'],
            hands: 'claw', sparks: SPARKS_B
          })
        },
        {
          name: 'Venom Mystic',
          story: 'The serpents of the flooded cellar taught her their language, and the fangs on her cobra hood are the only thing they asked for in return.',
          build: kit => mage(kit, {
            seed: 203, robe: '#1e3016', glow: '#b6ff1e',
            head: { kind: 'hood', color: '#2a4216', trim: '#6aa818' },
            face: ['........', '........', '........', '........', '.hg..gh.', '.e....e.', '........', '........'],
            chest: ['..e..e..', '...ee...', '..hhhh..', '.hWhhWh.', '..hhhh..', '...gg...', '....gg..', '.....gg.', '....gg..', '...gg...', '..gg....', '..e.....'],
            hands: 'wisp', sparks: SPARKS_C,
            finish: (s, m) => { // fangs hanging from the hood rim, scales along its sides
              s.face('head', 'front', 'outer').paint(['........', '........', '........', 'g......g', 'w......w', 'h......h'], m);
              for (const f of ['right', 'left']) s.face('head', f, 'outer').paint(['e.e.e.e.', '.e.e.e.e'], m);
            }
          })
        }
      ]
    },
    {
      title: 'Crowns of the Fallen Tower',
      note: 'High in the broken tower, three masters still wear the marks of their rank: a star-hatted archmage, a magus crowned with the sun and an enchantress grown out of crystal.',
      skins: [
        {
          name: 'Starfall Archmage',
          story: 'He mapped every star from the top of the fallen tower, and the ones that fell from the sky now shine on the hat he pulls low over his golden eyes.',
          build: kit => mage(kit, {
            seed: 211, robe: '#1a2050', glow: '#ffd75a',
            colors: { N: '#262e72', n: '#141a46', Y: '#ffd75a', y: '#a8842a' },
            face: ['........', '........', '........', '........', '.hw..wh.', '........', '........', '........'],
            chest: ['........', '.h......', '..e.....', '...e..w.', '....hee.', '........', '........', '.....h..', '....e...', '...e....', '..w.....', '........'],
            hands: 'bracer', sparks: SPARKS_A,
            finish: (s, m) => { // tall star hat: dark cone on top, gold band, brim shadow
              s.face('head', 'top').paint(['nnnnnnnn', 'nNNNNNNn', 'nNnnnnNn', 'nNnYYnNn', 'nNnYYnNn', 'nNnnnnNn', 'nNNNNNNn', 'nnnnnnnn'], m);
              s.face('head', 'top', 'outer').paint(['nnnnnnnn', 'nNNNNNNn', 'nNnnnnNn', 'nNnYYnNn', 'nNnYYnNn', 'nNnnnnNn', 'nNNNNNNn', 'nnnnnnnn'], m);
              for (const f of ['front', 'right', 'left', 'back']) {
                s.face('head', f).paint(['nNNNNNNn', 'nNNNNNNn', 'nnNNNNnn', 'kkkkkkkk'], m);
                s.face('head', f, 'outer').paint(f === 'front' ? ['nNNNNYNn', 'nNYNNNNn', 'nNNNNNYn', 'yYYYYYYy'] : ['nNNYNNNn', 'nNNNNNYn', 'nYNNNNNn', 'yYYYYYYy'], m);
              }
            }
          })
        },
        {
          name: 'Solar Magus',
          story: 'The last keeper of the sun hall wears a golden circlet that still holds one morning of light, and he spends it a ray at a time.',
          build: kit => mage(kit, {
            seed: 212, robe: '#4a3010', glow: '#ffb81e',
            head: { kind: 'circlet', trim: '#ffcf40', gem: '#fff2a0' },
            face: ['........', '........', '........', '........', '.gh..hg.', '........', '........', '........'],
            chest: ['...g....', '.g.h.g..', '..hwh...', 'ghwWwhg.', '..hwh...', '.g.h.g..', '...g....', '........', '........', '........', '........', '........'],
            hands: 'flare', sparks: SPARKS_B,
            finish: (s, m) => s.face('head', 'front', 'outer').paint(['.g.h.g..', '..hwh...'], m)
          })
        },
        {
          name: 'Crystal Enchantress',
          story: 'She slept too long beside the tower’s power crystal, and when she woke, magenta shards had grown from her brow like a crown.',
          build: kit => mage(kit, {
            seed: 213, robe: '#3a1440', glow: '#ff4adc',
            face: ['........', '........', '........', '........', '.w....w.', '.g....g.', '........', '........'],
            chest: ['........', '...h....', '..hwh...', '.hwWwh..', '..hwh...', '...h....', '........', '.....e..', '....ghe.', '.....e..', '........', '........'],
            hands: 'orb', sparks: SPARKS_C,
            finish: (s, m) => { // a tiara of crystal shards growing over the head
              s.face('head', 'front', 'outer').paint(['.w.hh.w.', '.h.WW.h.', '..gwwg..', '...gg...'], m);
              s.face('head', 'top', 'outer').paint(['..h..h..', '.g....g.', '........', 'h......h', 'g......g', '........', '.g.hh.g.', '.h.ww.h.'], m);
              s.face('head', 'right', 'outer').paint(['h...w...', 'g..gh...', '...e....'], m);
              s.face('head', 'left', 'outer').paint(['...w...h', '...hg..g', '....e...'], m);
            }
          })
        }
      ]
    },
    {
      title: 'Echoes of the Empty Academy',
      note: 'Not everyone left the academy: a spirit still lights the halls, a necromancer guards the crypt below and a dervish rides the wind through the broken windows.',
      skins: [
        {
          name: 'Wisp Warden',
          story: 'He died keeping the lanterns lit, and now his spectral halo and the lantern at his belt are the only lights that walk the empty corridors at night.',
          build: kit => mage(kit, {
            seed: 221, robe: '#123a34', glow: '#3dffd0',
            head: { kind: 'halo', color: '#a0fff0' },
            face: ['........', '........', '........', '.hh..hh.', '.wW..Ww.', '.e....e.', '...gg...', '........'],
            chest: ['........', '........', '........', '........', '........', '...ee...', '..e..e..', '..hhhh..', '..hWWh..', '..hwwh..', '..hhhh..', '...gg...'],
            hands: 'wisp', sparks: SPARKS_A,
            finish: (s, m) => s.face('head', 'front', 'outer').paint(['.eghhge.'], m) // the halo's glow on the brow
          })
        },
        {
          name: 'Bonecrown Necromancer',
          story: 'Crowned with the bones of the old headmasters, he keeps the crypt under the academy and lets no student rest until the lessons are finished.',
          build: kit => mage(kit, {
            seed: 222, robe: '#26281e', glow: '#8aff4a',
            head: { kind: 'crown', trim: '#867e66', gem: '#8aff4a' },
            colors: { B: '#8e8670', b: '#4e4a3a' },
            face: ['........', '........', '........', '.KK..KK.', '.Kh..hK.', '...kk...', '..BbbB..', '........'],
            chest: ['........', '...BB...', '.bBBBBb.', '..bggb..', '.bBhhBb.', '..bggb..', '.bBBBBb.', '...BB...', '........', '...g....', '....e...', '........'],
            hands: 'claw', sparks: SPARKS_B
          })
        },
        {
          name: 'Gale Dervish',
          story: 'She spins through the shattered windows of the academy, and the pale blue wind wrapped around her head never once touches the ground.',
          build: kit => mage(kit, {
            seed: 223, robe: '#22384a', glow: '#9fe8ff',
            head: { kind: 'bandana', color: '#5a88a8' },
            colors: { A: '#6e9cbc', a: '#3e6684' },
            face: ['........', '........', '........', '........', '.hW..Wh.', '........', '........', '........'],
            chest: ['........', '.hhhh...', '.....h..', '..ggg.g.', '.....g..', '.eeee...', '........', '........', '........', '........', '........', '........'],
            legs: ['....', 'e...', '.e..', '....', '..e.', '...e', '....', '....'],
            hands: 'gust', sparks: SPARKS_C,
            finish: (s, m) => { // the wind wrap stands off the head, one bright gust runs through it
              for (const f of ['front', 'right', 'left']) s.face('head', f, 'outer').paint(['........', 'aAAAAAAa', 'aaaaaaaa'], m);
              s.face('head', 'front', 'outer').paint(['........', '.hwhg...'], m);
            }
          })
        }
      ]
    }
  ]
};
