// Black & Yellow — classic hive pack. Existing: Yellow Shadow, Bumblebee Warrior, Hazmat Ghost, Cyber Hornet,
// Golden Reaper, Thunder Knight, Yellow Dragon, Black Pharaoh, Wasp Agent, Yellow Witch, Swarm Queen,
// Gold Samurai, Space Pilot, Yellow Jester, Hornet Biker, Venom Striker.
// The hand-made skins are flat, blocky gold-on-black designs (four golds, four dark greys, black outlines),
// mostly drawn again on the overlay so the whole figure stands out in 3D. human() shades too softly for that,
// so the pack has its own builder: hive({ inner, outer, lift }).
//   inner/outer: { 'part.face': rows }   lift: faces copied from inner to outer before `outer` is painted.
// Paint keys: K black, 1–6 dark greys, 7/8/W light grey → white (wings), a–g gold (dark → bright),
//             s/t/u skin (mid, shadow, light), m mouth. '.' keeps a pixel, ' ' clears it (overlay).

const PARTS = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
const SIDES = ['front', 'back', 'right', 'left'];
const COLOURS = {
  K: '#000000', 1: '#141414', 2: '#1c1c1c', 3: '#2a2a2a', 4: '#3a3a3a', 5: '#4b4b4b', 6: '#6a6a6a', 7: '#9a9a9a', 8: '#c8c8c8', W: '#f4f4f4',
  a: '#3c2a00', b: '#6e5000', c: '#966c00', d: '#b98a0a', e: '#d7a519', f: '#f2c82e', g: '#ffe680',
  s: '#c99067', t: '#a8714c', u: '#e0aa80', m: '#7a4a34'
};
const flip = rows => rows.map(r => [...r].reverse().join(''));

function hive({ base = {}, inner = {}, outer = {}, lift = [], slim = false }) {
  return ({ Skin, color }) => {
    const s = new Skin({ slim });
    const map = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [k, color.hex(v)]));
    for (const part of PARTS) s.fillPart(part, map[base[part] || '2']);
    const paint = (key, rows, layer) => {
      const [part, face] = key.split('.');
      const f = s.face(part, face, layer);
      if (rows.length !== f.h) throw new Error(`${key} (${layer}) has ${rows.length} rows, want ${f.h}`);
      rows.forEach((r, i) => { if (r.length !== f.w) throw new Error(`${key} (${layer}) row ${i} is ${r.length} wide, want ${f.w}`); });
      f.paint(rows, map);
    };
    for (const [k, rows] of Object.entries(inner)) paint(k, rows, 'inner');
    for (const key of lift) {
      const [part, face] = key.split('.');
      for (const fc of face ? [face] : [...SIDES, 'top', 'bottom']) {
        const a = s.face(part, fc), b = s.face(part, fc, 'outer');
        for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) b.set(x, y, a.get(x, y));
      }
    }
    for (const [k, rows] of Object.entries(outer)) paint(k, rows, 'outer');
    s.mirrorLimbs();
    return s;
  };
}

const blank = (w, n) => Array(n).fill(' '.repeat(w));

