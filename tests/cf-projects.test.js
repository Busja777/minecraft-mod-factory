import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadProjects, saveProjects, newEntry, upsertProject, findPending, findUnassigned,
  pickForUpdate, markPublished, markRejected, nextDueDate, effectiveDue
} from '../scripts/lib/cf-projects.js';

const NOW = new Date('2026-11-01T10:00:00Z');
const DAY = 86400000;
const daysAgo = n => new Date(NOW.getTime() - n * DAY).toISOString();
const daysAhead = n => new Date(NOW.getTime() + n * DAY).toISOString();

function published(modId, lastDays, extra = {}) {
  return { ...newEntry({ modId, name: modId }), projectId: 1000, status: 'published', lastPublishedAt: daysAgo(lastDays), ...extra };
}

test('loadProjects returns [] when file is missing and round-trips', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cfp-')), 'cf-projects.json');
  assert.deepEqual(loadProjects(file), []);
  const projects = [newEntry({ modId: 'a', name: 'A' })];
  saveProjects(projects, file);
  assert.deepEqual(loadProjects(file), projects);
});

test('upsertProject does not duplicate existing modIds', () => {
  const projects = [];
  upsertProject(projects, newEntry({ modId: 'a', name: 'A' }));
  upsertProject(projects, newEntry({ modId: 'a', name: 'A2' }));
  assert.equal(projects.length, 1);
  assert.equal(projects[0].name, 'A');
});

test('findPending / findUnassigned split on projectId', () => {
  const waiting = newEntry({ modId: 'waiting', name: 'W' });
  const ready = { ...newEntry({ modId: 'ready', name: 'R' }), projectId: 123 };
  const done = published('done', 5);
  assert.deepEqual(findPending([waiting, ready, done]).map(p => p.modId), ['ready']);
  assert.deepEqual(findUnassigned([waiting, ready, done]).map(p => p.modId), ['waiting']);
});

test('nextDueDate lies in [22, 25) days and follows the rng', () => {
  assert.equal(nextDueDate({ now: NOW, rng: () => 0 }).toISOString(), daysAhead(22));
  assert.equal(nextDueDate({ now: NOW, rng: () => 0.5 }).toISOString(), daysAhead(23.5));
  assert.equal(nextDueDate({ now: NOW, rng: () => 0.999 }).getTime() < NOW.getTime() + 25 * DAY, true);
  assert.throws(() => nextDueDate({ now: NOW, intervalDays: [25, 22] }), /Invalid updateIntervalDays/);
});

test('effectiveDue falls back to lastPublishedAt + 22d and never goes below that floor', () => {
  const legacy = published('legacy', 10);
  assert.equal(effectiveDue(legacy).toISOString(), daysAhead(12));
  const handEdited = published('short', 10, { nextUpdateDue: daysAhead(1) });
  assert.equal(effectiveDue(handEdited).toISOString(), daysAhead(12), 'floor wins over hand-edited due');
  const normal = published('normal', 10, { nextUpdateDue: daysAhead(14) });
  assert.equal(effectiveDue(normal).toISOString(), daysAhead(14));
  assert.equal(effectiveDue(newEntry({ modId: 'x', name: 'X' })), null);
});

test('pickForUpdate picks the earliest due project and ignores not-yet-due ones', () => {
  const projects = [
    published('later', 30, { nextUpdateDue: daysAgo(1) }),
    published('earliest', 30, { nextUpdateDue: daysAgo(5) }),
    published('notdue', 30, { nextUpdateDue: daysAhead(2) })
  ];
  assert.equal(pickForUpdate(projects, { now: NOW }).modId, 'earliest');
});

test('pickForUpdate returns null when nothing is due, honours the 22-day floor', () => {
  assert.equal(pickForUpdate([published('fresh', 3)], { now: NOW }), null);
  assert.equal(pickForUpdate([published('fresh', 21, { nextUpdateDue: daysAgo(1) })], { now: NOW }), null, 'floor blocks');
  assert.equal(pickForUpdate([published('legacy', 22)], { now: NOW }).modId, 'legacy', 'legacy entry without nextUpdateDue is due after 22d');
});

test('pickForUpdate skips rejected and pending projects', () => {
  const rejected = { ...published('rej', 50), status: 'rejected' };
  const pending = newEntry({ modId: 'pend', name: 'P' });
  assert.equal(pickForUpdate([rejected, pending], { now: NOW }), null);
});

test('markPublished sets status, due date, records file, counts updates only after first publish', () => {
  const projects = [{ ...newEntry({ modId: 'a', name: 'A' }), projectId: 555 }];
  markPublished(projects, 'a', { projectId: 555, fileId: 1, version: '1.0.0', cfName: 'A Mod', now: NOW, rng: () => 0.5 });
  assert.equal(projects[0].status, 'published');
  assert.equal(projects[0].updateCount, 0);
  assert.equal(projects[0].cfName, 'A Mod');
  assert.equal(projects[0].nextUpdateDue, daysAhead(23.5));
  markPublished(projects, 'a', { fileId: 2, version: '1.1.0', now: NOW, rng: () => 0 });
  assert.equal(projects[0].updateCount, 1);
  assert.equal(projects[0].version, '1.1.0');
  assert.equal(projects[0].files.length, 2);
  assert.equal(projects[0].nextUpdateDue, daysAhead(22));
});

test('markRejected flags the project and markPublished throws on unknown modId', () => {
  const projects = [published('a', 5)];
  markRejected(projects, 'a');
  assert.equal(projects[0].status, 'rejected');
  assert.throws(() => markPublished(projects, 'nope', { fileId: 1, version: '1.0.0' }), /Unknown mod/);
});
