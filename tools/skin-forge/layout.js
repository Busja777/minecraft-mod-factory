// UV layout of a 64x64 Bedrock/Java skin (from "Skills- MC Classic Skin/layout-map.md").
// Every body part is a box (w × h × d) unfolded at a UV origin; the overlay ("outer") copy of each part
// sits at its own origin. Faces: top, bottom, right, front, left, back (right = the character's right).

export const PARTS = {
  head: { size: [8, 8, 8], inner: [0, 0], outer: [32, 0] },
  body: { size: [8, 12, 4], inner: [16, 16], outer: [16, 32] },
  rightArm: { size: [4, 12, 4], inner: [40, 16], outer: [40, 32] },
  leftArm: { size: [4, 12, 4], inner: [32, 48], outer: [48, 48] },
  rightLeg: { size: [4, 12, 4], inner: [0, 16], outer: [0, 32] },
  leftLeg: { size: [4, 12, 4], inner: [16, 48], outer: [0, 48] }
};

export const FACES = ['top', 'bottom', 'right', 'front', 'left', 'back'];
export const SIDES = ['front', 'left', 'back', 'right']; // walking around a part, counter-clockwise seen from above
export const ARMS = ['rightArm', 'leftArm'];
export const LIMBS = ['rightArm', 'leftArm', 'rightLeg', 'leftLeg'];

// → { x, y, w, h } of one face. slim: arms are 3 px wide (Alex model).
export function faceRect(part, face, layer = 'inner', { slim = false } = {}) {
  const p = PARTS[part];
  if (!p) throw new Error(`Unknown part "${part}"`);
  const [u, v] = p[layer];
  let [w, h, d] = p.size;
  if (slim && ARMS.includes(part)) w = 3;
  switch (face) {
    case 'top': return { x: u + d, y: v, w, h: d };
    case 'bottom': return { x: u + d + w, y: v, w, h: d };
    case 'right': return { x: u, y: v + d, w: d, h };
    case 'front': return { x: u + d, y: v + d, w, h };
    case 'left': return { x: u + d + w, y: v + d, w: d, h };
    case 'back': return { x: u + 2 * d + w, y: v + d, w, h };
    default: throw new Error(`Unknown face "${face}"`);
  }
}

// All face rects of a layer: [{ part, face, x, y, w, h }]
export function allFaces(layer = 'inner', opts = {}) {
  return Object.keys(PARTS).flatMap(part => FACES.map(face => ({ part, face, ...faceRect(part, face, layer, opts) })));
}
