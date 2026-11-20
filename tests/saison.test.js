import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDueVersion, hasDueVersion, seasonHold } from '../scripts/lib/skinpacks.js';
import { newReleaseProject, addVersion } from '../scripts/lib/releases.js';

// Season updates: a version can wait for its day; the order of a project's versions never changes,
// because every stock file contains everything before it.
const project = () => {
  const p = newReleaseProject({ slug: 'fresh-splashes', game: 'java', name: 'Fresh Splashes', projectId: 1 });
  addVersion(p, { version: '1.0', file: 'a-1.0.zip', changelog: 'First.' });
  addVersion(p, { version: '1.1', file: 'a-1.1.zip', changelog: 'Winter lines.', preferFrom: '2026-12-01' });
  addVersion(p, { version: '1.2', file: 'a-1.2.zip', changelog: 'More lines.' });
  return p;
};

test('season: a version with preferFrom waits for its day, and the versions after it wait too', () => {
  const p = project();
  p.versions[0].status = 'published';
  assert.equal(nextDueVersion(p, new Date('2026-11-25T18:00:00Z')), null);
  assert.equal(hasDueVersion(p, new Date('2026-11-30T23:00:00Z')), false);
  assert.deepEqual(seasonHold(p, new Date('2026-11-25T18:00:00Z')), { version: '1.1', preferFrom: '2026-12-01' });
  assert.equal(nextDueVersion(p, new Date('2026-12-01T17:00:00Z')).version, '1.1');
  assert.equal(seasonHold(p, new Date('2026-12-01T17:00:00Z')), null);
  p.versions[1].status = 'published';
  assert.equal(nextDueVersion(p, new Date('2026-11-25T18:00:00Z')).version, '1.2');
});

test('season: preferFrom is a plain date', () => {
  const p = newReleaseProject({ slug: 'x', game: 'java', name: 'X', projectId: null });
  assert.throws(() => addVersion(p, { version: '1.0', file: 'x.zip', changelog: 'c', preferFrom: '1.12.2026' }), /YYYY-MM-DD/);
  assert.equal(addVersion(p, { version: '1.0', file: 'x.zip', changelog: 'c', preferFrom: '2026-12-01' }).preferFrom, '2026-12-01');
  assert.equal(addVersion(p, { version: '1.1', file: 'y.zip', changelog: 'c' }).preferFrom, undefined);
});
