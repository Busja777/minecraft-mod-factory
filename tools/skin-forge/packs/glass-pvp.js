// GLASS PVP — rainbow glass skins. Existing: AE2 DRONE (cyan screen), BOTANIA MANA (purple flower),
// SLIME GLOW (green slime). The pack's own look, measured from the textures:
//   • every inner face is a glass panel: a 1 px rainbow rim (full saturation, hue +15° per pixel along
//     x + y) around a pale pastel fill (saturation ~24 %, hue +10° per pixel), so the light runs diagonally;
//   • the overlay is thin BLACK line art only (72–77 % transparent): a shaped head frame, a motif on the
//     chest, rings on the limbs;
//   • one strong accent colour for the face and a small chest emblem.
// Neither glow() (black base) nor human() (shaded cloth) fits, so the builder below paints that glass.

// ── Pack helpers ──────────────────────────────────────────────────────────────────────────────

function hsv(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), 255];
}

// One glass panel: rainbow rim + pastel fill, both running diagonally from the top-left corner.
function glassFace(f, base) {
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const rim = x === 0 || y === 0 || x === f.w - 1 || y === f.h - 1;
    f.set(x, y, rim ? hsv(base + 15 * (x + y), 1, 0.976) : hsv(base + 20 + 10 * (x + y), 0.24, 0.886));
  }
}

const flip = rows => rows.map(r => [...r].reverse().join(''));
const PARTS = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
const SIDES4 = ['front', 'right', 'left', 'back'];

// o: { seed, accent, accent2, face, emblem, emblemY, back, backY, hat:{front,side,back,top,right?,left?},
//      body:{front,back,side,top?}, arms:{front,side,inner?,back?,top?}, legs:{front,side,inner?,back?},
//      armIn, legIn (inner rows on the right limb front), finish(s, ctx) }
// Paint maps: K black, A accent, a light accent, D dark accent, G accent2, g light accent2, W white.
function glass({ Skin, color }, o) {
  const s = new Skin();
  const r = color.rng(`glass${o.seed}`);
  for (const p of PARTS) for (const f of s.faces(p)) glassFace(f, Math.floor(r() * 24) * 15);

  const A = color.hex(o.accent), G = color.hex(o.accent2 || o.accent);
  const map = { K: color.BLACK, A, a: color.mix(A, '#ffffff', 0.45), D: color.shade(A, 0.6), G, g: color.mix(G, '#ffffff', 0.45), W: [246, 246, 250, 255] };
  const paint = (part, face, rows, layer = 'inner', y = 0) => rows && s.face(part, face, layer).paint(rows, map, { y });

  // Inner details
  paint('head', 'front', o.face);
  paint('body', 'front', o.emblem, 'inner', o.emblemY ?? 2);
  paint('body', 'back', o.back, 'inner', o.backY ?? 2);
  paint('rightArm', 'front', o.armIn);
  paint('rightLeg', 'front', o.legIn);

  // Overlay line art
  const h = o.hat;
  paint('head', 'front', h.front, 'outer');
  paint('head', 'right', h.right || h.side, 'outer');
  paint('head', 'left', h.left || (h.side && flip(h.side)), 'outer');
  paint('head', 'back', h.back, 'outer');
  paint('head', 'top', h.top, 'outer');
  const b = o.body;
  paint('body', 'front', b.front, 'outer');
  paint('body', 'back', b.back, 'outer');
  paint('body', 'right', b.side, 'outer');
  paint('body', 'left', b.side && flip(b.side), 'outer');
  paint('body', 'top', b.top, 'outer');
  for (const [part, d] of [['rightArm', o.arms], ['rightLeg', o.legs]]) {
    paint(part, 'front', d.front, 'outer');
    paint(part, 'right', d.side, 'outer');
    paint(part, 'left', d.inner || d.side, 'outer');
    paint(part, 'back', d.back || d.inner || d.side, 'outer');
    paint(part, 'top', d.top, 'outer');
  }
  s.mirrorLimbs();
  if (o.finish) o.finish(s, { map, paint, color });
  return s;
}

