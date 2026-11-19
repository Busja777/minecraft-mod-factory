// Crusaders Pack — medieval crusader knights and their opponents. Existing: Templar Knight, Knight of Malta
// (V1.0), Teutonic Knight, Knight of Santiago, Crusader Sergeant, Saracen, Crusader King, Hashshashin (V1.1).
// Pack look: 1-px checker chainmail, glossy radially shaded helms with a black eye slit, cloth tabards with a
// cross over mail, sparse overlay (belt, cuffs, knee cops). New skins add other orders, the sergeants and
// archers on the walls, and riders from the East — each with its own helmet, heraldry and colours.

import { hex, shade, ramp } from '../color.js';

const R = (c, n = 5, sp = 0.45) => ramp(hex(c), n, sp);
const F = (s, part, face, layer = 'inner') => s.face(part, face, layer);
const SLIT = [18, 18, 22, 255];

// ── Materials ───────────────────────────────────────────────────────────────────────────────
function checker(f, a, b, only) {
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (!only || only(x, y)) f.set(x, y, (x + y) % 2 ? a : b);
  return f;
}
// Chainmail like the pack: 1-px checker of two greys.
const mail = (f, base, only) => { const M = R(base, 4, 0.4); return checker(f, M[1], M[2], only); };
const mailPart = (s, part, base) => s.faces(part).forEach(f => mail(f, base));

// Plain cloth with edge darkening and a lit top row.
function cloth(f, C, { x0 = 0, x1 = f.w - 1, y0 = 0, y1 = f.h - 1 } = {}) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let c = C[2];
    if (x === x0 || x === x1) c = C[1];
    if (y === y0) c = C[3];
    if (y === y1) c = C[1];
    f.set(x, y, c);
  }
  return f;
}

// Quilted gambeson: diamond (lozenge) stitching, each diamond lit at the top.
function quilt(f, Q, only) {
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (only && !only(x, y)) continue;
    const a = (x + y) % 4, b = ((x - y) % 4 + 4) % 4;
    let c = a === 0 || b === 0 ? Q[1] : (a === 1 || b === 1) && y % 4 < 2 ? Q[3] : Q[2];
    f.set(x, y, c);
  }
  return f;
}

// Lamellar: small upright plates in staggered rows, laced together.
function lamellar(f, L, lace, only) {
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (only && !only(x, y)) continue;
    const band = Math.floor(y / 3), r = y % 3, off = band % 2;
    let c = r === 0 ? L[4] : r === 1 ? L[3] : L[1];
    if ((x + off) % 2 === 0 && r !== 0) c = L[2];
    if (r === 2 && (x + off) % 4 === 1) c = lace;
    f.set(x, y, c);
  }
  return f;
}

// Scale armour: overlapping round scales, light top, dark lower edge.
function scales(f, G, only) {
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (only && !only(x, y)) continue;
    const off = Math.floor(y / 2) % 2, sx = (x + off) % 2, sy = y % 2;
    f.set(x, y, sy === 0 ? (sx === 0 ? G[4] : G[3]) : (sx === 0 ? G[2] : G[0]));
  }
  return f;
}

// Glossy helm shading like the pack: bright centre, darker rings, darkest corners.
function gloss(f, H, dim = 0) {
  const cx = (f.w - 1) / 2, cy = (f.h - 1) / 2;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const ring = Math.min(3, Math.floor(Math.max(Math.abs(x - cx), Math.abs(y - cy))));
    let i = [5, 4, 3, 2][ring];
    if ((x === 0 || x === f.w - 1) && (y === 0 || y === f.h - 1)) i = 1;
    f.set(x, y, H[Math.max(0, i - dim)]);
  }
  return f;
}
function helmShell(s, steel) {
  const H = R(steel, 6, 0.6);
  gloss(F(s, 'head', 'front'), H); gloss(F(s, 'head', 'top'), H);
  gloss(F(s, 'head', 'right'), H, 1); gloss(F(s, 'head', 'left'), H, 1); gloss(F(s, 'head', 'back'), H, 2);
  F(s, 'head', 'bottom').fill(H[0]);
  return H;
}
const HEAD_SIDES = ['right', 'left', 'back'];
const outerSides = (s, part) => ['front', 'right', 'left', 'back'].map(f => F(s, part, f, 'outer'));

// Steel dome over rows 0..rows-1 (open helmets), shaded top-lit.
function dome(s, steel, rows = 3) {
  const H = R(steel, 6, 0.6);
  gloss(F(s, 'head', 'top'), H);
  for (const side of ['front', ...HEAD_SIDES]) {
    const f = F(s, 'head', side);
    for (let y = 0; y < rows; y++) for (let x = 0; x < 8; x++) {
      const mid = x > 1 && x < 6;
      f.set(x, y, y === rows - 1 ? H[1] : y === 0 ? H[mid ? 4 : 3] : H[mid ? 5 : 3]);
    }
  }
  return H;
}

