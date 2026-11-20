// Cyber Runners — glow pack. Existing: Glitch Runner, Neon Sprint, Void Hacker, Pulse Courier, Data Ghost,
// Quantum Jumper, Firewall Breaker, Circuit Phantom, Static Striker, Binary Blade — one armoured runner
// template in ten colour pairs: black suit, wide visor band framed by accent bars, chest bars, checker arms,
// leg blocks, accent boot band on the overlay.
// The pack's material language, measured from the textures: everything black, a primary neon in three flat
// steps (100 / 71 / 52 %), an accent neon (100 / 71 / 52 %), no glow gradients; the overlay is black panels
// plus a few solid accent bands. New runners keep that language but each gets its own head and gear.

// Paint map: K black, P/p/q/r primary 100/71/52/30 %, A/b/a accent 100/71/52 %, W white.
// ' ' clears an overlay pixel, '.' keeps a pixel.
const SIDES = ['front', 'right', 'left', 'back'];
const flip = rows => rows.map(r => [...r].reverse().join(''));

function runner({ P, A, slim = false }, draw, post) {
  return ({ Skin, color }) => {
    const s = new Skin({ slim });
    for (const part of ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']) s.fillPart(part, color.BLACK);
    const sh = (c, f) => color.shade(color.hex(c), f);
    const map = {
      K: color.BLACK, W: color.WHITE,
      P: color.hex(P), p: sh(P, 0.71), q: sh(P, 0.52), r: sh(P, 0.3),
      A: color.hex(A), b: sh(A, 0.71), a: sh(A, 0.52)
    };
    const paint = (part, face, rows, { layer = 'inner', x = 0, y = 0 } = {}) => {
      const f = s.face(part, face, layer);
      rows.forEach((row, i) => {
        if (row.length + x > f.w || (x === 0 && row.length !== f.w) || rows.length + y > f.h) {
          throw new Error(`cyber-runners: bad row ${i} "${row}" on ${part}.${face}.${layer} (${f.w}x${f.h})`);
        }
      });
      f.paint(rows, map, { x, y });
    };
    const I = (part, face, rows, at = {}) => paint(part, face, rows, { ...at, layer: 'inner' });
    const O = (part, face, rows, at = {}) => paint(part, face, rows, { ...at, layer: 'outer' });
    // Same rows on all four sides of a limb (or the given faces).
    const around = (part, rows, layer = 'inner', faces = SIDES) => faces.forEach(f => paint(part, f, rows, { layer }));
    const kit = { s, I, O, around, flip };
    draw(kit);
    s.mirrorLimbs();
    if (post) post(kit);
    return s;
  };
}

export default {
  style: 'glow',
  updates: [
    {
      title: 'Rooftop Relay',
      note: 'The runners take the city from above: a punk with a burning crest, a courier who has never lost a parcel and a skater who grinds the old rails between the towers.',
      skins: [
        {
          name: 'Crest Dash',
          story: 'His hot-pink crest is the last thing the rooftop drones see before he drops three floors and vanishes into the lime-lit alleys.',
          build: runner({ P: '#a8ff00', A: '#ff2a8a' }, ({ I, O, around, flip }) => {
            // Head: slatted lime shades, a pink lip ring, lightning bolts shaved into the sides.
            I('head', 'top', ['KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK']);
            I('head', 'front', ['KKKbbKKK', 'KKKKKKKK', 'KKKKKKKK', 'pPPPPPPp', 'PPPKKPPP', 'KPpKKpPK', 'KKKKKKKK', 'KKKKKAKK']);
            const shave = ['KKKKKKKK', 'KKKKKKKK', 'KKKKqKKK', 'KKKqKKKK', 'KKqqqqKK', 'KKKKqKKK', 'KKKqKKKK', 'KKKKKKKK'];
            I('head', 'right', shave); I('head', 'left', flip(shave));
            I('head', 'back', ['KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKqqKKK', 'KKKKKKKK']);
            // Overlay: the mohawk crest from forehead to neck, earrings.
            O('head', 'top', ['   AA   ', '   Ab   ', '   AA   ', '   bA   ', '   AA   ', '   Ab   ', '   AA   ', '   AA   ']);
            O('head', 'front', ['   AA   ', '        ', '        ', '        ', '        ', '        ', '        ', '        ']);
            O('head', 'back', ['   AA   ', '   Ab   ', '   AA   ', '   bA   ', '   aa   ', '        ', '        ', '        ']);
            const ear = ['        ', '        ', '        ', '        ', '        ', '    A   ', '    b   ', '        '];
            O('head', 'right', ear); O('head', 'left', flip(ear));
            // Body: lime lightning bolt on the shirt, studded vest, pink belt buckle, an X patch on the back.
            I('body', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKPPKK', 'KKKPPKKK', 'KKPPPPKK', 'KKKKPPKK', 'KKKPPKKK', 'KKKPKKKK', 'KKKKKKKK', 'aaaAAaaa', 'KKKKKKKK', 'KKKKKKKK']);
            I('body', 'back', ['KKKKKKKK', 'KPKKKKPK', 'KKPKKPKK', 'KKKPPKKK', 'KKKPPKKK', 'KKPKKPKK', 'KPKKKKPK', 'KKKKKKKK', 'KKKKKKKK', 'aaaaaaaa', 'KKKKKKKK', 'KKKKKKKK']);
            for (const side of ['right', 'left']) I('body', side, ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'aaaa', 'KKKK', 'KKKK']);
            O('body', 'front', ['AK    KA', 'KK    KK', 'KA    AK', 'KK    KK', 'KA    AK', 'KK    KK', 'KA    AK', 'KK    KK', 'KK    KK', '        ', '        ', '        ']);
            O('body', 'back', ['AKKKKKKA', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK', '        ', '        ', '        ']);
            for (const side of ['right', 'left']) O('body', side, ['KKKK', 'K  K', 'K  K', 'K  K', 'K  K', 'K  K', 'K  K', 'K  K', 'KKKK', '    ', '    ', '    ']);
            O('body', 'top', ['KKKKKKKK', '        ', '        ', 'KKKKKKKK']);
            // Arms: lime zigzag tattoo, studded shoulders and bracelet.
            I('rightArm', 'front', ['KKKK', 'KKKK', 'KKKK', 'KPKK', 'KKPK', 'KPKK', 'KKPK', 'KKKK', 'KKKK', 'qqqq', 'KKKK', 'KKKK']);
            I('rightArm', 'right', ['KKKK', 'KKKK', 'KKKK', 'KKPK', 'KPKK', 'KKPK', 'KPKK', 'KKKK', 'KKKK', 'qqqq', 'KKKK', 'KKKK']);
            for (const f of ['left', 'back']) I('rightArm', f, ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'qqqq', 'KKKK', 'KKKK']);
            O('rightArm', 'top', ['A  A', ' KK ', ' KK ', 'A  A']);
            around('rightArm', ['KKKK', 'KKKK', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', 'AKAK', 'KKKK', '    '], 'outer');
            // Legs: torn lime knees, pink laces, the pack's boot band.
            I('rightLeg', 'front', ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'PqqP', 'qKKq', 'KKKK', 'KKKK', 'KKKK', 'AKAK', 'KKKK', 'KKKK']);
            for (const f of ['right', 'left', 'back']) I('rightLeg', f, ['KKKK', 'KqKK', 'KKKK', 'KqKK', 'KKKK', 'KqKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK']);
            around('rightLeg', ['KKKK', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', '    ', 'AAAA', 'KKKK'], 'outer');
          })
        },
        {
          name: 'Parcel Bolt',
          story: 'She has carried a thousand amber parcels across the rooftops and never lost a single one, not even with the red alarms on her heels.',
          build: runner({ P: '#ffbf00', A: '#ff2d3a' }, ({ I, O, around, flip }) => {
            // Head: courier cap with a bolt logo and a red brim, amber shades.
            I('head', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KPPqqPPK', 'KqqKKqqK', 'KKKKKKKK', 'KKKKKKKK']);
            const ear = ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKqqKKK', 'KKKqqKKK', 'KKKKKKKK', 'KKKKKKKK'];
            I('head', 'right', ear); I('head', 'left', flip(ear));
            O('head', 'top', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKPPKKK', 'KKKPPKKK', 'KKKKKKKK', 'KKKKKKKK', 'AAAAAAAA']);
            O('head', 'front', ['KKKKPKKK', 'KKKPPKKK', 'AAAAAAAA', '        ', '        ', '        ', '        ', '        ']);
            const capSide = ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKbA', '        ', '        ', '        ', '        ', '        '];
            O('head', 'right', capSide); O('head', 'left', flip(capSide));
            O('head', 'back', ['KKKKKKKK', 'KKKKKKKK', 'KKAAAAKK', '        ', '        ', '        ', '        ', '        ']);
            // Body: hi-vis stripes under a messenger strap with a red buckle, the glowing parcel on the back.
            I('body', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'PPPPPPPP', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'PPPPPPPP', 'KKKKKKKK', 'KKKKKKKK', 'qqqAqqqq', 'KKKKKKKK']);
            I('body', 'back', ['KKKKKKKK', 'KPPPPPPK', 'KPqqqqPK', 'KPqAAqPK', 'KPqqqqPK', 'KPPPPPPK', 'KPqqqqPK', 'KPqqqqPK', 'KPPPPPPK', 'KKKKKKKK', 'qqqqqqqq', 'KKKKKKKK']);
            for (const side of ['right', 'left']) I('body', side, ['KKKK', 'KKKK', 'KKKK', 'PPPP', 'KKKK', 'KKKK', 'KKKK', 'pppp', 'KKKK', 'KKKK', 'qqqq', 'KKKK']);
            O('body', 'front', ['rr      ', ' rr     ', '  rr    ', '   rr   ', '    AA  ', '    rr  ', '     rr ', '      rr', '       r', '        ', '        ', 'KKKKKKKK']);
            O('body', 'back', ['KKKKKKKK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK', '        ', 'KKKKKKKK']);
            O('body', 'right', ['KK  ', 'K   ', 'K   ', '    ', '    ', '    ', '    ', '    ', 'K   ', 'KK  ', '    ', 'KKKK']);
            O('body', 'left', ['  KK', '   K', '   K', '    ', '    ', '    ', '    ', '    ', '   K', '  KK', '    ', 'KKKK']);
            // Arms: reflective bands, black shoulder pads, red fingerless gloves.
            around('rightArm', ['KKKK', 'KKKK', 'KKKK', 'PPPP', 'KKKK', 'KKKK', 'KKKK', 'pppp', 'KKKK', 'AAAA', 'KKKK', 'KKKK']);
            around('rightArm', ['KKKK', 'KKKK', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', '    ', '    ', '    '], 'outer');
            O('rightArm', 'top', ['KKKK', 'KKKK', 'KKKK', 'KKKK']);
            // Legs: reflective knee band, cargo pocket on the outside, red sneakers.
            around('rightLeg', ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'PPPP', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'AAAA', 'bbbb']);
            around('rightLeg', ['KKKK', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', '    ', 'KKKK'], 'outer');
            O('rightLeg', 'right', ['KKKK', 'KKKK', 'KKKK', 'KqqK', 'KKKK', '    ', '    ', '    ', '    ', 'KKKK', '    ', 'KKKK']);
          })
        },
        {
          name: 'Rail Grinder',
          story: 'He grinds the old tram rails between the towers on mint-lit skates, goggles pushed up so the wind can never hide the city from him.',
          build: runner({ P: '#9a55ff', A: '#00ffa8' }, ({ I, O, around, flip }) => {
            // Head: skate helmet with mint goggles pushed up on the forehead, violet eyes, mint cheek marks.
            I('head', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KPPKKPPK', 'KqKKKKqK', 'KKKKKKKK', 'KKKKKKKK']);
            O('head', 'front', ['KKKKKKKK', 'aAAaaAAa', 'KbbKKbbK', '        ', '        ', 'A      A', '        ', '        ']);
            const side = ['KKKKKKKK', 'aaaaaaaa', 'KKKKK   ', 'KKK     ', '        ', '        ', '        ', '        '];
            O('head', 'right', flip(side)); O('head', 'left', side);
            O('head', 'back', ['KKKKKKKK', 'aaaAAaaa', 'KKKKKKKK', 'KKKKKKKK', '        ', '        ', '        ', '        ']);
            O('head', 'top', ['KKKKKKKK', 'KKKbbKKK', 'KKKKKKKK', 'KKKbbKKK', 'KKKKKKKK', 'KKKbbKKK', 'KKKKKKKK', 'KKKKKKKK']);
            // Body: jersey with a skate-wheel emblem, violet side panels, speed lines on the back.
            I('body', 'front', ['qKKKKKKq', 'qKKKKKKq', 'qKKAAKKq', 'qKAqqAKq', 'qKAqqAKq', 'qKKAAKKq', 'qKKKKKKq', 'qKKKKKKq', 'qKKKKKKq', 'KKKKKKKK', 'PPPPPPPP', 'KKKKKKKK']);
            I('body', 'back', ['KKKKKKKK', 'KKKKKKKK', 'KKPPPPPP', 'KKKKKKKK', 'KKKPPPPP', 'KKKKKKKK', 'KKKKPPPP', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'PPPPPPPP', 'KKKKKKKK']);
            for (const s of ['right', 'left']) I('body', s, ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'PPPP', 'KKKK']);
            O('body', 'front', ['KK    KK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KKKKKKKK', '        ', 'KKKKKKKK']);
            O('body', 'back', ['KK    KK', 'K      K', '        ', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK', '        ', 'KKKKKKKK']);
            // Arms: violet forearm stripe, mint elbow pads and wrist guards.
            around('rightArm', ['KKKK', 'KqqK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'PPPP', 'KKKK', 'KKKK', 'KKKK', 'KKKK']);
            O('rightArm', 'front', ['    ', '    ', '    ', '    ', 'KKKK', 'KAAK', 'KKKK', '    ', '    ', 'KKKK', 'KbbK', 'KKKK']);
            around('rightArm', ['    ', '    ', '    ', '    ', 'KKKK', 'KKKK', 'KKKK', '    ', '    ', 'KKKK', 'KKKK', 'KKKK'], 'outer', ['right', 'left', 'back']);
            // Legs: knee pads, violet skate boots on a black plate, glowing mint wheels.
            around('rightLeg', ['KKKK', 'KKKK', 'KqqK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'pppp', 'pPPp', 'pppp', 'KKKK', 'AKKA']);
            I('rightLeg', 'bottom', ['AKKA', 'KKKK', 'KKKK', 'AKKA']);
            O('rightLeg', 'front', ['KKKK', '    ', '    ', 'KKKK', 'KAAK', 'KKKK', '    ', '    ', '    ', '    ', 'KKKK', 'A  A']);
            around('rightLeg', ['KKKK', '    ', '    ', 'KKKK', 'KKKK', 'KKKK', '    ', '    ', '    ', '    ', 'KKKK', 'A  A'], 'outer', ['right', 'left', 'back']);
          })
        }
      ]
    },
    {
      title: 'Smog District',
      note: 'Below the bright towers lies the smog district, and its runners glow just as hard: a scavenger who breathes through filters, a girl wired into the city network and a brawler with an iron grin.',
      skins: [
        {
          name: 'Smog Filter',
          story: 'He runs where the air turns green, and the yellow filters on his mask are the only reason he always makes it back.',
          build: runner({ P: '#3dff5a', A: '#ffe01a' }, ({ I, O, around, flip }) => {
            // Head: gas mask with round green lenses, a yellow filter snout and two cheek canisters.
            I('head', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KqqKKqqK', 'qPPqqPPq', 'qPPqqPPq', 'KqqKKqqK', 'KKKqqKKK', 'KKKKKKKK']);
            O('head', 'front', ['        ', 'KKKKKKKK', '        ', '        ', '        ', 'b KKKK b', 'AK AA KA', 'aKKKKKKa']);
            const strap = ['        ', 'KKKKKKKK', '        ', '        ', 'KKKKKKKK', '        ', '      KK', '     KKK'];
            O('head', 'right', strap); O('head', 'left', flip(strap));
            O('head', 'back', ['        ', 'KKKKKKKK', '        ', '        ', 'KKKAAKKK', '        ', '        ', '        ']);
            O('head', 'top', ['        ', '        ', '        ', 'KKKKKKKK', '        ', '        ', '        ', '        ']);
            // Body: breathing hose into a chest filter, hazard belt, green air tank on the back.
            I('body', 'front', ['KKKqqKKK', 'KKKqqKKK', 'KKKqqKKK', 'KKPPPPKK', 'KKPqqPKK', 'KKPPPPKK', 'KKKKKKKK', 'KKKKKKKK', 'AAKKAAKK', 'KAAKKAAK', 'KKKKKKKK', 'KKKKKKKK']);
            I('body', 'back', ['KKKKKKKK', 'KKPPPPKK', 'KPqqqqPK', 'KPqPPqPK', 'KPqqqqPK', 'KPqPPqPK', 'KPqqqqPK', 'KKPPPPKK', 'KKKKKKKK', 'AAKKAAKK', 'KAAKKAAK', 'KKKKKKKK']);
            for (const s of ['right', 'left']) I('body', s, ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'AAKK', 'KAAK', 'KKKK', 'KKKK']);
            O('body', 'front', ['KK    KK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KK    KK', '        ', '        ', 'KKKKKKKK', '        ']);
            O('body', 'back', ['KKKKKKKK', 'KK    KK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'KK    KK', 'KKKKKKKK', '        ', 'KKKKKKKK', '        ']);
            // Arms: green stripe, yellow rubber gloves with a bright cuff.
            around('rightArm', ['KKKK', 'KKKK', 'KPPK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'AAAA', 'KKKK', 'KKKK', 'aaaa']);
            I('rightArm', 'bottom', ['aaaa', 'aaaa', 'aaaa', 'aaaa']);
            around('rightArm', ['KKKK', 'KKKK', '    ', 'KKKK', '    ', '    ', '    ', 'KKKK', '    ', 'KKKK', '    ', '    '], 'outer');
            // Legs: green shin light, hazard boots.
            around('rightLeg', ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KPPK', 'KqqK', 'KKKK', 'KKKK', 'KKKK', 'AKKA', 'KAAK', 'KKKK']);
            around('rightLeg', ['KKKK', 'KKKK', '    ', 'KKKK', '    ', '    ', 'KKKK', '    ', 'KKKK', '    ', '    ', 'KKKK'], 'outer');
          })
        },
        {
          name: 'Wire Locks',
          story: 'Her hair is a bundle of fibre-optic cables, and every magenta tip blinks when she pulls another secret out of the city network.',
          build: runner({ P: '#2f7bff', A: '#ff3df2' }, ({ I, O, around, flip }) => {
            // Head: blue eyes with data lines running down the cheeks, cable hair with glowing tips.
            I('head', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KPPKKPPK', 'KqKKKKqK', 'KqKKKKqK', 'KKKKKKKK']);
            I('head', 'top', ['KKKKKKKK', 'KaKKKaKK', 'KKKKKKKK', 'KKKaKKKa', 'KKKKKKKK', 'KaKKKaKK', 'KKKKKKKK', 'KKKaKKKa']);
            O('head', 'top', ['KKKKKKKK', 'KaKKKaKK', 'KKKKKKKK', 'KKKaKKKa', 'KKKKKKKK', 'KaKKKaKK', 'KKKKKKKK', 'KKKaKKKa']);
            O('head', 'front', ['KKKKKKKK', 'aKaKKaKa', 'A b  a b', '  A    A', '        ', '        ', '        ', '        ']);
            const locks = ['KKKKKKKK', 'aKaKaKaK', 'aKaKaKa ', 'a a a a ', 'a a a A ', 'a A a   ', 'a   A   ', 'A       '];
            O('head', 'right', locks); O('head', 'left', flip(locks));
            O('head', 'back', ['KKKKKKKK', 'aKaKaKaK', 'aKaKaKaK', 'aKaKaKaK', 'a a a a ', 'a a a a ', 'a a a a ', 'a a a a ']);
            O('body', 'back', ['a a a a ', 'b a b a ', 'A b A b ', '  A   A ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK']);
            // Body: jacket with blue lapels and a magenta ID barcode, ports down the spine.
            I('body', 'front', ['PKKKKKKP', 'KPKKKKPK', 'KKPKKPKK', 'KKKPPKKK', 'KKKKKKKK', 'KAKAAKAK', 'KAKAAKAK', 'KaKaaKaK', 'KKKKKKKK', 'qqqqqqqq', 'KKKKKKKK', 'KKKKKKKK']);
            I('body', 'back', ['KKKKKKKK', 'KKKAAKKK', 'KKKKKKKK', 'KKKAAKKK', 'KKKKKKKK', 'KKKAAKKK', 'KKKKKKKK', 'KKKqqKKK', 'KKKKKKKK', 'qqqqqqqq', 'KKKKKKKK', 'KKKKKKKK']);
            for (const s of ['right', 'left']) I('body', s, ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'qqqq', 'KKKK', 'KKKK']);
            O('body', 'front', ['        ', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', '        ', '        ', 'KKKKKKKK']);
            for (const s of ['right', 'left']) O('body', s, ['KKKK', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK']);
            // Arms: magenta cable wound around the forearm, blue cuffs.
            around('rightArm', ['KKKK', 'KKKK', 'KqKK', 'KqKK', 'KqKK', 'AAAA', 'KKKK', 'AAAA', 'KKKK', 'aaaa', 'pppp', 'KKKK']);
            around('rightArm', ['KKKK', 'KKKK', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', '    ', '    '], 'outer');
            // Legs: blue seam on the outside, magenta boot band.
            I('rightLeg', 'front', ['PKKK', 'PKKK', 'PKKK', 'PKKK', 'PKKK', 'PKKK', 'PKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'PPPP']);
            I('rightLeg', 'right', ['KKKP', 'KKKP', 'KKKP', 'KKKP', 'KKKP', 'KKKP', 'KKKP', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'PPPP']);
            around('rightLeg', ['KKKK', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', '    ', 'AAAA', 'KKKK'], 'outer');
          })
        },
        {
          name: 'Iron Grin',
          story: 'He lost his jaw in a street fight and forged a chrome one, and now his grin glows as hot as the furnace in his chest.',
          build: runner({ P: '#ff5a14', A: '#d4dce4' }, ({ I, O, around, flip }) => {
            // Head: furnace eyes, chrome jaw with glowing teeth, hinge bolts and forehead plate.
            I('head', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KqPKKPqK', 'KKKKKKKK', 'bAAAAAAb', 'bAPAAPAb', 'abbbbbba']);
            O('head', 'front', ['  aAAa  ', '        ', '        ', '        ', '        ', 'A      A', 'b      b', 'a      a']);
            const hinge = ['        ', '        ', '        ', '        ', '      K ', '     KAb', '      bA', '      ab'];
            O('head', 'right', hinge); O('head', 'left', flip(hinge));
            O('head', 'top', ['        ', '  A  A  ', '        ', '        ', '        ', '        ', '  A  A  ', '  aAAa  ']);
            O('head', 'back', ['        ', '        ', '        ', '        ', '        ', 'KbbbbbbK', 'K      K', 'KKKKKKKK']);
            // Body: furnace grille in a chrome chest plate, exhaust pipes on the back.
            I('body', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KPPPPPPK', 'KKKKKKKK', 'KPPPPPPK', 'KKKKKKKK', 'KqqqqqqK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK']);
            I('body', 'back', ['KPKKKKPK', 'KqKKKKqK', 'KqKKKKqK', 'KqKKKKqK', 'KqKKKKqK', 'KqKKKKqK', 'KqKKKKqK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK']);
            O('body', 'front', ['        ', 'A      A', 'bAAAAAAb', 'b      b', 'b      b', 'b      b', 'b      b', 'b      b', 'abbbbbba', '        ', 'KKKKKKKK', '        ']);
            O('body', 'back', ['        ', ' b    b ', ' b    b ', ' b    b ', ' b    b ', ' b    b ', ' a    a ', '        ', '        ', '        ', 'KKKKKKKK', '        ']);
            // Arms: a black sleeve with a furnace line (left), the right arm is chrome (see below).
            around('rightArm', ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KqKK', 'KqKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK']);
            around('rightArm', ['KKKK', 'KKKK', '    ', '    ', 'KKKK', '    ', '    ', '    ', '    ', 'KKKK', 'KKKK', '    '], 'outer');
            // Legs: furnace knee joints, chrome boot caps.
            around('rightLeg', ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KPPK', 'KqqK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK']);
            around('rightLeg', ['KKKK', 'KKKK', '    ', 'KKKK', '    ', '    ', 'KKKK', '    ', 'KKKK', 'AAAA', 'bbbb', 'KKKK'], 'outer');
          }, ({ I, O, around, s }) => {
            // The chrome arm: grey plates, furnace joints at shoulder and elbow, glowing fingertips.
            around('rightArm', ['bAAb', 'abba', 'aaaa', 'KPPK', 'abba', 'abba', 'aaaa', 'KPPK', 'abba', 'abba', 'aaaa', 'APAP']);
            I('rightArm', 'top', ['bAAb', 'abba', 'abba', 'bAAb']);
            I('rightArm', 'bottom', ['aaaa', 'aPPa', 'aPPa', 'aaaa']);
            for (const f of ['top', ...SIDES]) s.face('rightArm', f, 'outer').clear();
            around('rightArm', ['AAAA', '    ', '    ', '    ', 'bAAb', '    ', '    ', '    ', 'bAAb', '    ', '    ', '    '], 'outer');
          })
        }
      ]
    },
    {
      title: 'Overdrive Night',
      note: 'Once a year the whole city turns into a race track: a rider nobody has seen without a helmet, a medic who keeps the runners going and a silent fixer who decides how the race ends.',
      skins: [
        {
          name: 'Apex Rider',
          story: 'Number 07 has won the Overdrive race four times, and nobody has ever seen the face behind the azure visor.',
          build: runner({ P: '#19a7ff', A: '#ffd21a' }, ({ I, O, around, flip }) => {
            // Head: closed racing helmet, yellow stripe over the top, tinted visor with the eyes glowing behind it.
            I('head', 'front', ['KKKKKKKK', 'KKKKKKKK', 'qqqqqqqq', 'qPPqqPPq', 'rqqqqqqr', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK']);
            O('head', 'front', ['KKKAAKKK', 'KKKAAKKK', 'K      K', '        ', 'K      K', 'KKKKKKKK', 'KKKAAKKK', 'KKKKKKKK']);
            const side = ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKK ', 'PPPPPPK ', 'KKKKKKK ', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK'];
            O('head', 'right', side); O('head', 'left', flip(side));
            O('head', 'back', ['KKKAAKKK', 'KKKAAKKK', 'KKKAAKKK', 'PPPAAPPP', 'KKKAAKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK']);
            O('head', 'top', ['KKKAAKKK', 'KKKAAKKK', 'KKKAAKKK', 'KKKAAKKK', 'KKKAAKKK', 'KKKAAKKK', 'KKKAAKKK', 'KKKAAKKK']);
            // Body: race suit with the number 07, azure shoulders, side stripes, a chevron on the back.
            I('body', 'front', ['PKKKKKKP', 'PPKKKKPP', 'KKKKKKKK', 'KAAAKAAA', 'KAKAKKKA', 'KAKAKKAK', 'KAKAKKAK', 'KAAAKKAK', 'KKKKKKKK', 'KKKKKKKK', 'qqqqqqqq', 'KKKKKKKK']);
            I('body', 'back', ['KKKKKKKK', 'PKKKKKKP', 'KPKKKKPK', 'KKPKKPKK', 'KKKPPKKK', 'KKKKKKKK', 'PKKKKKKP', 'KPKKKKPK', 'KKPKKPKK', 'KKKPPKKK', 'qqqqqqqq', 'KKKKKKKK']);
            for (const s of ['right', 'left']) I('body', s, ['KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'qqqq', 'KKKK']);
            O('body', 'front', ['KK    KK', 'K      K', '        ', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK', '        ', 'KKKKKKKK']);
            O('body', 'back', ['KK    KK', 'K      K', '        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK']);
            // Arms: azure shoulders and side stripes, elbow guards, gloves with a yellow cuff.
            I('rightArm', 'front', ['PPPP', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK']);
            for (const f of ['right', 'left', 'back']) I('rightArm', f, ['PPPP', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KKKK', 'KKKK', 'KKKK']);
            I('rightArm', 'top', ['pppp', 'pPPp', 'pPPp', 'pppp']);
            O('rightArm', 'front', ['    ', '    ', '    ', '    ', 'KKKK', 'KAAK', 'KKKK', '    ', '    ', 'KKKK', 'AAAA', 'KKKK']);
            around('rightArm', ['    ', '    ', '    ', '    ', 'KKKK', '    ', 'KKKK', '    ', '    ', 'KKKK', 'AAAA', 'KKKK'], 'outer', ['right', 'left', 'back']);
            // Legs: azure outer stripe, yellow knee sliders, armoured boots.
            I('rightLeg', 'front', ['PKKK', 'PKKK', 'PKKK', 'PKKK', 'PKKK', 'PKKK', 'PKKK', 'PKKK', 'KKKK', 'KKKK', 'KKKK', 'qqqq']);
            I('rightLeg', 'right', ['KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KpPK', 'KKKK', 'KKKK', 'KKKK', 'qqqq']);
            O('rightLeg', 'front', ['KKKK', '    ', '    ', '    ', 'AAAA', 'bAAb', '    ', '    ', 'KKKK', 'KKKK', 'KKKK', 'KKKK']);
            around('rightLeg', ['KKKK', '    ', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', 'KKKK', 'KKKK', 'KKKK'], 'outer', ['right', 'left', 'back']);
          })
        },
        {
          name: 'Volt Medic',
          story: 'She patches up crashed runners at full speed, and the heartbeat on her mask glows aqua for as long as theirs keeps going.',
          build: runner({ P: '#2dffc8', A: '#ff3b5c' }, ({ I, O, around, flip }) => {
            // Head: medic cap with a red cross, aqua eyes, a mask with a heartbeat line.
            I('head', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KPPKKPPK', 'KKKKKKKK', 'KKKPKKKK', 'PPPKPKPP', 'KKKKKPKK']);
            O('head', 'front', ['KKKAAKKK', 'KKAAAAKK', 'KKKAAKKK', '        ', 'KKKKKKKK', '        ', '        ', '        ']);
            const band = ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', '        ', 'KKKKKKKK', '        ', '        ', '        '];
            O('head', 'right', band); O('head', 'left', flip(band));
            O('head', 'back', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', '        ', 'KKKbbKKK', '        ', '        ', '        ']);
            O('head', 'top', ['        ', '   AA   ', '   AA   ', ' AAAAAA ', ' AAAAAA ', '   AA   ', '   AA   ', '        ']);
            // Body: red cross on the chest, a belt of aqua vials, defibrillator paddles on the back.
            I('body', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKAAKKK', 'KKKAAKKK', 'KAAAAAAK', 'KAAAAAAK', 'KKKAAKKK', 'KKKAAKKK', 'KKKKKKKK', 'KPKPKPKK', 'qqqqqqqq', 'KKKKKKKK']);
            I('body', 'back', ['KKKKKKKK', 'KPPKKPPK', 'KPqKKqPK', 'KPPKKPPK', 'KKKKKKKK', 'KKKKAKKK', 'KKKAAKKK', 'KKAAKKKK', 'KKKAKKKK', 'KKKKKKKK', 'qqqqqqqq', 'KKKKKKKK']);
            for (const s of ['right', 'left']) I('body', s, ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KPKK', 'qqqq', 'KKKK']);
            O('body', 'front', ['KK    KK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', '        ', '        ', 'KKKKKKKK']);
            O('body', 'back', ['KKKKKKKK', 'K  KK  K', 'K  KK  K', 'K  KK  K', 'KKKKKKKK', '        ', '        ', '        ', '        ', '        ', '        ', 'KKKKKKKK']);
            // Arms: red armband, aqua gloves.
            around('rightArm', ['KKKK', 'KKKK', 'AAAA', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'PPPP', 'pppp', 'pppp']);
            I('rightArm', 'bottom', ['pppp', 'pppp', 'pppp', 'pppp']);
            around('rightArm', ['KKKK', 'KKKK', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', '    ', '    ', '    '], 'outer');
            // Legs: aqua knee line, red boot band.
            around('rightLeg', ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'pppp', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'PPPP', 'KKKK', 'KKKK']);
            around('rightLeg', ['KKKK', '    ', 'KKKK', '    ', '    ', 'KKKK', '    ', '    ', 'KKKK', '    ', 'AAAA', 'KKKK'], 'outer');
          })
        },
        {
          name: 'Silent Collar',
          story: 'Nobody knows who pays him; he just turns up his indigo collar, tips his hat, and the race always ends the way he planned.',
          build: runner({ P: '#e0e6ff', A: '#7a3dff' }, ({ I, O, around, flip }) => {
            // Head: hat with an indigo band, cold eyes, a high collar hiding the lower face.
            I('head', 'front', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KqPKKPqK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK']);
            O('head', 'front', ['KKKKKKKK', 'AAAAAAAA', 'KKKKKKKK', '        ', 'K      K', 'bAAAAAAb', 'KKKKKKKK', 'KKKKKKKK']);
            const side = ['KKKKKKKK', 'AAAAAAAA', 'KKKKKKKK', '        ', 'AAAAA   ', 'KKKKKAAA', 'KKKKKKKK', 'KKKKKKKK'];
            O('head', 'right', side); O('head', 'left', flip(side));
            O('head', 'back', ['KKKKKKKK', 'AAAAAAAA', 'KKKKKKKK', '        ', 'AAAAAAAA', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK']);
            O('head', 'top', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK']);
            // Body: ice shirt and indigo tie under a long coat with glowing buttons.
            I('body', 'front', ['KKPPPPKK', 'KKKAAKKK', 'KKKAAKKK', 'KKKbbKKK', 'KKKbbKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'aaaaaaaa', 'KKKKKKKK']);
            I('body', 'back', ['KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKaaKKK', 'KKKaaKKK', 'KKKaaKKK', 'aaaaaaaa', 'KKKaaKKK']);
            for (const s of ['right', 'left']) I('body', s, ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'aaaa', 'KKKK']);
            O('body', 'front', ['KA    AK', 'KKA  AKK', 'KKA  AKK', 'KKA  AKK', 'KKKAAKKK', 'KKK  KKK', 'KPK  KPK', 'KKK  KKK', 'KPK  KPK', 'KKK  KKK', 'bbbbbbbb', 'KKK  KKK']);
            O('body', 'back', ['KKKKKKKK', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'K      K', 'bbbbbbbb', 'KK    KK']);
            for (const s of ['right', 'left']) O('body', s, ['KKKK', 'K  K', 'K  K', 'K  K', 'K  K', 'K  K', 'K  K', 'K  K', 'K  K', 'K  K', 'bbbb', 'KKKK']);
            // Arms: coat sleeves with indigo cuffs, ice shirt cuffs.
            around('rightArm', ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KqKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'PPPP', 'KKKK', 'KKKK']);
            around('rightArm', ['KKKK', '    ', '    ', '    ', '    ', '    ', '    ', 'KKKK', 'AAAA', '    ', '    ', '    '], 'outer');
            // Legs: coat tails with an indigo hem, pinstripe trousers, ice shoe tips.
            around('rightLeg', ['KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKKK', 'KKqK', 'KKqK', 'KKqK', 'KKKK', 'PPPP']);
            around('rightLeg', ['KKKK', 'KKKK', 'K  K', 'K  K', 'K  K', 'K  K', 'AAAA', '    ', '    ', '    ', '    ', 'KKKK'], 'outer');
          })
        }
      ]
    }
  ]
};
