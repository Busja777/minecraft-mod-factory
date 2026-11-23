import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadProjects, saveProjects, newEntry, upsertProject, findPending, findUnassigned,
  pickForUpdate, markPublished, markRejected, nextDueDate, effectiveDue, syncLastUpload
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

test('nextDueDate lies in [23, 26) days and follows the rng', () => {
  assert.equal(nextDueDate({ now: NOW, rng: () => 0 }).toISOString(), daysAhead(23));
  assert.equal(nextDueDate({ now: NOW, rng: () => 0.5 }).toISOString(), daysAhead(24.5));
  assert.equal(nextDueDate({ now: NOW, rng: () => 0.999 }).getTime() < NOW.getTime() + 26 * DAY, true);
  assert.throws(() => nextDueDate({ now: NOW, intervalDays: [25, 22] }), /Invalid updateIntervalDays/);
});

test('effectiveDue falls back to lastPublishedAt + 23d and never goes below that floor', () => {
  const legacy = published('legacy', 10);
  assert.equal(effectiveDue(legacy).toISOString(), daysAhead(13));
  const handEdited = published('short', 10, { nextUpdateDue: daysAhead(1) });
  assert.equal(effectiveDue(handEdited).toISOString(), daysAhead(13), 'floor wins over hand-edited due');
  const normal = published('normal', 10, { nextUpdateDue: daysAhead(14) });
  assert.equal(effectiveDue(normal).toISOString(), daysAhead(14));
  assert.equal(effectiveDue(newEntry({ modId: 'x', name: 'X' })), null);
});

test('pickForUpdate goes round the cycle: the due project with the oldest update comes first', () => {
  const projects = [
    published('recent', 30, { nextUpdateDue: daysAgo(5) }),
    published('oldest', 200, { nextUpdateDue: daysAgo(1) }),
    published('notdue', 300, { nextUpdateDue: daysAhead(2) })
  ];
  assert.equal(pickForUpdate(projects, { now: NOW }).modId, 'oldest');
  assert.equal(pickForUpdate(projects, { now: NOW, eligible: p => p.modId !== 'oldest' }).modId, 'recent');
});

test('pickForUpdate returns null when nothing is due, honours the 23-day floor', () => {
  assert.equal(pickForUpdate([published('fresh', 3)], { now: NOW }), null);
  assert.equal(pickForUpdate([published('fresh', 22, { nextUpdateDue: daysAgo(1) })], { now: NOW }), null, 'floor blocks');
  assert.equal(pickForUpdate([published('legacy', 23)], { now: NOW }).modId, 'legacy', 'legacy entry without nextUpdateDue is due after 23d');
});

test('syncLastUpload takes a newer CurseForge file (also one uploaded by hand)', () => {
  const p = published('pack', 40, { nextUpdateDue: daysAgo(10) });
  assert.equal(syncLastUpload(p, [{ fileDate: daysAgo(50) }]), false, 'older file changes nothing');
  assert.equal(syncLastUpload(p, [{ fileDate: daysAgo(5) }, { fileDate: daysAgo(60) }]), true);
  assert.equal(p.lastPublishedAt, daysAgo(5));
  assert.equal(pickForUpdate([p], { now: NOW }), null, 'the hand upload restarts the 23 days');
  assert.equal(syncLastUpload(p, []), false);
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
  assert.equal(projects[0].nextUpdateDue, daysAhead(24.5));
  markPublished(projects, 'a', { fileId: 2, version: '1.1.0', now: NOW, rng: () => 0 });
  assert.equal(projects[0].updateCount, 1);
  assert.equal(projects[0].version, '1.1.0');
  assert.equal(projects[0].files.length, 2);
  assert.equal(projects[0].nextUpdateDue, daysAhead(23));
});

test('markRejected flags the project and markPublished throws on unknown modId', () => {
  const projects = [published('a', 5)];
  markRejected(projects, 'a');
  assert.equal(projects[0].status, 'rejected');
  assert.throws(() => markPublished(projects, 'nope', { fileId: 1, version: '1.0.0' }), /Unknown mod/);
});

// ── at most one upload per account and local day ──────────────────────────────────────────────
import { uploadedToday } from '../scripts/lib/cf-projects.js';

test('uploadedToday: an upload earlier on the same Berlin day blocks a second one', () => {
  const TZ = 'Europe/Berlin';
  const at = iso => ({ modId: 'a', status: 'published', projectId: 1, lastPublishedAt: iso });
  const now = new Date('2026-11-24T19:30:00Z'); // 20:30 in Berlin (winter, UTC+1)
  // 18:30 Berlin the same evening (a run that uploaded and then failed on the data push)
  assert.equal(uploadedToday([at('2026-11-24T17:30:00Z')], { now, timeZone: TZ })?.modId, 'a');
  // 23:30 Berlin the day before
  assert.equal(uploadedToday([at('2026-11-23T22:30:00Z')], { now, timeZone: TZ }), null);
  // 00:30 Berlin today is still the 23rd in UTC: counts as today
  assert.equal(uploadedToday([at('2026-11-23T23:30:00Z')], { now, timeZone: TZ })?.modId, 'a');
  // summer (UTC+2): 00:30 Berlin on 15 Jul is 22:30 UTC on 14 Jul
  const summer = new Date('2027-07-15T18:00:00Z');
  assert.equal(uploadedToday([at('2027-07-14T22:30:00Z')], { now: summer, timeZone: TZ })?.modId, 'a');
  assert.equal(uploadedToday([at('2027-07-14T21:30:00Z')], { now: summer, timeZone: TZ }), null);
  // never published / no date: never blocks
  assert.equal(uploadedToday([{ modId: 'b', status: 'pending', lastPublishedAt: null }], { now, timeZone: TZ }), null);
  assert.equal(uploadedToday([], { now, timeZone: TZ }), null);
  // the newest of several uploads today is reported
  assert.equal(uploadedToday([at('2026-11-24T17:30:00Z'), { ...at('2026-11-24T18:00:00Z'), modId: 'b' }], { now, timeZone: TZ })?.modId, 'b');
});