// Body faces: front/back tabard (or a function per pixel), mail sides.
function tabard(s, { cloth: c1, cloth2, mailC, hem = true }) {
  const A = R(c1, 5, 0.35), B = cloth2 ? R(cloth2, 5, 0.35) : A;
  for (const side of ['front', 'back']) {
    const f = F(s, 'body', side);
    mail(f, mailC);
    for (let y = 0; y < 12; y++) for (let x = 1; x <= 6; x++) {
      const C = (side === 'front' ? x >= 4 : x < 4) ? B : A;
      let c = C[2];
      if (x === 1 || x === 6) c = C[1];
      if (y === 0) c = C[3];
      if (y === 11) c = hem && x % 2 ? C[0] : C[1];
      f.set(x, y, c);
    }
  }
  for (const side of ['right', 'left', 'top']) mail(F(s, 'body', side), mailC);
  F(s, 'body', 'bottom').fill(A[1]);
}
function belt(s, y, colour, buckle) {
  const B = R(colour, 3);
  for (const f of outerSides(s, 'body')) f.row(y, B[1]);
  s.band('body', y, B[0]);
  F(s, 'body', 'front', 'outer').paint(['...bb...'], { b: hex(buckle) }, { y });
}

// Small helpers for limbs (paint the right limb, mirrorLimbs() copies it).
const rows = (s, part, y, h, c, layer = 'inner') => s.sides(part, layer).forEach(f => f.rect(0, y, f.w, h, c));
const ringO = (s, part, y, c) => s.band(part, y, c, 'outer');

