import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perDay, rank, hotWords, WATCH } from '../scripts/lib/trends.js';

const now = new Date('2026-11-21T12:00:00Z');
const mod = (name, created, downloads, cats = [], author = 'someone') => ({ name, slug: name.toLowerCase().replace(/\W+/g, '-'), dateCreated: created, downloadCount: downloads, categories: cats.map(name => ({ name })), authors: [{ name: author }] });

test('trends: downloads per day since creation, at least one day', () => {
  assert.equal(perDay(mod('A', '2026-11-11T12:00:00Z', 1000), now), 100);
  assert.equal(perDay(mod('B', '2026-11-21T11:00:00Z', 50), now), 50, 'a project of an hour counts as one day');
});

test('trends: only the window, our own projects left out, fastest first, categories summed', () => {
  const r = rank([
    mod('Old Giant', '2026-09-01T00:00:00Z', 1e6, ['Utility']),
    mod('Fast Map', '2026-11-16T12:00:00Z', 5000, ['Map', 'Utility']),
    mod('Slow Tool', '2026-11-01T12:00:00Z', 2000, ['Utility']),
    mod('Our Pack', '2026-11-20T12:00:00Z', 9999, ['Utility'], 'SevEvolution')
  ], { now, ownAuthors: ['SevEvolution'] });
  assert.equal(r.newProjects, 2);
  assert.deepEqual(r.top.map(m => [m.name, m.perDay]), [['Fast Map', 1000], ['Slow Tool', 100]]);
  assert.deepEqual(r.categories.map(c => [c.name, c.projects, c.perDay]), [['Utility', 2, 1100], ['Map', 1, 1000]]);
});

test('trends: words that many fast names share', () => {
  const top = ['LootFinder Forever', 'MasterCrafter Forever', 'Bags Forever', 'Quest Helper'].map(name => ({ name }));
  assert.deepEqual(hotWords(top), [{ word: 'forever', count: 3 }]);
  assert.deepEqual(hotWords(top, { min: 5 }), []);
});

test('trends: every row of the series is watched', () => {
  assert.deepEqual(WATCH.map(w => w.reihe).sort(), ['bedrock', 'java', 'stardew', 'wow']);
});
