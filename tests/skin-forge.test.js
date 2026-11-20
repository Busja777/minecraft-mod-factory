import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { faceRect, allFaces } from '../tools/skin-forge/layout.js';
import { Skin } from '../tools/skin-forge/skin.js';
import { hex, neonRamp, ramp, rng } from '../tools/skin-forge/color.js';
import { glow } from '../tools/skin-forge/glow.js';
import { human } from '../tools/skin-forge/human.js';
import { validate, structure, distinct, measure } from '../tools/skin-forge/validate.js';

test('layout matches the skin map (inner, overlay, slim arms)', () => {
  assert.deepEqual(faceRect('head', 'front'), { x: 8, y: 8, w: 8, h: 8 });
  assert.deepEqual(faceRect('head', 'front', 'outer'), { x: 40, y: 8, w: 8, h: 8 });
  assert.deepEqual(faceRect('body', 'back'), { x: 32, y: 20, w: 8, h: 12 });
  assert.deepEqual(faceRect('leftArm', 'front'), { x: 36, y: 52, w: 4, h: 12 });
  assert.deepEqual(faceRect('leftArm', 'front', 'outer'), { x: 52, y: 52, w: 4, h: 12 });
  assert.deepEqual(faceRect('rightLeg', 'top', 'outer'), { x: 4, y: 32, w: 4, h: 4 });
  assert.deepEqual(faceRect('rightArm', 'front', 'inner', { slim: true }), { x: 44, y: 20, w: 3, h: 12 });
  assert.deepEqual(faceRect('rightArm', 'back', 'inner', { slim: true }), { x: 51, y: 20, w: 3, h: 12 });
  // No two inner faces overlap.
  const seen = new Set();
  for (const f of allFaces('inner')) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const k = `${f.x + x},${f.y + y}`; assert.ok(!seen.has(k), `overlap at ${k}`); seen.add(k);
  }
});

test('colours: hex, ramps and seeded randomness', () => {
  assert.deepEqual(hex('#ff8000'), [255, 128, 0, 255]);
  assert.deepEqual(neonRamp('#00ffc8')[0], [0, 0, 0, 255]);
  assert.deepEqual(neonRamp('#00ffc8')[7], [0, 255, 200, 255]);
  const r = ramp('#808080', 5);
  assert.ok(r[0][0] < r[4][0]);
  assert.equal(rng(7)(), rng(7)());
});

test('faces paint, bands wrap around a part, limbs mirror onto the other side', async () => {
  const s = new Skin();
  s.face('head', 'front').paint(['ab'], { a: '#ff0000', b: '#00ff00' });
  assert.deepEqual(s.getPx(8, 8), [255, 0, 0, 255]);
  assert.deepEqual(s.getPx(9, 8), [0, 255, 0, 255]);
  s.band('body', 6, '#0000ff');
  for (const f of s.sides('body')) assert.deepEqual(f.get(0, 6), [0, 0, 255, 255]);
  s.face('rightArm', 'front').set(0, 0, '#ffffff');
  s.mirrorLimb('rightArm', 'leftArm');
  assert.deepEqual(s.face('leftArm', 'front').get(3, 0), [255, 255, 255, 255], 'mirrored to the other edge');
  const png = await s.png();
  const back = await Skin.fromPng(png);
  assert.deepEqual(back.getPx(8, 8), [255, 0, 0, 255]);
});

test('every glow archetype passes the glow rules', () => {
  const archetypes = ['armor', 'kabuto', 'creature', 'cracked', 'marionette', 'headband'];
  for (const [i, archetype] of archetypes.entries()) {
    const v = validate(glow({ neon: '#00ffc8', archetype, seed: i }), { style: 'glow' });
    assert.ok(v.ok, `${archetype}: ${v.errors.join('; ')}`);
    assert.ok(v.stats.black >= 0.7, `${archetype} black ${v.stats.black}`);
  }
  const slim = glow({ archetype: 'armor', slim: true });
  assert.equal(measure(slim).innerOpaque, 1, 'slim arms are filled too');
});

test('classic characters always have a complete inner layer and a sparse overlay', () => {
  const tops = ['shirt', 'armor', 'robe', 'hoodie', 'jersey', 'sweater', 'tunic', 'coat', 'overalls', 'tabard', 'suit', 'dress', 'vest'];
  const heads = ['none', 'helmet', 'greathelm', 'hood', 'cap', 'beanie', 'crown', 'wizard', 'bandana', 'mask', 'ears', 'strawhat', 'headband', 'nightcap', 'circlet', 'horns', 'halo'];
  for (const [i, kind] of tops.entries()) {
    const s = human({ seed: i, hair: { color: '#5a3a22', style: ['short', 'long', 'spiky', 'curly'][i % 4] }, head: { kind: heads[i % heads.length], color: '#8a8f96' }, top: { kind, color: '#3a7bd5', trim: '#e2b33c', pattern: { kind: 'cross' } }, belt: i % 2 ? '#4a2e1a' : undefined, cape: i % 3 ? undefined : '#a02020' });
    const v = validate(s, { style: 'accent' });
    assert.ok(v.ok, `${kind}: ${v.errors.join('; ')}`);
    assert.ok(v.stats.overlayTransparent > 0.6, `${kind}: overlay ${v.stats.overlayTransparent}`);
  }
  for (const [i, kind] of heads.entries()) assert.ok(validate(human({ seed: i, head: { kind } })).ok, kind);
  assert.equal(measure(human({ slim: true, top: { kind: 'armor', color: '#aaa' } })).innerOpaque, 1);
});

test('a recolour is caught, a new design is not', () => {
  const base = structure(glow({ neon: '#00ffc8', archetype: 'armor', eyes: 'slit', body: 'plates', seed: 1 }));
  const recolour = structure(glow({ neon: '#ff2020', archetype: 'armor', eyes: 'slit', body: 'plates', seed: 1 }));
  const other = structure(glow({ neon: '#ff2020', archetype: 'creature', eyes: 'fox', body: 'diagonal', arms: 'diagonal', legs: 'stripes', seed: 1 }));
  assert.ok(distinct(base, recolour).differs <= 1, JSON.stringify(distinct(base, recolour)));
  assert.ok(distinct(base, other).differs >= 3, JSON.stringify(distinct(base, other)));
});

test('the real hand-made ninjas pass the glow rules the forge applies', async () => {
  const dir = 'data/skins/the-last-ninjas/skins/1.0';
  for (const f of fs.readdirSync(dir)) {
    const v = validate(await Skin.fromPng(fs.readFileSync(path.join(dir, f))), { style: 'glow' });
    assert.ok(v.ok, `${f}: ${v.errors.join('; ')}`);
  }
});
