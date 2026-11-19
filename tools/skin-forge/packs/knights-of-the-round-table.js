// Knights of the Round Table — figures of the medieval Arthurian legend. Existing (V1.0): King Arthur,
// Sir Lancelot, Sir Galahad. Pack look: flat colours, every face boxed by a 1-px darker border with one or two
// highlight pixels top-left, 1-px eyes under 2-px brows, one simple heraldic charge on the chest, a 2-row belt,
// overlay only for crowns, helmets and shoulder caps (86–89 % transparent). The builder below keeps that box style.

import { hex, shade } from '../color.js';

const F = (s, part, face, layer = 'inner') => s.face(part, face, layer);
const SIDES4 = ['front', 'right', 'back', 'left'];
const inner = (s, part) => SIDES4.map(f => F(s, part, f));
const outer = (s, part) => SIDES4.map(f => F(s, part, f, 'outer'));
// A material: base m, border d, highlight h.
const P = (m, d, h) => ({ m: hex(m), d: d ? hex(d) : shade(hex(m), 0.62), h: h ? hex(h) : shade(hex(m), 1.25) });

// The pack's box: 1-px darker border, flat fill, highlight pixel(s) top-left.
function box(f, C, { y0 = 0, y1 = f.h - 1, top = true, bottom = true, hl = true } = {}) {
  for (let y = y0; y <= y1; y++) for (let x = 0; x < f.w; x++) {
    const edge = x === 0 || x === f.w - 1 || (top && y === y0) || (bottom && y === y1);
    f.set(x, y, edge ? C.d : C.m);
  }
  const hy = y0 + (top ? 1 : 0);
  if (hl && f.w > 2 && y1 - hy >= 1) { f.set(1, hy, C.h); if (f.w >= 8) f.set(2, hy, C.h); }
  return f;
}
// A limb in segments (sleeve, gauntlet, …): [{ C, y0, y1 }], like the pack's 'npqn' / 'orro' rows.
function limb(s, part, segs) {
  for (const f of inner(s, part)) segs.forEach((g, i) => box(f, g.C, { y0: g.y0, y1: g.y1, top: g.top ?? i === 0, bottom: g.bottom ?? i === segs.length - 1, hl: g.hl ?? i === 0 }));
  box(F(s, part, 'top'), segs[0].C, { hl: false });
  F(s, part, 'bottom').fill(segs.at(-1).C.d);
}
const torso = (s, C) => s.faces('body').forEach(f => box(f, C));
function headSkin(s, SK) { s.faces('head').forEach(f => box(f, SK, { hl: false })); box(F(s, 'head', 'bottom'), SK); }
// Hair on the inner head: top, a few rows round the sides, or long (sides and back full).
function hair(s, H, { front = 2, side = 2, back = 3, long = false, frame = 0 } = {}) {
  box(F(s, 'head', 'top'), H, { hl: false });
  const n = { front, right: long ? 8 : side, left: long ? 8 : side, back: long ? 8 : back };
  for (const [face, rows] of Object.entries(n)) {
    const f = F(s, 'head', face);
    if (long && face !== 'front') { box(f, H, { hl: false }); continue; }
    for (let y = 0; y < rows; y++) f.row(y, y === 0 ? H.d : H.m);
  }
  const f = F(s, 'head', 'front');
  for (let y = front; y < Math.min(8, front + frame); y++) { f.set(0, y, H.d); f.set(7, y, H.d); }
}
function belt(s, y, C, buckle) {
  for (const f of inner(s, 'body')) { f.row(y, C.m); f.row(y + 1, C.d); }
  if (buckle) F(s, 'body', 'front').paint(['...bb...', '...bb...'], { b: hex(buckle) }, { y });
}
// Shoulder caps on the overlay, like Arthur's and Lancelot's.
function pauldrons(s, C, edge) {
  box(F(s, 'rightArm', 'top', 'outer'), C, { hl: false });
  for (const f of outer(s, 'rightArm')) { f.row(0, C.h); f.row(1, edge || C.d); }
}
const ringO = (s, part, y, c) => outer(s, part).forEach(f => f.row(y, c));
const both = (s, part, face, rows, map, at) => { F(s, part, face).paint(rows, map, at); };

