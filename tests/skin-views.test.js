import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, POSES, resolveView, viewFor } from '../tools/skin-render/views.js';

test('every prepared view uses a pose from the skin editor', () => {
  assert.ok(Object.keys(VIEWS).length >= 8);
  for (const [name, v] of Object.entries(VIEWS)) {
    assert.ok(POSES[v.pose], `${name} uses unknown pose ${v.pose}`);
    assert.equal(typeof v.azimuth, 'number');
    assert.equal(typeof v.elevation, 'number');
  }
  assert.ok(VIEWS.editor, 'default view "editor" must exist');
});

test('poses match the editor file (idle is neutral, walk swings arms and legs)', () => {
  assert.deepEqual(POSES.idle.leftArm, { x: 0, y: 0, z: 0 });
  assert.equal(POSES.walk.leftArm.x, 0.5);
  assert.equal(POSES.walk.rightLeg.x, 0.5);
});

test('resolveView returns pose rotations and rejects unknown names with the valid list', () => {
  const v = resolveView('walk');
  assert.equal(v.pose, POSES.walk);
  assert.equal(v.distance, VIEWS.walk.distance);
  assert.throws(() => resolveView('selfie'), /Valid views: editor, front/);
});

test('version view wins over pack view, then the default', () => {
  assert.equal(viewFor({ view: 'walk' }, { view: 'fight' }), 'fight');
  assert.equal(viewFor({ view: 'walk' }, {}), 'walk');
  assert.equal(viewFor({}, {}, 'editor'), 'editor');
});
