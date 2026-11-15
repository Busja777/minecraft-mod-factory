import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newReview, markPart, clearPart, returnToClaude, resolveNote, approve, withdraw, markDue, markReviewPublished, openNotes, changedThisRound, planSlot, takenDaysOf, STATUS } from '../scripts/lib/review.js';
import { localParts } from '../scripts/lib/schedule.js';

const config = { timezone: 'Europe/Berlin', windows: { morning: ['06:00', '12:00'] }, newModDays: [1, 3, 5, 6] };
const t = s => new Date(s);
const berlin = iso => localParts(new Date(iso), 'Europe/Berlin');

test('full round: mark parts → back to Claude → resolved → new round → Go → due → published', () => {
  const r = newReview(t('2026-11-14T10:00:00Z'));
  assert.equal(r.status, STATUS.PRUEFUNG);
  markPart(r, 'logo', 'Hintergrund dunkler');
  markPart(r, 'skin:aka.png', 'rote Augen');
  assert.equal(openNotes(r).length, 2);
  returnToClaude(r);
  assert.equal(r.status, STATUS.CLAUDE);
  resolveNote(r, 'logo');
  assert.equal(r.status, STATUS.CLAUDE, 'still one open');
  resolveNote(r, 'skin:aka.png');
  assert.equal(r.status, STATUS.PRUEFUNG);
  assert.equal(r.round, 2);
  assert.deepEqual(changedThisRound(r).sort(), ['logo', 'skin:aka.png']);
  approve(r, { checks: [{ level: 'ok', label: 'x' }], slot: '2026-11-16T08:26:00.000Z', now: t('2026-11-14T11:00:00Z') });
  assert.equal(r.status, STATUS.GEPLANT);
  assert.equal(markDue(r, t('2026-11-16T08:00:00Z')), false, 'before the slot');
  assert.equal(markDue(r, t('2026-11-16T08:26:00Z')), true);
  assert.equal(r.status, STATUS.FAELLIG);
  markReviewPublished(r);
  assert.equal(r.status, STATUS.LIVE);
});

test('Go is blocked by open notes and red checks; forbidden transitions throw', () => {
  const r = newReview();
  markPart(r, 'name', 'kürzer');
  assert.throws(() => approve(r, { checks: [], slot: 'x' }), /offene Notizen/);
  clearPart(r, 'name');
  assert.throws(() => approve(r, { checks: [{ level: 'error', label: 'Logo' }], slot: 'x' }), /Prüfungen nicht bestanden: Logo/);
  assert.doesNotThrow(() => approve(r, { checks: [{ level: 'warn', label: 'Name' }], slot: '2026-11-16T08:26:00.000Z' }));
  assert.throws(() => markPart(r, 'logo', 'x'), /nur im Status zur-pruefung/);
  withdraw(r);
  assert.equal(r.status, STATUS.PRUEFUNG);
  assert.equal(r.slot, undefined);
  assert.throws(() => returnToClaude(r), /keine Notiz/);
  assert.throws(() => markPart(r, 'logo', '   '), /Bitte schreib/);
  assert.throws(() => markPart(r, 'logo', 'x'.repeat(2001)), /zu lang/);
  assert.throws(() => resolveNote(r, 'logo'), /nur im Status ueberarbeiten/);
});

test('planSlot: morning window on upload days only, one project per day, never in the past', () => {
  const now = t('2026-11-14T10:00:00Z'); // Samstag 11:00 in Berlin
  const a = planSlot({ config, now });
  const pa = berlin(a.slot);
  assert.ok([1, 3, 5, 6].includes(pa.weekday));
  assert.ok(pa.minutesOfDay >= 6 * 60 && pa.minutesOfDay <= 12 * 60 - 20, `in window: ${pa.hour}:${pa.minute}`);
  assert.ok(new Date(a.slot) > now);
  const b = planSlot({ config, now, takenDays: [a.dateKey] });
  assert.notEqual(b.dateKey, a.dateKey);
  assert.ok([1, 3, 5, 6].includes(berlin(b.slot).weekday));
  // Taken days come from approved reviews only.
  const reviews = [{ status: 'geplant', slot: a.slot }, { status: 'zur-pruefung' }, { status: 'veroeffentlicht', slot: b.slot }];
  assert.deepEqual(takenDaysOf(reviews, config), [a.dateKey]);
});

test('planSlot: early on an upload day takes today; a Sunday never', () => {
  const monEarly = t('2026-11-16T04:00:00Z'); // Montag 05:00 Berlin
  assert.equal(planSlot({ config, now: monEarly }).dateKey, '2026-11-16');
  const sunday = t('2026-11-15T05:00:00Z');
  assert.equal(planSlot({ config, now: sunday }).dateKey, '2026-11-16');
});