// Limb rings shared by several designs.
const RING3 = ['KKKK', '....', '....', '....', '....', 'KKKK', '....', '....', '....', '....', '....', 'KKKK'];

// ── Updates ───────────────────────────────────────────────────────────────────────────────────

export default {
  style: 'accent',
  updates: [
    {
      title: 'The Glass Arena',
      note: 'The gates of the glass arena open and three new champions step into the rainbow light: an amber knight, a ruby dragon and a shark that bites through crystal.',
      skins: [
        {
          name: 'PRISM KNIGHT',
          story: 'His great helm was cut from a single amber prism, and the sword on his shield glows brighter with every duel he wins.',
          build: kit => glass(kit, {
            seed: 101, accent: '#ffb000',
            face: ['........', '........', 'KKKKKKKK', 'KAAKKAAK', 'KKKKKKKK', '...KK...', '...KK...', '........'],
            emblem: ['...aa...', '..AAAA..', '...AA...', '...AA...', '...Aa...'], emblemY: 2,
            hat: {
              front: ['KKKKKKKK', 'K..KK..K', 'K......K', 'K......K', 'K......K', 'K......K', 'K.K..K.K', 'KKKKKKKK'],
              side: ['KKKKKKKK', 'K......K', 'K......K', 'K......K', 'K..K.K.K', 'K......K', 'K......K', 'KKKKKKKK'],
              back: ['KKKKKKKK', 'K..KK..K', 'K......K', 'K......K', 'K......K', 'K......K', 'K......K', 'KKKKKKKK'],
              top: ['...KK...', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...']
            },
            body: {
              front: ['KKKKKKKK', '.KKKKKK.', '.K....K.', '.K....K.', '.K....K.', '.K....K.', '..K..K..', '...KK...', 'KKKKKKKK', 'K..KK..K', '........', '........'],
              back: ['KKKKKKKK', '.K....K.', '.K....K.', '..KKKK..', '........', '........', '........', '........', 'KKKKKKKK', '........', '........', '........'],
              side: ['KKKK', '....', '....', '....', '....', '....', '....', '....', 'KKKK', '....', '....', '....']
            },
            arms: {
              front: ['KKKK', 'K..K', 'KKKK', '....', '....', '.KK.', '....', '....', 'KKKK', 'K..K', 'K..K', 'KKKK'],
              side: ['KKKK', 'K..K', 'KKKK', '....', '....', '....', '....', '....', 'KKKK', '....', '....', 'KKKK'],
              inner: ['KKKK', '....', '....', '....', '....', '....', '....', '....', 'KKKK', '....', '....', 'KKKK']
            },
            legs: {
              front: ['KKKK', '....', '....', '....', 'KKKK', 'K..K', 'KKKK', '....', 'KKKK', 'K..K', 'K..K', 'KKKK'],
              side: ['KKKK', '....', '....', '....', 'KKKK', '....', 'KKKK', '....', 'KKKK', '....', '....', 'KKKK']
            }
          })
        },
        {
          name: 'RUBY DRAGON',
          story: 'A young dragon hatched inside a ruby, it still breathes red glass fire and leaves claw marks on every wall of the arena.',
          build: kit => glass(kit, {
            seed: 102, accent: '#ff2038', accent2: '#ffc400',
            face: ['........', '........', '........', '.KG..GK.', '........', '..K..K..', 'KWKKKKWK', '.KKKKKK.'],
            emblem: ['...a....', '..aA..a.', '..AAa.A.', '.AAaAAA.', '.AAGGAA.', '..AGGA..', '...AA...'], emblemY: 1,
            back: ['K......K', 'AK....KA', 'AAK..KAA', 'AAAKKAAA', 'AAK..KAA', 'AK....KA'], backY: 1,
            hat: {
              front: ['W......W', 'DW....WD', 'KDD..DDK', '........', '........', '........', 'K......K', 'KK.KK.KK'],
              side: ['WWK.....', '..KWK...', '....KKKK', '........', '........', '........', '.......K', 'KKKKKKKK'],
              back: ['K......K', 'KK.KK.KK', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...', 'KKKKKKKK'],
              top: ['...KK...', '...KK...', '...KK...', '...KK...', '...KK...', 'KK.KK.KK', '.K....K.', 'K......K']
            },
            body: {
              front: ['KKKKKKKK', '........', '........', '........', '........', '........', '........', '.KKKKKK.', '..K..K..', '.KKKKKK.', '..K..K..', '.KKKKKK.'],
              back: ['KKKKKKKK', '........', '........', '........', '........', '........', '........', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...'],
              side: ['KKKK', '....', '....', '....', '....', '....', '....', '....', '....', '....', '....', 'KKKK']
            },
            arms: {
              front: ['KKKK', '....', '....', '....', 'K..K', '.KK.', '....', '....', 'KKKK', '....', '....', '.K.K'],
              side: ['KKKK', '....', '....', '....', 'K..K', '.KK.', '....', '....', 'KKKK', '....', '....', '....'],
              inner: ['KKKK', '....', '....', '....', '....', '....', '....', '....', 'KKKK', '....', '....', '....']
            },
            armIn: ['....', '....', '....', '....', '....', '....', '....', '....', '....', '....', 'W.W.', 'W.W.'],
            legs: {
              front: ['KKKK', '....', '....', '....', 'K..K', '.KK.', '....', '....', 'KKKK', '....', '....', '.K.K'],
              side: ['KKKK', '....', '....', '....', 'K..K', '.KK.', '....', '....', 'KKKK', '....', '....', '....']
            },
            legIn: ['....', '....', '....', '....', '....', '....', '....', '....', '....', '....', 'W.W.', 'W.W.']
          })
        },
        {
          name: 'SHARD SHARK',
          story: 'It swims through the glass floor of the arena as if it were water, and its grin is made of crystal shards.',
          build: kit => glass(kit, {
            seed: 103, accent: '#1a5cff',
            face: ['........', '........', '.A....A.', '.K....K.', 'KKKKKKKK', 'WKWKWKWK', 'KWKWKWKW', 'KKKKKKKK'],
            emblem: ['...AA...', '..A..A..', '...AA...', '...AA...', '.A.AA.A.', '.AAAAAA.', '..AAAA..'], emblemY: 1,
            hat: {
              front: ['KKKKKKKK', '........', '........', 'K......K', '........', '........', '........', '........'],
              side: ['KKKKKKKK', '........', '..K.K.K.', '..K.K.K.', '..K.K.K.', '........', '........', 'KKKKKKKK'],
              back: ['KKKKKKKK', '...KK...', '...KK...', '...KK...', '........', '........', '........', 'KKKKKKKK'],
              top: ['...K....', '...KK...', '...KKK..', '...K.KK.', '...K..K.', '...K.KK.', '...KKK..', '........']
            },
            body: {
              front: ['KKKKKKKK', '........', '........', '........', '........', '........', '........', '........', 'KKKKKKKK', '.K....K.', '..K..K..', '...KK...'],
              back: ['KKKKKKKK', '...K....', '...KK...', '...KKK..', '...K.KK.', '...K..KK', '...K...K', '...KKKKK', '........', '........', '........', '........'],
              side: ['KKKK', '....', '....', 'K.K.', 'K.K.', 'K.K.', '....', '....', 'KKKK', '....', '....', '....']
            },
            arms: {
              front: ['KKKK', '...K', '..K.', '.K..', 'K...', '....', '...K', '..K.', '.K..', 'K...', '....', 'KKKK'],
              side: ['KKKK', '....', '...K', '..KK', '.K.K', 'KKKK', '....', '....', '....', '....', '....', 'KKKK'],
              inner: RING3
            },
            legs: {
              front: ['KKKK', '....', '....', 'KKKK', '....', '....', 'KKKK', '....', '....', 'KKKK', '....', 'KKKK'],
              side: ['KKKK', '....', '....', 'KKKK', '....', '....', 'KKKK', '....', '....', 'KKKK', '....', 'KKKK']
            }
          })
        }
      ]
    },
    {
      title: 'Moonlight Creatures',
      note: 'When the moon rises over the arena the glass starts to glow, and three night creatures come out to play: a moon bunny, a star owl and a ghost who carries a lantern.',
      skins: [
        {
          name: 'MOON BUNNY',
          story: 'She hops from one glass tower to the next under the full moon, and nobody has ever been fast enough to catch her.',
          build: kit => glass(kit, {
            seed: 201, accent: '#ff4fb4', accent2: '#ffd23c',
            face: ['.A....A.', '.a....a.', '........', '.KW..KW.', '.KK..KK.', '...AA...', '...WW...', '........'],
            emblem: ['..GGG...', '.GG.....', '.G......', '.G......', '.GG.....', '..GGG...'], emblemY: 2,
            back: ['........', '........', '........', '........', '........', '..aaaa..', '.aWWWWa.', '.aWWWWa.', '..aaaa..'], backY: 1,
            hat: {
              front: ['K.K..K.K', 'K.K..K.K', '.K....K.', '........', '........', '........', '........', '........'],
              side: ['.......K', '........', '........', '........', '........', '........', '........', 'K......K'],
              back: ['K.K..K.K', 'K.K..K.K', '.K....K.', '........', '........', '........', '........', '.KKKKKK.'],
              top: ['K.K..K.K', 'K.K..K.K', 'K.K..K.K', 'K.K..K.K', 'K.K..K.K', 'K.K..K.K', 'K.K..K.K', 'K.K..K.K']
            },
            body: {
              front: ['KKKKKKKK', 'K.K..K.K', '........', '........', '........', '........', '........', '........', '........', '........', '........', 'KKKKKKKK'],
              back: ['KKKKKKKK', 'K.K..K.K', '........', '........', '........', '........', '..KKKK..', '.K....K.', '.K....K.', '..KKKK..', '........', 'KKKKKKKK'],
              side: ['KKKK', 'K.K.', '....', '....', '....', '....', '....', '....', '....', '....', '....', 'KKKK']
            },
            arms: {
              front: ['KKKK', '....', '....', '....', '....', '....', '....', '....', 'KKKK', '....', '....', '.KK.'],
              side: ['KKKK', '....', '....', '....', '....', '....', '....', '....', 'KKKK', '....', '....', '....']
            },
            armIn: ['....', '....', '....', '....', '....', '....', '....', '....', '....', 'aaaa', 'aAAa', 'aaaa'],
            legs: {
              front: ['KKKK', '....', '....', '....', '....', '....', '....', '....', '.KK.', 'K..K', 'K..K', 'KKKK'],
              side: ['KKKK', '....', '....', '....', '....', '....', '....', '....', '....', 'KKKK', '....', 'KKKK']
            },
            legIn: ['....', '....', '....', '....', '....', '....', '....', '....', '....', '.aa.', 'aWWa', '....']
          })
        },
        {
          name: 'STAR OWL',
          story: 'The owl keeps watch from the top of the arena all night, and the star on its chest lights the way for lost players.',
          build: kit => glass(kit, {
            seed: 202, accent: '#00d8a0', accent2: '#ffaa00',
            face: ['........', '........', '........', '.AK..KA.', '.aA..Aa.', '...GG...', '...GG...', '........'],
            emblem: ['...GG...', '...GG...', '.GGGGGG.', '..GggG..', '..GGGG..', '.GG..GG.'], emblemY: 1,
            hat: {
              front: ['K......K', 'KK....KK', '.KK..KK.', 'K..KK..K', 'K..KK..K', '.KK..KK.', '........', '........'],
              side: ['......KK', '.......K', '........', '........', '........', '........', '........', 'KKKKKKKK'],
              back: ['K......K', 'KK....KK', '........', 'K.K..K.K', '.K.KK.K.', 'K.K..K.K', '.K.KK.K.', 'KKKKKKKK'],
              top: ['K......K', '........', '........', '........', '........', '........', '........', 'K......K']
            },
            body: {
              front: ['........', '........', '........', '........', '........', '........', '........', 'K......K', '.K....K.', 'K.K..K.K', '.K.KK.K.', '..K..K..'],
              back: ['KKKKKKKK', 'K..KK..K', 'K.K..K.K', 'KK....KK', 'K.K..K.K', 'K..KK..K', 'K.K..K.K', 'KK....KK', 'K.K..K.K', 'K..KK..K', '........', '........'],
              side: ['KKKK', '....', '....', '....', '....', '....', '....', '....', '....', '....', '....', 'KKKK']
            },
            arms: {
              front: ['KKKK', '....', 'K..K', '.KK.', '....', 'K..K', '.KK.', '....', 'K..K', '.KK.', '....', 'KKKK'],
              side: ['KKKK', '....', '....', '....', '....', 'KKKK', '....', '....', 'K..K', '.KK.', '....', 'KKKK'],
              inner: RING3
            },
            legs: {
              front: ['KKKK', '....', '....', '....', '....', '....', '....', 'KKKK', '....', '....', '....', 'K.K.'],
              side: ['KKKK', '....', '....', '....', '....', '....', '....', 'KKKK', '....', '....', '....', '....']
            },
            legIn: ['....', '....', '....', '....', '....', '....', '....', '....', '....', '....', 'GGGG', 'GKGK']
          })
        },
        {
          name: 'LANTERN GHOST',
          story: 'A friendly ghost who floats through the glass halls at night, holding up its little orange lantern so nobody walks alone.',
          build: kit => glass(kit, {
            seed: 203, accent: '#ff8a00',
            face: ['........', '........', '.KK..KK.', '.KA..KA.', '.KK..KK.', '........', '...KK...', '...KK...'],
            emblem: ['...KK...', '..KKKK..', '..KaaK..', '..KAAK..', '..KaAK..', '..KKKK..'], emblemY: 2,
            hat: {
              front: ['..KKKK..', '.K....K.', 'K......K', '........', '........', '........', 'K.K..K.K', '.K.KK.K.'],
              side: ['..KKKK..', '.K....K.', 'K.......', '........', '........', '........', 'K.K..K.K', '.K.KK.K.'],
              back: ['..KKKK..', '.K....K.', 'K......K', '........', '........', '........', 'K.K..K.K', '.K.KK.K.'],
              top: ['..KKKK..', '.K....K.', 'K......K', 'K......K', 'K......K', 'K......K', '.K....K.', '..KKKK..']
            },
            body: {
              front: ['...KK...', '..K..K..', '........', '........', '........', '........', '........', '........', '........', 'K.K..K.K', '.K.KK.K.', '........'],
              back: ['........', '........', '........', '........', '........', '........', '........', '........', '........', 'K.K..K.K', '.K.KK.K.', '........'],
              side: ['....', '....', '....', '....', '....', '....', '....', '....', '....', 'K.K.', '.K.K', '....']
            },
            arms: {
              front: ['KKKK', '....', '....', '....', '....', '....', '....', 'K.K.', '.K.K', '....', '....', 'KKKK'],
              side: ['KKKK', '....', '....', '....', '....', '....', '....', 'K.K.', '.K.K', '....', '....', '....']
            },
            legs: {
              front: ['....', '....', '....', '....', '....', '....', '....', '....', 'K..K', '.KK.', '....', 'K.K.'],
              side: ['....', '....', '....', '....', '....', '....', '....', '....', 'K..K', '.KK.', '....', 'K.K.']
            }
          })
        }
      ]
    },
    {
      title: 'The Crystal Throne',
      note: 'Deep under the arena stands a throne of glass, and three guardians never leave its side: a queen in a black crown, a skull of pure crystal and a mech that runs on lightning.',
      skins: [
        {
          name: 'GLASS QUEEN',
          story: 'She rules the arena from the crystal throne, and the magenta gem in her crown shines on every player who wins with honour.',
          build: kit => glass(kit, {
            seed: 301, accent: '#ff00c8',
            face: ['........', '........', '........', '.KK..KK.', '.KA..AK.', '........', '...AA...', '........'],
            emblem: ['...aa...', '..aAAa..', '.aAAAAa.', '..AAAA..', '...AA...'], emblemY: 2,
            hat: {
              front: ['K.K..K.K', 'KKKAAKKK', '........', '........', '........', '........', '........', '........'],
              side: ['K.K..K.K', 'KKKKKKKK', 'K.......', 'K.......', 'K.......', 'K.......', 'K.......', 'KK......'],
              back: ['K.K..K.K', 'KKKKKKKK', 'K......K', 'K......K', 'K......K', 'K......K', 'K......K', 'KKKKKKKK'],
              top: ['KKKKKKKK', 'K......K', 'K......K', 'K......K', 'K......K', 'K......K', 'K......K', 'KKKKKKKK']
            },
            body: {
              front: ['K......K', '.K....K.', '........', '........', '........', '........', '........', 'KKKKKKKK', '........', '.K....K.', 'K......K', 'KKKKKKKK'],
              back: ['KKKKKKKK', 'K......K', 'K......K', 'K......K', 'K......K', 'K......K', 'K......K', 'KKKKKKKK', '........', '.K....K.', 'K......K', 'KKKKKKKK'],
              side: ['....', '....', '....', '....', '....', '....', '....', 'KKKK', '....', '....', '....', 'KKKK']
            },
            arms: {
              front: ['K..K', '.KK.', '....', '....', '....', '....', '....', '....', 'KKKK', 'K.K.', 'KKKK', '....'],
              side: ['....', '....', '....', '....', '....', '....', '....', '....', 'KKKK', '.K.K', 'KKKK', '....']
            },
            legs: {
              front: ['KKKK', 'K..K', '....', '....', '....', '....', '....', '....', '....', 'KKKK', 'K..K', 'KKKK'],
              side: ['KKKK', '....', '....', '....', '....', '....', '....', '....', '....', 'KKKK', '....', 'KKKK']
            },
            legIn: ['....', '....', '....', '....', '....', '....', '....', '....', '....', '....', '.AA.', '....']
          })
        },
        {
          name: 'CRYSTAL SKULL',
          story: 'Its bones are clear as glass and only its red crystal heart and eyes give it away when it creeps up in the dark.',
          build: kit => glass(kit, {
            seed: 302, accent: '#ff1a2a',
            face: ['........', 'KKK..KKK', 'KAK..KAK', 'KKK..KKK', '...KK...', '........', '.WKWKWK.', '.KKKKKK.'],
            emblem: ['..AA.AA.', '..AAAAA.', '...AAA..', '....A...'], emblemY: 3,
            hat: {
              front: ['KKKKKKKK', '........', '........', '........', 'K......K', '.K....K.', '........', '..KKKK..'],
              side: ['KKKKKKKK', '........', '........', '....KK..', '....KK..', '.......K', '......K.', 'KKKKKK..'],
              back: ['KKKKKKKK', '...KK...', '..K..K..', '........', '........', '........', '........', '.KKKKKK.'],
              top: ['........', '........', '..K..K..', '...KK...', '...KK...', '..K..K..', '........', '........']
            },
            body: {
              front: ['KKKKKKKK', '...KK...', 'KK....KK', '........', 'KK....KK', '........', 'KK....KK', '...KK...', '...KK...', 'KKKKKKKK', 'K......K', '........'],
              back: ['KKKKKKKK', '...KK...', 'KK.KK.KK', '...KK...', 'KK.KK.KK', '...KK...', 'KK.KK.KK', '...KK...', '...KK...', 'KKKKKKKK', 'K......K', '........'],
              side: ['KKKK', '....', 'KKKK', '....', 'KKKK', '....', 'KKKK', '....', '....', 'KKKK', '....', '....']
            },
            arms: {
              front: ['KKKK', '.KK.', '....', '....', '.KK.', 'KKKK', '.KK.', '....', '....', '.KK.', 'KKKK', '....'],
              side: ['KKKK', '....', '....', '....', '....', 'KKKK', '....', '....', '....', '....', 'KKKK', '....']
            },
            legs: {
              front: ['KKKK', 'K..K', '....', '....', 'K..K', 'KKKK', 'K..K', '....', '....', 'K..K', 'KKKK', '....'],
              side: ['KKKK', '....', '....', '....', '....', 'KKKK', '....', '....', '....', '....', 'KKKK', '....']
            }
          })
        },
        {
          name: 'VOLT MECH',
          story: 'Built to guard the throne room, it charges its battery from the storm above the arena and flashes yellow before every strike.',
          build: kit => glass(kit, {
            seed: 303, accent: '#ffe600',
            face: ['........', '.KKKKKK.', '.KAKKAK.', '.KAKKAK.', '.KKKKKK.', '........', '.K.K.K..', '........'],
            emblem: ['..KKAA..', '..KAAK..', '..AAAA..', '..KAAK..', '..AAKK..'], emblemY: 3,
            hat: {
              front: ['...KK...', 'KKKKKKKK', 'K......K', 'K......K', 'K......K', 'KKKKKKKK', 'K......K', 'KKKKKKKK'],
              side: ['KKKKKKKK', 'K......K', 'K..KK..K', 'K.KAAK.K', 'K.KAAK.K', 'K..KK..K', 'K......K', 'KKKKKKKK'],
              back: ['KKKKKKKK', 'K......K', 'K.K..K.K', 'K.K..K.K', 'K.K..K.K', 'K.K..K.K', 'K......K', 'KKKKKKKK'],
              top: ['........', '........', '...K....', '...K....', '...KK...', '..KKKK..', '........', '........']
            },
            body: {
              front: ['KKKKKKKK', '...KK...', '.KKKKKK.', '.K....K.', '.K....K.', '.K....K.', '.K....K.', '.K....K.', '.KKKKKK.', '........', 'KKKKKKKK', 'K.K..K.K'],
              back: ['KKKKKKKK', '........', '.KKKKKK.', '.K....K.', '.K....K.', '.K....K.', '.KKKKKK.', '........', '........', '........', 'KKKKKKKK', '........'],
              side: ['KKKK', 'K..K', 'K..K', 'KKKK', '....', '....', '....', '....', '....', '....', 'KKKK', '....']
            },
            arms: {
              front: ['KKKK', 'K..K', 'K..K', 'KKKK', '.KK.', '.KK.', '.KK.', 'KKKK', 'K..K', 'K..K', 'KKKK', '....'],
              side: ['KKKK', 'K..K', 'K..K', 'KKKK', '....', '....', '....', 'KKKK', '....', '....', 'KKKK', '....']
            },
            armIn: ['....', '....', '....', '....', '.AA.', '.AA.', '.AA.', '....', '....', '....', '....', '....'],
            legs: {
              front: ['KKKK', '....', '....', '.KK.', '.KK.', 'KKKK', '....', '....', 'KKKK', 'K..K', '....', 'KKKK'],
              side: ['KKKK', '....', '....', '....', '....', 'KKKK', '....', '....', 'KKKK', '....', '....', 'KKKK']
            }
          })
        }
      ]
    }
  ]
};