const SKIN = { // pack skin tones (border, base, highlight)
  fair: P('#e6b994', '#b88a66', '#f4d2b4'),
  warm: P('#e0b28a', '#b4876a', '#f0c8a6'),
  old: P('#d8ad88', '#a88262', '#e8c6a6'),
  pale: P('#eecfba', '#bc9a84', '#f8e4d6'),
  pearl: P('#f2dccb', '#c2a896', '#fbeee4'),
  rose: P('#f0cdb0', '#c09a80', '#fae2cc')
};
const GOLD = P('#dcb43c', '#a07820', '#f5d878');
const STEEL = P('#9ea4ae', '#5a5f68', '#c8cdd4');
const SLIT = hex('#16161c');

export default {
  style: 'accent',
  updates: [
    {
      title: 'The Grail Quest',
      note: 'Galahad does not ride alone: Sir Percival from the Welsh woods, steadfast Sir Bors and the wounded Fisher King who keeps the Grail castle join the quest for the Holy Grail.',
      skins: [
        {
          name: 'Sir Percival',
          story: 'Raised in the Welsh woods far from any court, he rode to Camelot with a hunting spear and became one of the three knights to see the Holy Grail.',
          build: ({ Skin }) => {
            const s = new Skin();
            const SK = SKIN.fair, H = P('#a87a48', '#6e4c2a', '#caa070');
            headSkin(s, SK); hair(s, H, { front: 2, side: 3, back: 4 });
            F(s, 'head', 'front').paint(['........', '........', 'h.h....h', '.bb..bb.', '..E..E..', '.f....f.', '...mm...'],
              { h: H.m, b: H.d, E: hex('#3c6ec8'), f: shade(SK.m, 0.86), m: hex('#9a5a48') });
            // Shaggy hair on the overlay
            F(s, 'head', 'front', 'outer').paint(['HHHHHHHH', 'HH....HH'], { H: H.m });
            for (const side of ['right', 'left']) F(s, 'head', side, 'outer').paint(['HHHHHHHH', 'HHH..HHH', '.H....H.'].map(r => side === 'right' ? r : r), { H: H.m });
            F(s, 'head', 'back', 'outer').paint(['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '.HH..HH.'], { H: H.m });
            F(s, 'head', 'top', 'outer').paint(['HHHHHHHH', 'h.h..h.H', '.h..h...', '...h..h.', 'h.....h.'], { h: H.h, H: H.m });
            // Purple surcoat semé of gold crosslets, leather belt
            const PU = P('#6a2f96', '#3e1a5c', '#9256c0');
            torso(s, PU);
            const semé = ['........', '........', '..g.....', '.gGg....', '..g..g..', '....gGg.', '..g..g..', '.gGg....', '..g.....'];
            both(s, 'body', 'front', semé, { g: GOLD.m, G: GOLD.h });
            both(s, 'body', 'back', semé, { g: GOLD.d, G: GOLD.m });
            belt(s, 9, P('#6a4426', '#3e2614'), '#dcb43c');
            // The hunting spear on his back
            const W = P('#8a5a30');
            F(s, 'body', 'back', 'outer').paint(['.....w..', '.....w..', '.....w..', '.....w..', '.....w..', '.....w..', '.....w..', '.....w..', '.....w..', '.....w..', '.....d..'], { w: W.m, d: W.d });
            F(s, 'head', 'back', 'outer').paint(['........', '........', '........', '........', '.....S..', '....SSS.', '.....S..', '.....w..'], { S: STEEL.h, w: W.m });
            // Arms: purple sleeves, leather gauntlets, steel shoulder caps
            const GL = P('#7a5030', '#4a2f1a', '#9a6a42');
            limb(s, 'rightArm', [{ C: PU, y0: 0, y1: 7 }, { C: GL, y0: 8, y1: 11 }]);
            pauldrons(s, STEEL);
            ringO(s, 'rightArm', 8, GL.h);
            // Legs: buff riding breeches, tall boots
            const BR = P('#b08c5c', '#745a38', '#cca878'), BT = P('#5a3c24', '#33221a', '#7a5434');
            limb(s, 'rightLeg', [{ C: BR, y0: 0, y1: 6 }, { C: BT, y0: 7, y1: 11 }]);
            ringO(s, 'rightLeg', 7, BT.h);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Sir Bors',
          story: 'Steadfast Sir Bors bears a red bend on ermine, and of the three Grail knights he alone came home to Camelot to tell the tale.',
          build: ({ Skin }) => {
            const s = new Skin();
            const ST = P('#a8aeb8', '#5c616b', '#d4d8de'), RD = P('#c8323a', '#82191f', '#e8606a');
            // Closed great helm
            s.faces('head').forEach(f => box(f, ST, { hl: false }));
            F(s, 'head', 'front').paint(['........', '.hh.....', '........', 'KKKLLKKK', '...LL...', '..KLLK..', '..KLLK..'], { h: ST.h, K: SLIT, L: ST.h });
            F(s, 'head', 'right').paint(['........', '........', '........', '....KKKK', '........', '.....K..', '.....K..'], { K: SLIT });
            F(s, 'head', 'left').paint(['........', '........', '........', 'KKKK....', '........', '..K.....', '..K.....'], { K: SLIT });
            box(F(s, 'head', 'top', 'outer'), ST, { hl: false });
            F(s, 'head', 'top', 'outer').paint(['...RR...', '...RR...', '...RR...', '...RR...', '...RR...', '...RR...', '...RR...', '...RR...'], { R: RD.m });
            for (const f of outer(s, 'head')) f.row(0, ST.h);
            F(s, 'head', 'front', 'outer').paint(['...RR...', '...rr...'], { R: RD.m, r: RD.d });
            F(s, 'head', 'back', 'outer').paint(['...RR...', '...RR...', '...rr...'], { R: RD.m, r: RD.d });
            // Ermine surcoat with a red bend
            const EW = P('#f0efe9', '#b4b2ac', '#ffffff');
            torso(s, EW);
            const bend = ['........', '.RR...k.', '.RRR....', '..RRR.k.', '...RRR..', '.k..RRR.', '.....RR.', '..k.....', '........'];
            both(s, 'body', 'front', bend, { R: RD.m, k: SLIT });
            both(s, 'body', 'back', bend.map(r => [...r].reverse().join('')), { R: RD.d, k: SLIT });
            belt(s, 9, P('#4a3020', '#2c1c12'), '#c8cdd4');
            // Arms: plate, dark gauntlets, ailettes in his colours, elbow cops
            const ST2 = P('#7c828c', '#464a52', '#a0a6ae');
            limb(s, 'rightArm', [{ C: ST, y0: 0, y1: 8 }, { C: ST2, y0: 9, y1: 11 }]);
            pauldrons(s, EW, RD.m);
            ringO(s, 'rightArm', 5, ST.h);
            // Legs: plate, sabatons, knee cops
            limb(s, 'rightLeg', [{ C: ST, y0: 0, y1: 8 }, { C: ST2, y0: 9, y1: 11 }]);
            F(s, 'rightLeg', 'front', 'outer').paint(['....', '....', '....', '....', '.hh.', 'HHHH'], { h: ST.h, H: ST.m });
            ringO(s, 'rightLeg', 9, ST2.h);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'The Fisher King',
          story: 'Wounded and unable to ride, the old king of the Grail castle passes his days fishing on the river, waiting for the knight who will ask the right question.',
          build: ({ Skin }) => {
            const s = new Skin();
            const SK = SKIN.old, GR = P('#9c9ca2', '#62626a', '#c6c6cc'), SV = P('#dde2ea', '#8a909a', '#ffffff');
            headSkin(s, SK); hair(s, GR, { front: 2, long: true, frame: 6 });
            F(s, 'head', 'front').paint(['........', '........', '.gggggg.', '.bb..bb.', '..E..E..', '.s.gg.s.', '.gg..gg.', '.gggggg.'],
              { g: GR.m, b: GR.d, E: hex('#4a6a9a'), s: shade(SK.m, 0.85) });
            F(s, 'head', 'front').paint(['........', '........', '........', '........', '........', '........', '...mm...'], { m: GR.d });
            // Silver crown with a sapphire
            const crownRow = ['S..SS..S', 'SSSSSSSS'];
            for (const f of outer(s, 'head')) f.paint(crownRow, { S: SV.m });
            F(s, 'head', 'front', 'outer').paint(['S..ss..S', 'SSSBBSSS'], { S: SV.h, s: SV.h, B: hex('#2a5ad0') });
            F(s, 'head', 'back', 'outer').paint(['........', '........', 'GGGGGGGG', 'G.GG.GG.', '.G..G..G'], { G: GR.m });
            // Sea-green robe with the silver fish, beard over the collar
            const TL = P('#22807f', '#124a4c', '#4aa8a6');
            torso(s, TL);
            F(s, 'body', 'front').paint(['.gggggg.', '..gggg..', '........', '........', '..SS..S.', '.SkSSSS.', '.SSSSSS.', '..SS..S.', '........', 'cccccccc', '...cC...'],
              { g: GR.m, S: SV.m, k: TL.d, c: SV.m, C: SV.d });
            F(s, 'body', 'back').paint(['........', '........', '........', '........', '.S..SS..', '.SSSSkS.', '.SSSSSS.', '.S..SS..', '........', 'cccccccc'], { S: SV.d, k: TL.d, c: SV.d });
            F(s, 'body', 'front', 'outer').paint(['.GGGGGG.', '..GGGG..'], { G: GR.h });
            // White fur mantle over the shoulders
            const FU = P('#ece8e0', '#aaa69e', '#ffffff');
            for (const f of outer(s, 'body')) f.row(0, FU.m);
            F(s, 'body', 'top', 'outer').fill(FU.m);
            box(F(s, 'rightArm', 'top', 'outer'), FU, { hl: false });
            for (const f of outer(s, 'rightArm')) f.row(0, FU.m);
            // Arms: robe sleeves, silver cuffs, bare hands
            limb(s, 'rightArm', [{ C: TL, y0: 0, y1: 8 }, { C: SV, y0: 9, y1: 9 }, { C: SK, y0: 10, y1: 11 }]);
            ringO(s, 'rightArm', 9, SV.h);
            // Legs: robe to the ankle, silver hem, dark shoes
            limb(s, 'rightLeg', [{ C: TL, y0: 0, y1: 8 }, { C: SV, y0: 9, y1: 9 }, { C: P('#3a2c22', '#221810'), y0: 10, y1: 11 }]);
            ringO(s, 'rightLeg', 9, SV.m);
            s.mirrorLimbs();
            return s;
          }
        }
      ]
    },
    {
      title: 'The Enchanters of Avalon',
      note: 'Magic comes to Camelot: Merlin the enchanter who raised the boy king, his rival Morgan le Fay, and the Lady of the Lake who gave Arthur the sword Excalibur.',
      skins: [
        {
          name: 'Merlin',
          story: 'The old enchanter who foresaw the Round Table long before it was built, his beard white as frost and his robe dark as the night sky he reads.',
          build: ({ Skin }) => {
            const s = new Skin();
            const SK = SKIN.old, WB = P('#ecece8', '#b4b4b0', '#ffffff'), HD = P('#2a3482', '#161c4c', '#4a56b0');
            const SV = P('#d4dae2', '#8c96a4', '#f4f6f9');
            headSkin(s, SK);
            for (const face of ['top', 'right', 'left', 'back']) box(F(s, 'head', face), HD, { hl: false });
            F(s, 'head', 'front').paint(['DDDDDDDD', 'HHHssHHH', 'D......D', 'DWW..WWD', 'D.E..E.D', 'D.WWWW.D', 'DWWwwWWD', 'DWWWWWWD'],
              { D: HD.d, H: HD.m, s: GOLD.h, W: WB.m, w: WB.d, E: hex('#5ab4f0') });
            // Deep hood on the overlay, a gold star on the brow
            box(F(s, 'head', 'top', 'outer'), HD, { hl: false });
            F(s, 'head', 'front', 'outer').paint(['HHHssHHH', 'H......H', 'H......H', 'H......H'], { H: HD.m, s: GOLD.m });
            for (const side of ['right', 'left']) F(s, 'head', side, 'outer').paint(['HHHHHHHH', 'HHHHHHHH', 'HHHHHHH.', 'HHHHHH..'].map(r => side === 'right' ? [...r].reverse().join('') : r), { H: HD.m });
            F(s, 'head', 'back', 'outer').paint(['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '.HHHHHH.', '..HHHH..'], { H: HD.d });
            // Midnight robe: the long beard over the chest, moon and star
            const RB = P('#2c3a8c', '#18204e', '#4c5cb4');
            torso(s, RB);
            F(s, 'body', 'front').paint(['.WWWWWW.', '.WWwWWW.', '.WwWWwW.', '..WWWW..', '..WwWW..', '...WW...', '...W....', '..CC.s..', '.C..sSs.', '..CC.s..', '......s.'],
              { W: WB.m, w: WB.d, C: GOLD.m, s: SV.m, S: SV.h });
            F(s, 'body', 'back').paint(['........', '........', '..s.....', '.sSs..C.', '..s..CC.', '.....CC.', '..s...C.', '........', '.s....s.', '...s....'], { C: GOLD.d, s: SV.d, S: SV.m });
            F(s, 'body', 'front', 'outer').paint(['.WWWWWW.', '..WWWW..', '..W..W..', '...WW...'], { W: WB.h });
            // Arms: wide sleeves with silver trim, bare hands
            limb(s, 'rightArm', [{ C: RB, y0: 0, y1: 9 }, { C: SK, y0: 10, y1: 11 }]);
            ringO(s, 'rightArm', 8, RB.m); ringO(s, 'rightArm', 9, SV.m);
            F(s, 'rightArm', 'top', 'outer').fill(RB.d);
            for (const f of outer(s, 'rightArm')) f.row(0, RB.d);
            // Legs: robe to the floor with a silver hem, soft dark shoes
            limb(s, 'rightLeg', [{ C: RB, y0: 0, y1: 9 }, { C: P('#2a2222', '#161010'), y0: 10, y1: 11 }]);
            ringO(s, 'rightLeg', 9, SV.m);
            F(s, 'rightLeg', 'front').paint(['....', '....', '....', '.s..', '....', '..s.', '....', '.s..'], { s: SV.d });
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Morgan le Fay',
          slim: true,
          story: "Arthur's half-sister and Merlin's best pupil, the enchantress of Avalon wears a golden crescent and a gown as green as the isle she rules.",
          build: ({ Skin }) => {
            const s = new Skin({ slim: true });
            const SK = SKIN.pale, HR = P('#3a2c48', '#18121e', '#5e4a72'), GN = P('#1f6e3c', '#0f3e20', '#3c9a5e'), BK = P('#2a2430', '#141016', '#463e50');
            headSkin(s, SK); hair(s, HR, { front: 2, long: true, frame: 6 });
            F(s, 'head', 'front').paint(['........', '...HH...', '........', '.bb..bb.', '.wE..Ew.', '........', '...ll...'],
              { H: SK.m, b: HR.d, E: hex('#b45ae0'), w: hex('#f4f0f6'), l: hex('#8c2c5a') });
            // Golden crescent circlet
            F(s, 'head', 'front', 'outer').paint(['.g....g.', '..gggg..', 'GGGGGGGG'], { g: GOLD.h, G: GOLD.m });
            for (const side of ['right', 'left', 'back']) F(s, 'head', side, 'outer').paint(['........', '........', 'GGGGGGGG'], { G: GOLD.d });
            // Long raven hair on the overlay
            for (const side of ['right', 'left']) F(s, 'head', side, 'outer').paint(['HHHHHHHH', 'HHHHHHHH', '........', 'H.HH.HH.', 'HHHHHHHH', 'H.H.HH.H', '.H....H.'], { H: HR.m });
            F(s, 'head', 'back', 'outer').paint(['HHHHHHHH', 'HHHHHHHH', '........', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'H.HHHH.H', '.H.HH.H.'], { H: HR.m });
            F(s, 'head', 'front', 'outer').paint(['H......H', 'H......H', '........', 'H......H', 'H......H'], { H: HR.m });
            // Green gown, black bodice laced with gold, golden girdle
            torso(s, GN);
            F(s, 'body', 'front').paint(['..ssss..', '.kkkkkk.', '.kgkkgk.', '.kkggkk.', '.kgkkgk.', '.kkggkk.', 'GGGGGGGG', '....g...', '....g...', '...g.g..', '....g...'],
              { s: SK.m, k: BK.m, g: GOLD.m, G: GOLD.d });
            F(s, 'body', 'back').paint(['........', '.kkkkkk.', '.kkkkkk.', '.kkkkkk.', '.kkkkkk.', '.kkkkkk.', 'GGGGGGGG'], { k: BK.m, G: GOLD.d });
            F(s, 'body', 'front', 'outer').paint(['........', '........', '........', '........', '........', '........', 'GGGGGGGG'], { G: GOLD.m });
            // Arms: green sleeves, black hanging cuffs, pale hands
            limb(s, 'rightArm', [{ C: GN, y0: 0, y1: 7 }, { C: BK, y0: 8, y1: 10 }, { C: SK, y0: 11, y1: 11 }]);
            ringO(s, 'rightArm', 8, GOLD.m); ringO(s, 'rightArm', 9, BK.m); ringO(s, 'rightArm', 10, BK.d);
            // Legs: gown to the floor, black hem
            limb(s, 'rightLeg', [{ C: GN, y0: 0, y1: 8 }, { C: BK, y0: 9, y1: 11 }]);
            ringO(s, 'rightLeg', 9, GOLD.d);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'The Lady of the Lake',
          slim: true,
          story: 'From beneath the still water of the lake she raised the sword Excalibur for the young king, and one day she will take it back.',
          build: ({ Skin }) => {
            const s = new Skin({ slim: true });
            const SK = SKIN.pearl, HR = P('#ead9a2', '#b09c5c', '#fff4d0'), LB = P('#6cb4dc', '#3a7aa4', '#a8d8f0'), FO = P('#eef8fc', '#a8d0e4', '#ffffff');
            const SV = P('#d4dae2', '#8c96a4', '#f4f6f9');
            headSkin(s, SK); hair(s, HR, { front: 2, long: true, frame: 6 });
            F(s, 'head', 'front').paint(['........', '........', '........', '.bb..bb.', '..E..E..', '........', '...ll...'],
              { b: HR.d, E: hex('#2ab4c8'), l: hex('#d07a8a') });
            // Silver circlet with a pearl, flowing pale hair
            F(s, 'head', 'front', 'outer').paint(['H......H', 'HSSSSSSH', 'H..pp..H', 'H......H', 'H......H', 'H......H'], { H: HR.m, S: SV.m, p: hex('#ffffff') });
            for (const side of ['right', 'left', 'back']) F(s, 'head', side, 'outer').paint(['HHHHHHHH', 'SSSSSSSS', 'HHHHHHHH', 'H.HHH.HH', 'HH.H.HH.', '.H...H..'], { H: HR.m, S: SV.d });
            // Lake-blue gown: Excalibur rising from the water
            torso(s, LB);
            F(s, 'body', 'front').paint(['........', '...WW...', '...Wv...', '...Wv...', '...Wv...', '...Wv...', '.GGGGGG.', '...bb...', '...GG...', '.w...w..', 'w.w.w.ww', 'ffffffff'],
              { W: hex('#f2f6fa'), v: hex('#a8b4c2'), G: GOLD.m, b: hex('#2c4a8a'), w: FO.m, f: FO.d });
            F(s, 'body', 'back').paint(['........', '........', '........', '........', '........', '........', '........', '........', '........', '..w...w.', 'w.ww.w.w', 'ffffffff'], { w: FO.m, f: FO.d });
            F(s, 'body', 'front', 'outer').paint(['........', '...WW...'], { W: hex('#ffffff') });
            // Arms: bare, with silver arm rings
            limb(s, 'rightArm', [{ C: LB, y0: 0, y1: 2 }, { C: SK, y0: 3, y1: 11 }]);
            F(s, 'rightArm', 'top').fill(LB.m);
            ringO(s, 'rightArm', 2, FO.m); ringO(s, 'rightArm', 8, SV.m);
            s.band('rightArm', 8, SV.d);
            // Legs: gown to the floor, foam on the hem
            limb(s, 'rightLeg', [{ C: LB, y0: 0, y1: 11 }]);
            for (const f of inner(s, 'rightLeg')) f.paint(['....', '....', '....', '....', '....', '....', '....', '.w..', 'w..w', '.ww.', 'wwww', 'ffff'], { w: FO.m, f: FO.d });
            ringO(s, 'rightLeg', 10, FO.h);
            s.mirrorLimbs();
            return s;
          }
        }
      ]
    },
    {
      title: 'The New Year Feast',
      note: 'At the New Year feast a giant all in green rides into the hall of Camelot with a challenge, Sir Gawain rises to answer it, and Queen Guinevere watches from the high table.',
      skins: [
        {
          name: 'Sir Gawain',
          story: "The king's nephew answered the Green Knight's challenge, and he still wears the gold pentangle on red and the green girdle he brought back from the Green Chapel.",
          build: ({ Skin }) => {
            const s = new Skin();
            const SK = SKIN.warm, HR = P('#c87a34', '#8a4c1c', '#e8a058'), RD = P('#b4232a', '#741418', '#d8545a');
            const GG = P('#3c9a4a', '#226030', '#64c070'), BT = P('#4a3426', '#2a1e16', '#6a4c36');
            headSkin(s, SK); hair(s, HR, { front: 2, side: 3, back: 4 });
            F(s, 'head', 'front').paint(['........', '........', '........', '.bb..bb.', 'B.E..E.B', 'BB....BB', 'BBBmmBBB', '.BBBBBB.'],
              { b: HR.d, B: HR.m, E: hex('#5a7ab0'), m: hex('#8a3a2a') });
            // Steel nasal helm with a gold band
            const ST = STEEL;
            for (const face of ['top']) box(F(s, 'head', face), ST, { hl: false });
            for (const f of outer(s, 'head')) f.paint(['SSSSSSSS', 'GGGGGGGG'], { S: ST.m, G: GOLD.m });
            F(s, 'head', 'front', 'outer').paint(['SSShSSSS', 'GGGggGGG', '...ss...', '...ss...'], { S: ST.m, h: ST.h, G: GOLD.m, g: GOLD.h, s: ST.h });
            box(F(s, 'head', 'top', 'outer'), ST, { hl: true });
            // Red surcoat with the gold pentangle, the green girdle knotted at his side
            torso(s, RD);
            const star = ['........', '...GG...', '...GG...', '.GGGGGG.', '..GrrG..', '..GrrG..', '.GG..GG.', '.G....G.'];
            both(s, 'body', 'front', star, { G: GOLD.m, r: RD.m });
            both(s, 'body', 'back', star, { G: GOLD.d, r: RD.m });
            belt(s, 9, GG);
            F(s, 'body', 'front', 'outer').paint(['........', '........', '........', '........', '........', '........', '........', '........', '........', 'GGGGGGGG', '.....gg.', '.....g..'], { G: GG.m, g: GG.h });
            // Arms: red sleeves, steel gauntlets, steel shoulder caps edged in gold
            limb(s, 'rightArm', [{ C: RD, y0: 0, y1: 7 }, { C: ST, y0: 8, y1: 11 }]);
            pauldrons(s, ST, GOLD.m);
            ringO(s, 'rightArm', 8, ST.h);
            // Legs: steel greaves with gold knee cops, dark boots
            limb(s, 'rightLeg', [{ C: ST, y0: 0, y1: 8 }, { C: BT, y0: 9, y1: 11 }]);
            F(s, 'rightLeg', 'front', 'outer').paint(['....', '....', '....', '....', '.gg.', 'GGGG'], { g: GOLD.h, G: GOLD.m });
            ringO(s, 'rightLeg', 9, BT.h);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'The Green Knight',
          story: 'A giant green from beard to boots rode into the New Year feast with a holly bough and a great axe, and offered any knight one free blow.',
          build: ({ Skin }) => {
            const s = new Skin();
            const SK = P('#98c464', '#5e8a38', '#b8dc88'), HR = P('#2e7a2a', '#164a16', '#4ea040'), TN = P('#2f8c3c', '#18561f', '#55b060');
            headSkin(s, SK); hair(s, HR, { front: 2, side: 5, back: 8, frame: 3 });
            F(s, 'head', 'front').paint(['........', '........', '........', '.bb..bb.', '.wE..Ew.', 'HHH..HHH', 'HHHmmHHH', 'HHHHHHHH'],
              { b: HR.d, H: HR.m, E: hex('#d02424'), w: hex('#f2f0e4'), m: hex('#5a1a1a') });
            // Wild green mane and beard on the overlay
            F(s, 'head', 'front', 'outer').paint(['HHHHHLlH', 'H....rLH', 'H......H', '........', '........', '........', 'HH....HH', '.HHHHHH.'], { H: HR.m, L: hex('#0f4a18'), l: hex('#2a7a30'), r: hex('#e02a30') });
            for (const side of ['right', 'left']) F(s, 'head', side, 'outer').paint(['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HH.HHH.H', 'H.HH.HHH', '.H..H..H'], { H: HR.m });
            F(s, 'head', 'back', 'outer').paint(['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'H.HHHH.H', 'HHH.HHHH', '.H.HH.H.'], { H: HR.m });
            // Green tunic: beard spills over the chest, holly bough, gold belt
            torso(s, TN);
            F(s, 'body', 'front').paint(['.HHHHHH.', '..HHHH..', '...HH...', '........', '.LL..LL.', '..LrrL..', '...rr...', '..r.....', '........'],
              { H: HR.m, L: hex('#0f4a18'), r: hex('#d8262c') });
            F(s, 'body', 'front', 'outer').paint(['.HHHHHH.', '..H..H..'], { H: HR.m });
            belt(s, 9, GOLD, '#fff0a0');
            // The great axe on his back
            const AX = P('#9cc4a8', '#5a8a6a', '#d4ece0'), WD = P('#6a4a2a');
            F(s, 'body', 'back', 'outer').paint(['.AAAA...', 'AAAAw...', 'aAAAw...', '.aa.w...', '....w...', '....w...', '....w...', '....w...', '....w...', '....w...', '....d...'], { A: AX.m, a: AX.d, w: WD.m, d: WD.d });
            // Arms: green sleeves, gold armbands, green hands
            limb(s, 'rightArm', [{ C: TN, y0: 0, y1: 8 }, { C: SK, y0: 9, y1: 11 }]);
            s.band('rightArm', 3, GOLD.m);
            ringO(s, 'rightArm', 3, GOLD.h);
            F(s, 'rightArm', 'top', 'outer').fill(TN.d);
            for (const f of outer(s, 'rightArm')) f.row(0, TN.d);
            // Legs: green hose, tall boots with gold spurs
            const HO = P('#256e30', '#14421a', '#3c9048'), BT = P('#1c3e1c', '#0e220e', '#2e5a2e');
            limb(s, 'rightLeg', [{ C: HO, y0: 0, y1: 6 }, { C: BT, y0: 7, y1: 11 }]);
            ringO(s, 'rightLeg', 7, GOLD.m);
            F(s, 'rightLeg', 'back', 'outer').paint(['....', '....', '....', '....', '....', '....', '....', '....', '....', '....', '.gg.'], { g: GOLD.h });
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Queen Guinevere',
          slim: true,
          story: 'The queen of Camelot loves the month of May, and on the first morning of it she rides out with her court crowned in gold and dressed in rose.',
          build: ({ Skin }) => {
            const s = new Skin({ slim: true });
            const SK = SKIN.rose, HR = P('#c06a30', '#7e3e18', '#e0904e'), RO = P('#c84e7c', '#86284e', '#e88aac'), WH = P('#f6f2ee', '#c4bcb4', '#ffffff');
            headSkin(s, SK); hair(s, HR, { front: 2, long: true, frame: 6 });
            F(s, 'head', 'front').paint(['........', '........', '........', '.bb..bb.', '.wE..Ew.', '.p....p.', '...ll...'],
              { b: HR.d, E: hex('#3c8c50'), w: hex('#f6f2ee'), p: hex('#f0b0a8'), l: hex('#c0405a') });
            // Gold crown with rubies
            for (const f of outer(s, 'head')) f.paint(['G.G..G.G', 'GGGGGGGG'], { G: GOLD.d });
            F(s, 'head', 'front', 'outer').paint(['G.GggG.G', 'GrGGGGrG'], { G: GOLD.m, g: GOLD.h, r: hex('#d02a50') });
            // Long auburn hair on the overlay
            for (const side of ['right', 'left']) F(s, 'head', side, 'outer').paint(['........', '........', 'HHHHHHHH', 'HH.HHH.H', 'HHHHHHHH', 'H.HH.HH.', '.H..H..H'], { H: HR.m });
            F(s, 'head', 'back', 'outer').paint(['........', '........', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'H.HHHH.H', '.HH..HH.'], { H: HR.m });
            F(s, 'head', 'front', 'outer').paint(['........', '........', 'H......H', 'H......H', 'H......H'], { H: HR.m });
            // Rose gown with a white rose, gold girdle
            torso(s, RO);
            F(s, 'body', 'front').paint(['..ssss..', '........', '...ww...', '.wwGGww.', '.wwGGww.', '...ww...', '..g..g..', 'GGGGGGGG', '........', '........', '........', 'WWWWWWWW'],
              { s: SK.m, w: WH.m, G: GOLD.m, g: hex('#3c8c50'), W: WH.d });
            F(s, 'body', 'back').paint(['........', '........', '........', '........', '........', '........', '........', 'GGGGGGGG'], { G: GOLD.d });
            F(s, 'body', 'front', 'outer').paint(['.G....G.', '........', '........', '........', '........', '........', '........', 'GGGGGGGG'], { G: GOLD.m });
            // Arms: rose sleeves, gold cuffs, long white hanging sleeves
            limb(s, 'rightArm', [{ C: RO, y0: 0, y1: 8 }, { C: GOLD, y0: 9, y1: 9 }, { C: SK, y0: 10, y1: 11 }]);
            ringO(s, 'rightArm', 8, WH.m); ringO(s, 'rightArm', 9, WH.m); ringO(s, 'rightArm', 10, WH.d);
            // Legs: gown to the floor, white hem, gold slippers
            limb(s, 'rightLeg', [{ C: RO, y0: 0, y1: 9 }, { C: GOLD, y0: 10, y1: 11 }]);
            s.band('rightLeg', 9, WH.m);
            ringO(s, 'rightLeg', 9, WH.m);
            s.mirrorLimbs();
            return s;
          }
        }
      ]
    }
  ]
};