export default {
  style: 'accent',
  updates: [
    {
      title: 'Brothers of the Orders',
      note: 'Three more military orders ride to the Holy Land: the black-clad Knights of Saint Lazarus, the Sword Brothers of the far north and the Knights of Mountjoy in their red surcoats.',
      skins: [
        {
          name: 'Knight of Saint Lazarus',
          story: 'Sworn to care for the sick as much as to fight, he wears the green cross of Saint Lazarus on black over blackened mail.',
          build: ({ human }) => {
            const s = human({ seed: 201, skin: '#e0ac84', hair: null, texture: 0 });
            s.clearLayer('outer');
            const H = helmShell(s, '#5d636d');
            const G = R('#3fae55', 4);
            F(s, 'head', 'front').paint(['...gg...', '..gggg..', '...gg...', '.kkkkkk.', '...hh...', '...hh...', '.k.hh.k.', '...hh...'], { g: G[2], k: SLIT, h: H[5] });
            F(s, 'head', 'top', 'outer').paint(['........', '...rr...', '...rr...', '...rr...', '...rr...', '...rr...', '...rr...', '........'], { r: H[3] });
            F(s, 'head', 'front', 'outer').paint(['...rr...'], { r: H[4] });
            F(s, 'head', 'back', 'outer').paint(['...rr...', '...rr...'], { r: H[2] });
            tabard(s, { cloth: '#2c2c33', mailC: '#666b74' });
            const greek = ['...XX...', '...XX...', '.XXXXXX.', '.XXXXXX.', '...XX...', '...XX...'];
            F(s, 'body', 'front').paint(greek, { X: G[2] }, { y: 1 });
            F(s, 'body', 'back').paint(greek, { X: G[1] }, { y: 1 });
            belt(s, 8, '#3a2616', '#c9cdd3');
            // Arms: dark mail, black leather gauntlets, a steel shoulder cap
            mailPart(s, 'rightArm', '#666b74');
            rows(s, 'rightArm', 10, 2, [30, 30, 34, 255]);
            F(s, 'rightArm', 'bottom').fill([24, 24, 28, 255]);
            ringO(s, 'rightArm', 9, [44, 44, 50, 255]);
            ringO(s, 'rightArm', 0, H[3]); F(s, 'rightArm', 'top', 'outer').fill(H[4]);
            // Legs: mail chausses, knee cops, black boots
            mailPart(s, 'rightLeg', '#666b74');
            rows(s, 'rightLeg', 9, 3, [34, 34, 38, 255]); s.band('rightLeg', 11, [20, 20, 24, 255]);
            F(s, 'rightLeg', 'bottom').fill([20, 20, 24, 255]);
            F(s, 'rightLeg', 'front', 'outer').paint(['....', '....', '....', '....', '.hh.', 'HHHH'], { h: H[4], H: H[2] });
            ringO(s, 'rightLeg', 9, [52, 52, 58, 255]);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Sword Brother',
          story: 'He holds a stone fort on the cold northern frontier, the red sword and cross of his brotherhood on a white tabard.',
          build: ({ human }) => {
            const s = human({ seed: 202, skin: '#eab995', face: { eyes: '#4a78a8', style: 'angry', beard: '#c9a065', brows: '#a07840' }, hair: null, texture: 0 });
            s.clearLayer('outer');
            const H = dome(s, '#9aa1aa', 3);
            const M = '#8a8f97';
            const hf = F(s, 'head', 'front');
            hf.paint(['........', '........', '........', '...nn...', '...nn...'], { n: H[3] });
            mail(hf, M, (x, y) => y >= 3 && (x === 0 || x === 7));
            for (const side of HEAD_SIDES) mail(F(s, 'head', side), M, (x, y) => y >= 3);
            mail(F(s, 'head', 'bottom'), M);
            for (const f of outerSides(s, 'head')) f.row(2, H[2]);
            F(s, 'head', 'front', 'outer').paint(['........', '........', '...nn...', '...nn...'], { n: H[4] });
            tabard(s, { cloth: '#ebe8df', mailC: M });
            const Rd = R('#b52a2a', 4);
            const sword = ['...XX...', '..XXXX..', '...XX...', '...pp...', '.XXXXXX.', '...XX...', '...XX...', '...XX...', '...XX...', '...XX...', '....X...'];
            F(s, 'body', 'front').paint(sword, { X: Rd[2], p: Rd[1] }, { y: 0 });
            F(s, 'body', 'back').paint(sword, { X: Rd[1], p: Rd[0] }, { y: 0 });
            belt(s, 7, '#5a3a1e', '#c9cdd3');
            // White mantle over the shoulders (overlay)
            const W = R('#ebe8df', 4);
            F(s, 'body', 'top', 'outer').paint(['WWWWWWWW', 'W......W'], { W: W[2] });
            F(s, 'body', 'back', 'outer').paint(['WWWWWWWW', 'W......W', 'W......W', 'W......W', 'W......W', 'W......W', 'W......W', 'W......W', 'W......W', 'W......W', 'W......W', 'wWwWwWwW'], { W: W[2], w: W[1] });
            // Arms: mail, brown gloves
            mailPart(s, 'rightArm', M);
            rows(s, 'rightArm', 9, 3, R('#6b4526', 3)[1]); s.band('rightArm', 9, R('#6b4526', 3)[2]);
            F(s, 'rightArm', 'bottom').fill(R('#6b4526', 3)[0]);
            ringO(s, 'rightArm', 9, R('#6b4526', 3)[2]);
            F(s, 'rightArm', 'top', 'outer').paint(['WWWW', 'W..W'], { W: W[2] });
            for (const f of ['front', 'right', 'back', 'left']) F(s, 'rightArm', f, 'outer').row(0, W[2]);
            // Legs: mail, tall brown boots
            mailPart(s, 'rightLeg', M);
            const Bt = R('#5a3a1e', 4);
            rows(s, 'rightLeg', 8, 4, Bt[2]); s.band('rightLeg', 11, Bt[0]); s.band('rightLeg', 8, Bt[3]);
            F(s, 'rightLeg', 'bottom').fill(Bt[0]);
            ringO(s, 'rightLeg', 8, Bt[3]);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Knight of Mountjoy',
          story: 'A knight of the small Order of Mountjoy, named for the hill where pilgrims first see Jerusalem, in a red surcoat with a white cross and heraldic shoulder plates.',
          build: ({ human }) => {
            const s = human({ seed: 203, skin: '#e0ac84', hair: null, texture: 0 });
            s.clearLayer('outer');
            const H = helmShell(s, '#b6bdc6');
            const Gd = R('#e2b33c', 4), Rd = R('#b3262d', 5, 0.4), Wt = R('#f1efe8', 4);
            // Flat-topped great helm: eye slit, brass reinforcing cross, rows of breaths
            F(s, 'head', 'front').paint(['GGGGGGGG', '...gg...', '...gg...', 'kkkggkkk', '...gg...', '.k.gg.k.', '.k.gg.k.', '...gg...'], { G: Gd[1], g: Gd[2], k: SLIT });
            F(s, 'head', 'front', 'outer').paint(['GGGGGGGG'], { G: Gd[2] });
            for (const side of ['right', 'left', 'back']) F(s, 'head', side, 'outer').row(0, Gd[1]);
            F(s, 'head', 'top', 'outer').paint(['........', '........', '..RWRW..', '..WRWR..', '..RWRW..', '..WRWR..', '........', '........'], { R: Rd[3], W: Wt[3] });
            tabard(s, { cloth: '#b3262d', mailC: '#9aa0a8' });
            const pattee = ['..XXXX..', '...XX...', '.X.XX.X.', '.XXXXXX.', '.XXXXXX.', '.X.XX.X.', '...XX...', '..XXXX..'];
            F(s, 'body', 'front').paint(pattee, { X: Wt[2] }, { y: 1 });
            F(s, 'body', 'back').paint(pattee, { X: Wt[1] }, { y: 1 });
            belt(s, 9, '#2a1d14', '#e2b33c');
            // Arms: bright mail, steel couter, steel gauntlets, red ailettes with a white cross
            mailPart(s, 'rightArm', '#9aa0a8');
            rows(s, 'rightArm', 9, 3, H[3]); s.band('rightArm', 11, H[1]); s.band('rightArm', 9, H[4]);
            F(s, 'rightArm', 'bottom').fill(H[1]);
            ringO(s, 'rightArm', 5, H[3]);
            ringO(s, 'rightArm', 9, H[2]);
            F(s, 'rightArm', 'right', 'outer').paint(['RRRR', 'RWWR', 'WWWW', 'RWWR', 'RRRR'], { R: Rd[2], W: Wt[2] });
            F(s, 'rightArm', 'top', 'outer').paint(['RRRR'], { R: Rd[3] });
            // Legs: mail, polished greaves, gilded knee cops
            mailPart(s, 'rightLeg', '#9aa0a8');
            for (const f of s.sides('rightLeg')) f.rect(0, 6, 4, 6, H[2]).row(6, H[3]).row(11, H[0]).col(0, H[1], 6, 11);
            F(s, 'rightLeg', 'front').col(1, H[4], 7, 10);
            F(s, 'rightLeg', 'bottom').fill(H[1]);
            F(s, 'rightLeg', 'front', 'outer').paint(['....', '....', '....', '....', '.gg.', 'GGGG'], { g: Gd[3], G: Gd[1] });
            ringO(s, 'rightLeg', 11, H[2]);
            s.mirrorLimbs();
            return s;
          }
        }
      ]
    },
    {
      title: 'Sergeants of the Walls',
      note: 'Knights win the charge, but the walls are held by sergeants: a crossbowman in a kettle hat, a turcopole archer and the sergeant who carries the black-and-white banner.',
      skins: [
        {
          name: 'Crossbow Sergeant',
          story: 'From under his iron kettle hat he has watched every siege on these walls, a quiver of bolts at his hip and a crossbow on his back.',
          build: ({ human }) => {
            const s = human({ seed: 211, skin: '#d9a57a', face: { eyes: '#5a3a1e', style: 'normal', beard: '#4a2e1a', brows: '#3a2412' }, hair: null, texture: 0 });
            s.clearLayer('outer');
            const H = dome(s, '#8d949c', 3);
            const Q = R('#b8893c', 5, 0.25), Rd = R('#b52a2a', 3), Wd = R('#7a5230', 4);
            // shadow under the brim
            const hf = F(s, 'head', 'front');
            for (let x = 1; x < 7; x++) hf.set(x, 3, shade(hf.get(x, 3), 0.8));
            for (const side of HEAD_SIDES) F(s, 'head', side).rect(0, 3, 8, 5, R('#3a2412', 3)[1]);
            // Kettle hat: wide brim all round, the crown sits a pixel higher
            for (const f of outerSides(s, 'head')) f.paint(['...rr...', '........', 'LLLLLLLL', 'BbBBbBBb'], { r: H[4], L: H[4], B: H[1], b: H[3] }, { y: 0 });
            F(s, 'head', 'top', 'outer').paint(['........', '...rr...', '...rr...', '...rr...', '...rr...', '...rr...', '...rr...', '........'], { r: H[5] });
            // Quilted gambeson with a small red cross badge
            for (const f of s.faces('body')) quilt(f, Q);
            F(s, 'body', 'front').paint(['........', '.X......', 'XXX.....', '.X......'], { X: Rd[2] });
            belt(s, 7, '#4a2e1a', '#b0b6bd');
            // Quiver of bolts at the right hip, fletchings stand out
            F(s, 'body', 'front', 'outer').paint(['......fw', '......wf', '......mm', '......qQ', '......qQ', '......qQ', '......mm'], { f: [235, 232, 222, 255], w: Rd[2], q: Wd[0], Q: Wd[1], m: H[3] }, { y: 4 });
            // Crossbow slung on the back
            F(s, 'body', 'back', 'outer').paint(['........', '...ww...', 'SSSwwSSS', '...ww...', '...ww...', '...ww...', '...ww...', '...ww...', '...ww...'], { w: Wd[2], S: H[3] });
            // Arms: quilted sleeves, leather bracers, bare hands
            for (const f of s.faces('rightArm')) quilt(f, Q);
            rows(s, 'rightArm', 8, 2, Wd[2]);
            const SK = R('#d9a57a', 4, 0.35);
            rows(s, 'rightArm', 10, 2, SK[2]); F(s, 'rightArm', 'bottom').fill(SK[1]);
            ringO(s, 'rightArm', 8, Wd[3]);
            // Legs: red hose, boots with a turned cuff
            const Hs = R('#7a2a22', 4);
            for (const f of s.faces('rightLeg')) cloth(f, Hs);
            rows(s, 'rightLeg', 7, 5, Wd[1]); s.band('rightLeg', 11, Wd[0]); F(s, 'rightLeg', 'bottom').fill(Wd[0]);
            ringO(s, 'rightLeg', 7, Wd[3]);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Turcopole Archer',
          story: 'A light horse archer who rides scout for the orders, his pointed helm wrapped in olive cloth and a full quiver across his back.',
          build: ({ human }) => {
            const s = human({ seed: 212, skin: '#a87850', face: { eyes: '#2a1a10', style: 'normal', beard: '#1e1612', brows: '#1e1612' }, hair: null, texture: 0 });
            s.clearLayer('outer');
            const H = dome(s, '#9aa1aa', 2);
            F(s, 'head', 'top').paint(['........', '........', '........', '...hh...', '...hh...'], { h: H[5] });
            F(s, 'head', 'top', 'outer').paint(['........', '........', '...hh...', '..hHHh..', '..hHHh..', '...hh...'], { h: H[3], H: H[5] });
            const O = R('#6f7a3a', 4), Hr = R('#1e1612', 3);
            for (const side of HEAD_SIDES) F(s, 'head', side).rect(0, 2, 8, 6, Hr[1]);
            // Cloth wrap round the helm, tail hanging at the back
            for (const f of [F(s, 'head', 'front'), ...HEAD_SIDES.map(x => F(s, 'head', x))]) f.row(2, O[2]);
            for (const f of outerSides(s, 'head')) f.paint(['OoOoOoOo'], { O: O[2], o: O[1] }, { y: 2 });
            F(s, 'head', 'back', 'outer').paint(['....OO..', '....Oo..', '.....O..'], { O: O[2], o: O[1] }, { y: 3 });
            // Padded coat, leather baldric, small red cross patch
            const C = R('#a8955e', 5, 0.35), L = R('#5a3a1e', 4);
            for (const f of s.faces('body')) cloth(f, C);
            F(s, 'body', 'front').paint(['L.......', '.L......', '..L...X.', '...L.XXX', '....L.X.', '.....L..', '......L.', '.......L'], { L: L[2], X: [181, 42, 42, 255] });
            F(s, 'body', 'front', 'outer').paint(['L.......', '.L......'], { L: L[3] });
            belt(s, 8, '#4a2e1a', '#c9a24a');
            // Quiver across the back, arrow fletchings poking out at the shoulder
            F(s, 'body', 'back').paint(['.......q', '......qq', '.....qq.', '....qq..', '...qq...', '..qq....', '.qq.....', 'qq......'], { q: L[1] }, { y: 0 });
            F(s, 'body', 'back', 'outer').paint(['.....w.f', '......fw', '.....qq.', '....qq..'], { w: [235, 232, 222, 255], f: [70, 110, 60, 255], q: L[2] });
            // Arms: coat sleeves, archer's bracer
            for (const f of s.faces('rightArm')) cloth(f, C);
            const SK = R('#a87850', 4, 0.35);
            rows(s, 'rightArm', 10, 2, SK[2]); F(s, 'rightArm', 'bottom').fill(SK[1]);
            rows(s, 'rightArm', 7, 3, L[2]); s.band('rightArm', 7, L[3]);
            ringO(s, 'rightArm', 7, L[3]); ringO(s, 'rightArm', 9, L[1]);
            // Legs: loose trousers, olive leg wraps, low boots
            const Tr = R('#d4c49a', 4);
            for (const f of s.faces('rightLeg')) cloth(f, Tr);
            for (const f of s.sides('rightLeg')) f.paint(['OOOO', 'oooo', 'OOOO', 'oooo'], { O: O[2], o: O[1] }, { y: 6 });
            rows(s, 'rightLeg', 10, 2, L[1]); F(s, 'rightLeg', 'bottom').fill(L[0]);
            ringO(s, 'rightLeg', 6, O[3]);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Banner Sergeant',
          story: 'Wherever his black-and-white banner still flies, the knights know where to rally, so he has sworn never to let it fall.',
          build: ({ human }) => {
            const s = human({ seed: 213, skin: '#f0c8a4', face: { eyes: '#3b6fd0', style: 'normal', mouth: 'line', brows: '#8a5a2a' }, hair: null, texture: 0 });
            s.clearLayer('outer');
            const M = '#7f848c';
            // Steel skull cap over a mail coif that frames the face
            const H = dome(s, '#a7aeb7', 2);
            const hf = F(s, 'head', 'front');
            mail(hf, M, (x, y) => y === 2 || (y >= 2 && (x === 0 || x === 7)) || (y === 7 && (x < 2 || x > 5)));
            for (const side of HEAD_SIDES) mail(F(s, 'head', side), M, (x, y) => y >= 2);
            mail(F(s, 'head', 'bottom'), M);
            for (const f of outerSides(s, 'head')) f.row(1, H[2]);
            F(s, 'head', 'top', 'outer').paint(['........', '........', '........', '...hh...', '...hh...'], { h: H[4] });
            // Tabard split black and white like the banner, red cross on the seam
            tabard(s, { cloth: '#26262c', cloth2: '#ecebe6', mailC: M });
            F(s, 'body', 'front').paint(['...XX...', '..XXXX..', '...XX...'], { X: [190, 36, 40, 255] }, { y: 1 });
            belt(s, 8, '#3a2616', '#c9cdd3');
            // The banner on his back: pole and a black-over-white flag
            const Wd = R('#7a5230', 4);
            F(s, 'body', 'back', 'outer').paint(['......p.', '.BBBBBp.', '.BBBBBp.', '.WWWWWp.', '.WWWWWp.', '......p.', '......p.', '......p.', '......p.', '......p.', '......p.', '......p.'], { p: Wd[2], B: [32, 32, 38, 255], W: [236, 235, 230, 255] });
            F(s, 'head', 'back', 'outer').paint(['........', '........', '........', '........', '........', '......p.', '......p.', '......t.'], { p: Wd[2], t: [226, 179, 60, 255] });
            // Arms: mail, black sleeves of the sergeant's habit to the elbow, brown gloves
            mailPart(s, 'rightArm', M);
            const Bk = R('#2a2a30', 4);
            for (const f of s.sides('rightArm')) cloth(f, Bk, { y1: 4 });
            const G = R('#6b4526', 3);
            rows(s, 'rightArm', 10, 2, G[1]); F(s, 'rightArm', 'bottom').fill(G[0]);
            ringO(s, 'rightArm', 4, Bk[1]); ringO(s, 'rightArm', 10, G[2]);
            // Legs: black hose, brown boots
            for (const f of s.faces('rightLeg')) cloth(f, Bk);
            rows(s, 'rightLeg', 9, 3, G[1]); s.band('rightLeg', 11, G[0]); F(s, 'rightLeg', 'bottom').fill(G[0]);
            ringO(s, 'rightLeg', 9, G[2]);
            s.mirrorLimbs();
            return s;
          }
        }
      ]
    },
    {
      title: 'Riders of the East',
      note: 'From the other side of the battlefield come three new riders: a lancer in lamellar armour, a horse archer of the steppe and a guard of the citadel in gilded scales.',
      skins: [
        {
          name: 'Mamluk Lancer',
          story: 'Trained from boyhood to fight from the saddle, he rides in steel lamellar laced with yellow silk, his face hidden behind a mail aventail.',
          build: ({ human }) => {
            const s = human({ seed: 221, skin: '#b07a50', face: { eyes: '#2a1a10', style: 'angry', brows: '#1e1612' }, hair: null, texture: 0 });
            s.clearLayer('outer');
            const H = dome(s, '#a2a9b2', 3);
            const Y = R('#e0b52c', 4), M = '#8a8f97';
            // Spiked helm with a gilded band, nasal and mail aventail over the lower face
            for (const side of ['front', ...HEAD_SIDES]) F(s, 'head', side).row(2, Y[2]);
            const hf = F(s, 'head', 'front');
            hf.paint(['........', '........', '........', '...nn...', '...nn...'], { n: H[3] });
            mail(hf, M, (x, y) => y >= 6 || (y >= 3 && (x === 0 || x === 7)));
            for (const side of HEAD_SIDES) mail(F(s, 'head', side), M, (x, y) => y >= 3);
            mail(F(s, 'head', 'bottom'), M);
            F(s, 'head', 'top', 'outer').paint(['........', '........', '...ss...', '..sSSs..', '..sSSs..', '...ss...'], { s: H[3], S: Y[3] });
            for (const f of outerSides(s, 'head')) f.paint(['........', '........', 'YYYYYYYY'], { Y: Y[1] });
            F(s, 'head', 'front', 'outer').paint(['........', '........', '........', '...nn...', '........', '........', '........', 'mmmmmmmm'], { n: H[4], m: R(M, 4, 0.4)[1] });
            // Lamellar cuirass, yellow silk at the edges and sash
            const L = R('#a2a9b2', 5, 0.5);
            for (const side of ['front', 'back']) { const f = F(s, 'body', side); cloth(f, Y); lamellar(f, L, Y[0], (x, y) => y < 7 && x > 0 && x < 7); f.col(3, Y[0], 8, 11); }
            for (const side of ['right', 'left']) { const f = F(s, 'body', side); cloth(f, Y); lamellar(f, L, Y[0], (x, y) => y < 7); }
            F(s, 'body', 'top').fill(Y[2]); F(s, 'body', 'bottom').fill(Y[1]);
            belt(s, 7, '#c99a1c', '#7a1e1e');
            F(s, 'body', 'front', 'outer').paint(['Y......Y'], { Y: Y[3] });
            // Arms: yellow silk sleeves, steel vambraces, dark gloves
            for (const f of s.faces('rightArm')) cloth(f, Y);
            for (const f of s.sides('rightArm')) { f.rect(0, 6, 4, 5, L[2]).row(6, L[4]).row(10, L[1]); lamellar(f, L, Y[0], (x, y) => y < 3); }
            F(s, 'rightArm', 'top').fill(L[3]);
            ringO(s, 'rightArm', 0, L[4]); F(s, 'rightArm', 'top', 'outer').fill(L[3]);
            rows(s, 'rightArm', 11, 1, [40, 30, 24, 255]); F(s, 'rightArm', 'bottom').fill([40, 30, 24, 255]);
            ringO(s, 'rightArm', 2, Y[0]);
            ringO(s, 'rightArm', 6, L[4]); ringO(s, 'rightArm', 10, L[2]);
            // Legs: cream trousers, tall red riding boots
            const Tr = R('#e4dcc4', 4), Bt = R('#8a2a22', 4);
            for (const f of s.faces('rightLeg')) cloth(f, Tr);
            for (const f of s.sides('rightLeg')) cloth(f, Bt, { y0: 5 });
            F(s, 'rightLeg', 'bottom').fill(Bt[0]);
            ringO(s, 'rightLeg', 5, Bt[3]);
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Steppe Horse Archer',
          story: 'He can loose three arrows before his horse lands a single stride, and his fur-trimmed cap is the last thing his enemies see.',
          build: ({ human }) => {
            const s = human({ seed: 222, skin: '#c08a5c', face: { eyes: '#2a1a10', style: 'normal', mouth: 'none', brows: '#1e1612' }, hair: null, texture: 0 });
            s.clearLayer('outer');
            const Cr = R('#8c1f2e', 5, 0.4), Fu = R('#6e5440', 4, 0.5), Gd = R('#e2b33c', 4), Hr = R('#1e1612', 3);
            // Mustache with long ends
            F(s, 'head', 'front').paint(['........', '........', '........', '........', '........', '.mmmmmm.', '.m....m.', '.m....m.'], { m: Hr[1] });
            for (const side of HEAD_SIDES) F(s, 'head', side).rect(0, 2, 8, 6, Hr[1]);
            // Crimson cap with a broad fur band; the crown rises above the head
            F(s, 'head', 'top').fill(Cr[2]);
            for (const side of ['front', ...HEAD_SIDES]) { const f = F(s, 'head', side); f.row(0, Cr[2]); f.texture([[Fu[1], 2], [Fu[2], 3], [Fu[3], 1]], 222, { only: (x, y) => y === 1 || y === 2 }); }
            for (const f of outerSides(s, 'head')) f.texture([[Fu[1], 2], [Fu[2], 3], [Fu[3], 2]], 223, { only: (x, y) => y === 1 || y === 2 });
            for (const f of outerSides(s, 'head')) f.row(0, Cr[1]);
            F(s, 'head', 'top', 'outer').paint(['CCCCCCCC', 'CccccccC', 'CcCCCCcC', 'CcCGGCcC', 'CcCGGCcC', 'CcCCCCcC', 'CccccccC', 'CCCCCCCC'], { C: Cr[1], c: Cr[2], G: Gd[3] });
            // Crimson kaftan, wrapped left over right with a gold-trimmed edge, plaque belt
            for (const f of s.faces('body')) cloth(f, Cr);
            F(s, 'body', 'front').paint(['gg......', '..g.....', '...g....', '....g...', '.....g..', '......g.', '.......g', '.......g', '.......g', '.......g', '.......g', '.......g'], { g: Gd[2] });
            F(s, 'body', 'front', 'outer').paint(['GG......', '..G.....'], { G: Gd[3] });
            const L = R('#4a2e1a', 4);
            for (const f of outerSides(s, 'body')) f.row(8, L[1]);
            s.band('body', 8, L[0]);
            F(s, 'body', 'front', 'outer').paint(['g.g.g.g.'], { g: Gd[2] }, { y: 8 });
            // Bow case and quiver on the back
            F(s, 'body', 'back', 'outer').paint(['........', '.a....q.', '.ww..qq.', '.ww..qq.', '.ww..qq.', '.ww..qq.', '.ww..qq.', '.ww......'.slice(0, 8)], { a: [235, 232, 222, 255], w: L[2], q: L[3] }, { y: 0 });
            // Arms: crimson sleeves with gold armbands, leather gloves
            for (const f of s.faces('rightArm')) cloth(f, Cr);
            rows(s, 'rightArm', 10, 2, L[2]); F(s, 'rightArm', 'bottom').fill(L[1]);
            s.band('rightArm', 3, Gd[2]);
            ringO(s, 'rightArm', 3, Gd[3]); ringO(s, 'rightArm', 9, Cr[1]);
            // Legs: dark trousers, tall soft boots
            const Tr = R('#2c3448', 4), Bt = R('#6e4a2e', 4);
            for (const f of s.faces('rightLeg')) cloth(f, Tr);
            for (const f of s.sides('rightLeg')) cloth(f, Bt, { y0: 4 });
            F(s, 'rightLeg', 'bottom').fill(Bt[0]);
            ringO(s, 'rightLeg', 4, Bt[3]);
            F(s, 'rightLeg', 'front', 'outer').paint(['....', '....', '....', '....', '....', '.gg.'], { g: Gd[2] });
            s.mirrorLimbs();
            return s;
          }
        },
        {
          name: 'Citadel Guard',
          story: 'He keeps the gate of the old citadel in gilded scales and a white turban wound round a steel spike, and no one has passed him uninvited.',
          build: ({ human }) => {
            const s = human({ seed: 223, skin: '#8a5a3a', face: { eyes: '#2a1a10', style: 'angry', beard: '#18120e', brows: '#18120e' }, hair: null, texture: 0 });
            s.clearLayer('outer');
            const Wt = R('#efece4', 5, 0.3), Gd = R('#d9a83a', 5, 0.5), Gr = R('#2f8a54', 4), Hr = R('#18120e', 3);
            for (const side of HEAD_SIDES) F(s, 'head', side).rect(0, 3, 8, 5, Hr[1]);
            // Turban: wound in diagonal folds, green jewel at the front, gold spike on top
            const fold = (f, seed) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) f.set(x, y, (x + y + seed) % 4 === 0 ? Wt[1] : y === 0 ? Wt[4] : Wt[3]); };
            F(s, 'head', 'top').fill(Wt[3]);
            [F(s, 'head', 'front'), ...HEAD_SIDES.map(x => F(s, 'head', x))].forEach((f, i) => fold(f, i));
            outerSides(s, 'head').forEach((f, i) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) if (y < 2 || (x + i) % 3) f.set(x, y, (x + y + i) % 4 === 0 ? Wt[1] : Wt[2]); });
            F(s, 'head', 'front', 'outer').paint(['........', '...ge...', '...ee...'], { g: Gr[3], e: Gr[1] });
            F(s, 'head', 'top', 'outer').paint(['WWWWWWWW', 'WwwwwwwW', 'Ww....wW', 'Ww.GG.wW', 'Ww.GG.wW', 'Ww....wW', 'WwwwwwwW', 'WWWWWWWW'], { W: Wt[2], w: Wt[3], G: Gd[4] });
            F(s, 'head', 'top').paint(['........', '........', '...gg...', '..gGGg..', '..gGGg..', '...gg...'], { g: Gd[2], G: Gd[4] });
            // Gilded scale coat, green silk sash
            for (const f of s.faces('body')) scales(f, Gd);
            const sash = ['XX......', '.XX.....', '..XX....', '...XX...', '....XX..', '.....XX.', '......XX', '.......X'];
            F(s, 'body', 'front').paint(sash, { X: Gr[2] }, { y: 2 });
            F(s, 'body', 'front', 'outer').paint(['......X.', '.......X'], { X: Gr[3] }, { y: 8 });
            const L = R('#3a2616', 3);
            for (const f of outerSides(s, 'body')) f.row(10, L[1]);
            s.band('body', 10, L[0]);
            F(s, 'body', 'front', 'outer').paint(['...gg...'], { g: Gd[4] }, { y: 10 });
            // Arms: green silk sleeves, gilded bracers, bare hands
            for (const f of s.faces('rightArm')) cloth(f, Gr);
            for (const f of s.sides('rightArm')) f.rect(0, 0, 4, 3, Gd[3]).row(2, Gd[1]);
            F(s, 'rightArm', 'top').fill(Gd[3]);
            rows(s, 'rightArm', 7, 3, Gd[3]); s.band('rightArm', 9, Gd[1]);
            const SK = R('#8a5a3a', 4, 0.35);
            rows(s, 'rightArm', 10, 2, SK[2]); F(s, 'rightArm', 'bottom').fill(SK[1]);
            ringO(s, 'rightArm', 7, Gd[4]); ringO(s, 'rightArm', 1, Gd[4]);
            // Legs: white trousers, tan boots
            for (const f of s.faces('rightLeg')) cloth(f, Wt);
            const Bt = R('#9a6a3a', 4);
            rows(s, 'rightLeg', 8, 4, Bt[2]); s.band('rightLeg', 8, Bt[3]); s.band('rightLeg', 11, Bt[0]);
            F(s, 'rightLeg', 'bottom').fill(Bt[0]);
            ringO(s, 'rightLeg', 8, Bt[3]);
            s.mirrorLimbs();
            return s;
          }
        }
      ]
    }
  ]
};