export default {
  style: 'clothing',
  updates: [
    {
      title: 'The Humming Deep',
      note: 'The Queen is awake, and the hive reaches for the surface: a miner who dug one block too deep, a golem carved from the gold-veined deepslate around it and the herald who speaks with the Queen\'s voice.',
      skins: [
        {
          name: 'Hive Miner',
          story: 'He was the miner who first broke into the hive, and he still wears his golden hard hat, its lamp humming in the same tune as the comb.',
          build: hive({
            base: { head: 's', body: '2', rightArm: '4', rightLeg: '2' },
            inner: {
              'head.top': ['dddddddd', 'deeffeed', 'deeffeed', 'deeffeed', 'deeffeed', 'deeffeed', 'deeffeed', 'dddddddd'],
              'head.front': ['ddeffedd', 'deeffeed', 'cccccccc', 'tsuuuust', 'sWKssKWs', 'sssttsss', 'smmmmmms', 'tsm22mst'],
              'head.right': ['dddddddd', 'eeeeeeee', 'cccccccc', '2222ssss', '2222ttss', '2222ttss', '22222sss', '222222ss'],
              'head.left': flip(['dddddddd', 'eeeeeeee', 'cccccccc', '2222ssss', '2222ttss', '2222ttss', '22222sss', '222222ss']),
              'head.back': ['dddddddd', 'eeeeeeee', 'cccccccc', '23232323', '32323232', '22222222', '22222222', '12222221'],
              'body.front': ['42tsst24', '422tt224', '2f2442f2', '2f2442f2', '2f2442f2', 'ffffffff', '2f2442f2', '2f2442f2', 'ffffffff', '22244222', 'bbbddbbb', '33333333'],
              'body.back': ['42222224', '2f2222f2', '22f22f22', '222ff222', '22f22f22', 'ffffffff', '2f2222f2', '2f2222f2', 'ffffffff', '22222222', 'bbbbbbbb', '33333333'],
              'body.right': ['4224', '2222', '2222', '2222', '2222', 'ffff', '2222', '2222', 'ffff', '2222', 'bbbb', '3333'],
              'body.left': ['4224', '2222', '2222', '2222', '2222', 'ffff', '2222', '2222', 'ffff', '2222', 'bbbb', '3333'],
              'body.top': ['44222244', '42222224', '42222224', '44222244'],
              'rightArm.front': ['4554', '4444', '4444', '4444', '3333', '5665', 'tsst', 'ssss', 'tsst', 'dddd', 'cddc', 'bccb'],
              'rightArm.right': ['4444', '4444', '4444', '4444', '3333', '5555', 'tsst', 'tsst', 'tsst', 'cccc', 'bccb', 'bbbb'],
              'rightArm.left': ['4444', '4444', '4444', '4444', '3333', '5555', 'tsst', 'tsst', 'tsst', 'cccc', 'bccb', 'bbbb'],
              'rightArm.back': ['4444', '4444', '4444', '4444', '3333', '5555', 'tsst', 'tsst', 'tsst', 'cccc', 'bccb', 'bbbb'],
              'rightArm.top': ['4444', '4554', '4554', '4444'],
              'rightArm.bottom': ['bbbb', 'bccb', 'bccb', 'bbbb'],
              'rightLeg.front': ['3223', '2222', '2222', '2222', '2222', '2222', '3223', 'ffff', '2222', '1111', '1dd1', 'dddd'],
              'rightLeg.right': ['3333', '2222', '2222', '2222', '2222', '2222', '2222', 'ffff', '2222', '1111', '1111', '1111'],
              'rightLeg.left': ['3333', '2222', '2222', '2222', '2222', '2222', '2222', 'ffff', '2222', '1111', '1111', '1111'],
              'rightLeg.back': ['3333', '2222', '2222', '2222', '2222', '2222', '2222', 'ffff', '2222', '1111', '1111', '1111'],
              'rightLeg.bottom': ['1111', '1111', '1111', '1111']
            },
            lift: ['body', 'rightLeg'],
            outer: {
              // Hard hat with its lamp and a wide brim.
              'head.top': ['eeeeeeee', 'effggffe', 'effggffe', 'effggffe', 'effggffe', 'effggffe', 'effggffe', 'eeeeeeee'],
              'head.front': ['ee4444ee', 'ee4gg4ee', 'cccccccc', ...blank(8, 5)],
              'head.right': ['eeeeeeee', 'eeeeeeee', 'cccccccc', ...blank(8, 5)],
              'head.left': ['eeeeeeee', 'eeeeeeee', 'cccccccc', ...blank(8, 5)],
              'head.back': ['eeeeeeee', 'eeeeeeee', 'cccccccc', ...blank(8, 5)],
              // Rolled-up sleeves and work gloves stand out, the bare forearm stays flat.
              'rightArm.front': ['4554', '4444', '4444', '4444', '3333', '5665', '    ', '    ', '    ', 'dddd', 'cddc', '    '],
              'rightArm.right': ['4444', '4444', '4444', '4444', '3333', '5555', '    ', '    ', '    ', 'cccc', 'bccb', '    '],
              'rightArm.left': ['4444', '4444', '4444', '4444', '3333', '5555', '    ', '    ', '    ', 'cccc', 'bccb', '    '],
              'rightArm.back': ['4444', '4444', '4444', '4444', '3333', '5555', '    ', '    ', '    ', 'cccc', 'bccb', '    '],
              'rightArm.top': ['4444', '4554', '4554', '4444']
            }
          })
        },
        {
          name: 'Gold Vein Golem',
          story: 'The hive carved its own guardian out of black deepslate, and molten gold still runs through every crack, pooling in a honeycomb heart that never cools.',
          build: hive({
            base: { head: '3', body: '3', rightArm: '3', rightLeg: '3' },
            inner: {
              // Deepslate with gold veins: 3/4 stone, 2 cracks, d/e veins.
              'head.top': ['34433443', '43e34334', '334e3343', '43343e34', '3e433443', '43e43344', '3343e343', '43343343'],
              'head.front': ['43343e34', '3e3343e3', '11111111', '2gf22fg2', '2dd22dd2', '34e33443', '3e4ee4e3', '43343343'],
              'head.right': ['34433443', '43343e34', '3343e343', '4334e343', '3e433443', '34e43344', '3343e343', '43343343'],
              'head.left': ['34433443', '43e34334', '343e3343', '343e4334', '34433e43', '44334e43', '343e3433', '43343343'],
              'head.back': ['34433443', '43e43344', '334e3343', '4334e334', '343e3343', '43e43344', '3e343343', '43343343'],
              // A honeycomb heart full of molten gold.
              'body.front': ['43344334', '34e33433', '32eeee23', '3edffde3', 'edfggfde', '3edffde3', '32eeee23', '334e3343', '43e33e34', '3e4334e3', '33433433', '11111111'],
              'body.back': ['43344334', '3e433433', '34e33443', '334e3e33', '4334e334', '3343e343', '43e43344', '3e343343', '34e33e43', '433443e3', '34433443', '11111111'],
              'body.right': ['4334', '34e3', '3e43', '4334', '33e4', '343e', '4334', '3e43', '34e3', '4334', '3443', '1111'],
              'body.left': ['4334', '3e43', '34e3', '4334', '4e33', 'e343', '4334', '34e3', '3e43', '4334', '3443', '1111'],
              'body.top': ['34433443', '43344334', '34433443', '43344334'],
              'rightArm.front': ['4554', '3443', '3333', '1111', '34e3', '3e43', '4e33', '3e43', '34e3', 'dddd', 'deed', 'cddc'],
              'rightArm.right': ['4554', '3443', '3333', '1111', '3e43', '34e3', '343e', '34e3', '3e43', 'dddd', 'cddc', 'cccc'],
              'rightArm.left': ['4554', '3443', '3333', '1111', '34e3', 'e343', '3e43', '3e43', '34e3', 'dddd', 'cddc', 'cccc'],
              'rightArm.back': ['4554', '3443', '3333', '1111', '3e43', '34e3', '34e3', '3e43', '43e3', 'dddd', 'cddc', 'cccc'],
              'rightArm.top': ['4554', '5665', '5665', '4554'],
              'rightArm.bottom': ['cddc', 'deed', 'deed', 'cddc'],
              'rightLeg.front': ['3443', '34e3', '3e43', '4334', '1111', '4e34', '3e43', '34e3', '43e4', '4334', '3443', '1111'],
              'rightLeg.right': ['3443', '3e43', '34e3', '4334', '1111', '43e4', '34e3', '3e43', '4e34', '4334', '3443', '1111'],
              'rightLeg.left': ['3443', '34e3', '3e43', '4334', '1111', '4e34', '3e43', '3e43', '43e4', '4334', '3443', '1111'],
              'rightLeg.back': ['3443', '3e43', '34e3', '4334', '1111', '34e3', '3e43', '34e3', '4e34', '4334', '3443', '1111'],
              'rightLeg.bottom': ['1111', '1111', '1111', '1111']
            },
            lift: ['body.back', 'body.right', 'body.left', 'rightArm', 'rightLeg'],
            outer: {
              // A heavy stone brow and a broken stone crown; the glowing face stays flat behind it.
              'head.top': ['44444444', '4      4', '4      4', '4      4', '4      4', '4      4', '4      4', '44444444'],
              'head.front': ['4 4  4 4', '        ', '11111111', ...blank(8, 5)],
              'head.right': ['44444444', '4      4', ...blank(8, 5), '4      4'],
              'head.left': ['44444444', '4      4', ...blank(8, 5), '4      4'],
              'head.back': ['44444444', '4      4', ...blank(8, 5), '44444444'],
              // Stone plates around the honeycomb heart.
              'body.front': ['43344334', '34e33433', '3      3', '3      3', '        ', '3      3', '3      3', '334e3343', '43e33e34', '3e4334e3', '33433433', '11111111'],
              // Boulder shoulders.
              'rightArm.front': ['5665', '4554', '3443', '1111', '    ', '    ', '    ', '    ', '    ', 'dddd', 'deed', 'cddc'],
              'rightArm.top': ['5665', '5775', '5775', '5665']
            }
          })
        },
        {
          name: "Queen's Herald",
          story: "The Queen's Herald wears her golden mask and folded glass wings, and when it raises its antennae the whole hive falls silent to listen.",
          build: hive({
            base: { head: '1', body: '1', rightArm: '1', rightLeg: '1' },
            inner: {
              'head.top': ['11111111', '11111111', '11111111', '111dd111', '11111111', '11111111', '11111111', 'dddddddd'],
              'head.front': ['11111111', '1d1ff1d1', '1eeeeee1', 'eK2ee2Ke', 'eeKeeKee', 'deeeeeed', '1deeeed1', '11deed11'],
              'head.right': ['11111111', 'dddddddd', '11111111', '11111111', 'cccccccc', '11111111', '11111111', '11111111'],
              'head.left': ['11111111', 'dddddddd', '11111111', '11111111', 'cccccccc', '11111111', '11111111', '11111111'],
              'head.back': ['11111111', 'dddddddd', '11111111', '11111111', 'cccccccc', '11111111', '11111111', '11111111'],
              'body.front': ['11d11d11', '111dd111', '1e1ee1e1', '1eeeeee1', '1eeffee1', '1eeeeee1', '11111111', 'dddddddd', '11111111', 'eeeeeeee', '11111111', 'eeeeeeee'],
              'body.back': ['11111111', '18811881', '8W7887W8', '87788778', '87688678', '18766781', '11877811', 'ddd88ddd', '11111111', 'eeeeeeee', '11111111', 'eeeeeeee'],
              'body.right': ['1111', '1111', '1111', '1111', '1111', '1111', '1111', 'dddd', '1111', 'eeee', '1111', 'eeee'],
              'body.left': ['1111', '1111', '1111', '1111', '1111', '1111', '1111', 'dddd', '1111', 'eeee', '1111', 'eeee'],
              'rightArm.front': ['eeee', 'deed', '1dd1', '1111', '1111', '1111', '1111', 'eeee', '1111', 'eeee', '1111', '2222'],
              'rightArm.right': ['eeee', 'dddd', '1cc1', '1111', '1111', '1111', '1111', 'dddd', '1111', 'dddd', '1111', '2222'],
              'rightArm.left': ['eeee', 'dddd', '1cc1', '1111', '1111', '1111', '1111', 'dddd', '1111', 'dddd', '1111', '2222'],
              'rightArm.back': ['eeee', 'dddd', '1cc1', '1111', '1111', '1111', '1111', 'dddd', '1111', 'dddd', '1111', '2222'],
              'rightArm.top': ['eeee', 'effe', 'effe', 'eeee'],
              'rightLeg.front': ['1111', '1111', '1111', '1111', '1111', '1dd1', 'deed', '1dd1', '1111', '1111', 'cccc', 'dddd'],
              'rightLeg.right': ['1111', '1111', '1111', '1111', '1111', '1cc1', 'cddc', '1cc1', '1111', '1111', 'cccc', 'cccc'],
              'rightLeg.left': ['1111', '1111', '1111', '1111', '1111', '1cc1', 'cddc', '1cc1', '1111', '1111', 'cccc', 'cccc'],
              'rightLeg.back': ['1111', '1111', '1111', '1111', '1111', '1cc1', 'cddc', '1cc1', '1111', '1111', 'cccc', 'cccc']
            },
            lift: ['body'],
            outer: {
              // Antennae curling back over the helmet, a raised rim round the mask.
              'head.top': ['ff    ff', 'e      e', ' e    e ', ' e    e ', '  e  e  ', '  e  e  ', '   ee   ', '        '],
              'head.front': ['11111111', '1      1', '1      1', ...blank(8, 5)],
              'head.right': ['11111111', 'dddddddd', ...blank(8, 6)],
              'head.left': ['11111111', 'dddddddd', ...blank(8, 6)],
              'head.back': ['11111111', 'dddddddd', '11111111', '11111111', 'cccccccc', '11111111', '1 1111 1', '        '],
              // Puffed gold shoulders and banded cuffs.
              'rightArm.front': ['eeee', 'deed', '1dd1', '    ', '    ', '    ', '    ', 'eeee', '1111', 'eeee', '    ', '    '],
              'rightArm.right': ['eeee', 'dddd', '1cc1', '    ', '    ', '    ', '    ', 'dddd', '1111', 'dddd', '    ', '    '],
              'rightArm.left': ['eeee', 'dddd', '1cc1', '    ', '    ', '    ', '    ', 'dddd', '1111', 'dddd', '    ', '    '],
              'rightArm.back': ['eeee', 'dddd', '1cc1', '    ', '    ', '    ', '    ', 'dddd', '1111', 'dddd', '    ', '    '],
              'rightArm.top': ['eeee', 'effe', 'effe', 'eeee'],
              // Gold knee guards and boot tops.
              'rightLeg.front': ['    ', '    ', '    ', '    ', '    ', '1dd1', 'deed', '1dd1', '    ', '    ', 'cccc', 'dddd'],
              'rightLeg.right': ['    ', '    ', '    ', '    ', '    ', '1cc1', 'cddc', '1cc1', '    ', '    ', 'cccc', 'cccc'],
              'rightLeg.left': ['    ', '    ', '    ', '    ', '    ', '1cc1', 'cddc', '1cc1', '    ', '    ', 'cccc', 'cccc'],
              'rightLeg.back': ['    ', '    ', '    ', '    ', '    ', '1cc1', 'cddc', '1cc1', '    ', '    ', 'cccc', 'cccc']
            }
          })
        }
      ]
    }
  ]
};
