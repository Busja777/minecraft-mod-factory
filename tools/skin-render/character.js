// Runs in headless Chromium. Builds a Minecraft player model (64x64 skin, classic or slim arms,
// inner + overlay layer) and exposes window.renderSkin(dataUrl, opts) → PNG data URL.
// UV layout ported from Input/minecraft-skin-editor/src/utils/minecraftUVs.ts.
import * as THREE from 'three';

function faces(type) {
  const c = type === 'classic';
  const uvs = {
    head: [[16, 8, 8, 8], [0, 8, 8, 8], [8, 0, 8, 8], [16, 0, 8, 8], [8, 8, 8, 8], [24, 8, 8, 8]],
    body: [[28, 20, 4, 12], [16, 20, 4, 12], [20, 16, 8, 4], [28, 16, 8, 4], [20, 20, 8, 12], [32, 20, 8, 12]],
    rightArm: c ? [[48, 20, 4, 12], [40, 20, 4, 12], [44, 16, 4, 4], [48, 16, 4, 4], [44, 20, 4, 12], [52, 20, 4, 12]]
                : [[47, 20, 4, 12], [40, 20, 4, 12], [44, 16, 3, 4], [47, 16, 3, 4], [44, 20, 3, 12], [51, 20, 3, 12]],
    leftArm: c ? [[40, 52, 4, 12], [32, 52, 4, 12], [36, 48, 4, 4], [40, 48, 4, 4], [36, 52, 4, 12], [44, 52, 4, 12]]
               : [[39, 52, 4, 12], [32, 52, 4, 12], [36, 48, 3, 4], [39, 48, 3, 4], [36, 52, 3, 12], [43, 52, 3, 12]],
    rightLeg: [[8, 20, 4, 12], [0, 20, 4, 12], [4, 16, 4, 4], [8, 16, 4, 4], [4, 20, 4, 12], [12, 20, 4, 12]],
    leftLeg: [[24, 52, 4, 12], [16, 52, 4, 12], [20, 48, 4, 4], [24, 48, 4, 4], [20, 52, 4, 12], [28, 52, 4, 12]]
  };
  const off = (f, ox, oy) => f.map(([x, y, w, h]) => [x + ox, y + oy, w, h]);
  const overlays = {
    head: off(uvs.head, 32, 0), body: off(uvs.body, 0, 16), rightArm: off(uvs.rightArm, 0, 16),
    leftArm: off(uvs.leftArm, 16, 0), rightLeg: off(uvs.rightLeg, 0, 16), leftLeg: off(uvs.leftLeg, -16, 0)
  };
  return { uvs, overlays };
}

function box(w, h, d, uv) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const a = geo.attributes.uv;
  for (let i = 0; i < 6; i++) {
    const [x, y, fw, fh] = uv[i];
    const u1 = x / 64, v1 = 1 - y / 64, u2 = (x + fw) / 64, v2 = 1 - (y + fh) / 64;
    a.setXY(i * 4 + 0, u1, v1); a.setXY(i * 4 + 1, u2, v1); a.setXY(i * 4 + 2, u1, v2); a.setXY(i * 4 + 3, u2, v2);
  }
  a.needsUpdate = true;
  return geo;
}

function buildPlayer(texture, type) {
  const { uvs, overlays } = faces(type);
  const inner = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.1 });
  const outer = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.1, side: THREE.DoubleSide });
  const aw = type === 'classic' ? 4 : 3, armX = type === 'classic' ? 6 : 5.5;
  const parts = [
    ['head', [8, 8, 8], [0, 24, 0], [0, 4, 0]],
    ['body', [8, 12, 4], [0, 18, 0], [0, 0, 0]],
    ['rightArm', [aw, 12, 4], [-armX, 22, 0], [0, -4, 0], 0.06],
    ['leftArm', [aw, 12, 4], [armX, 22, 0], [0, -4, 0], -0.06],
    ['rightLeg', [4, 12, 4], [-2, 12, 0], [0, -6, 0]],
    ['leftLeg', [4, 12, 4], [2, 12, 0], [0, -6, 0]]
  ];
  const player = new THREE.Group();
  for (const [name, [w, h, d], pivot, offset, rollZ = 0] of parts) {
    const g = new THREE.Group();
    g.position.set(...pivot);
    g.rotation.z = rollZ;
    const m = new THREE.Mesh(box(w, h, d, uvs[name]), inner); m.position.set(...offset); g.add(m);
    const o = new THREE.Mesh(box(w + 0.5, h + 0.5, d + 0.5, overlays[name]), outer); o.position.set(...offset); g.add(o);
    player.add(g);
  }
  player.position.y = -12;
  return player;
}

window.renderSkin = async (dataUrl, { width = 578, height = 967, slim = false, yaw = -0.32, pitch = 0.12, background = null } = {}) => {
  const texture = await new THREE.TextureLoader().loadAsync(dataUrl);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.setClearColor(background ? new THREE.Color(background) : 0x000000, background ? 1 : 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(-20, 30, 40);
  scene.add(sun);

  const player = buildPlayer(texture, slim ? 'slim' : 'classic');
  player.rotation.y = yaw;
  scene.add(player);

  const fov = 30;
  const camera = new THREE.PerspectiveCamera(fov, width / height, 1, 500);
  const halfH = 18.5;
  const dist = Math.max(halfH, 12 / (width / height)) / Math.tan((fov / 2) * Math.PI / 180);
  camera.position.set(0, 4 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  camera.lookAt(0, 4, 0);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  renderer.dispose();
  return url;
};
window.rendererReady = true;
