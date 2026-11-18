import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localParts, parseHHMM, formatMinutes, slotFor, decide, localMidnightUtcIso } from '../scripts/lib/schedule.js';

const TZ = 'Europe/Berlin';

test('localParts converts UTC to Berlin time with h23 hours and weekday', () => {
  const summer = localParts(new Date('2026-07-15T22:30:00Z'), TZ); // CEST = UTC+2 → 00:30 next day
  assert.equal(summer.dateKey, '2026-07-16');
  assert.equal(summer.hour, 0);
  assert.equal(summer.minute, 30);
  assert.equal(summer.weekday, 4, 'Thursday');
  const winter = localParts(new Date('2026-12-01T18:05:00Z'), TZ); // CET = UTC+1
  assert.equal(winter.hour, 19);
  assert.equal(winter.minutesOfDay, 19 * 60 + 5);
  assert.equal(winter.weekday, 2, 'Tuesday');
});

test('DST transition days resolve correctly', () => {
  // 2026-03-29: clocks jump 02:00 → 03:00 CET→CEST. 01:30 UTC is 03:30 local.
  assert.equal(localParts(new Date('2026-03-29T01:30:00Z'), TZ).hour, 3);
  // 2026-10-25: clocks fall back 03:00 → 02:00. 01:30 UTC is 02:30 local (CET).
  assert.equal(localParts(new Date('2026-10-25T01:30:00Z'), TZ).hour, 2);
});

test('parseHHMM / formatMinutes', () => {
  assert.equal(parseHHMM('06:00'), 360);
  assert.equal(parseHHMM('22:00'), 1320);
  assert.equal(formatMinutes(1140), '19:00');
  assert.throws(() => parseHHMM('6'), /Invalid time/);
});

test('slotFor is deterministic, inside [start, end-margin] and varies by day/window', () => {
  const start = parseHHMM('19:00'), end = parseHHMM('22:00');
  const a = slotFor({ dateKey: '2026-11-03', windowName: 'evening', salt: 'repo', start, end });
  const b = slotFor({ dateKey: '2026-11-03', windowName: 'evening', salt: 'repo', start, end });
  assert.equal(a, b);
  assert.ok(a >= start && a <= end - 20, `slot ${a} in range`);
  const seen = new Set();
  for (let d = 1; d <= 28; d++) {
    const s = slotFor({ dateKey: `2026-11-${String(d).padStart(2, '0')}`, windowName: 'evening', salt: 'repo', start, end });
    assert.ok(s >= start && s <= end - 20);
    seen.add(s);
  }
  assert.ok(seen.size > 10, 'slots vary across days');
  assert.notEqual(a, slotFor({ dateKey: '2026-11-03', windowName: 'morning', salt: 'repo', start, end }));
});

test('decide covers all gate cases', () => {
  const windowEnd = parseHHMM('22:00');
  const slot = parseHHMM('20:17');
  assert.deepEqual(decide({ nowMinutes: parseHHMM('19:00'), slot, windowEnd, ranToday: false }), { run: false, sleepMinutes: 0, reason: 'before-slot' });
  assert.deepEqual(decide({ nowMinutes: parseHHMM('20:00'), slot, windowEnd, ranToday: false }), { run: true, sleepMinutes: 17, reason: 'waiting-for-slot' });
  assert.deepEqual(decide({ nowMinutes: parseHHMM('20:20'), slot, windowEnd, ranToday: false }), { run: true, sleepMinutes: 0, reason: 'slot-reached' });
  assert.deepEqual(decide({ nowMinutes: parseHHMM('21:30'), slot, windowEnd, ranToday: false }), { run: true, sleepMinutes: 0, reason: 'catch-up' });
  assert.deepEqual(decide({ nowMinutes: parseHHMM('22:00'), slot, windowEnd, ranToday: false }), { run: false, sleepMinutes: 0, reason: 'window-over' });
  assert.deepEqual(decide({ nowMinutes: parseHHMM('20:20'), slot, windowEnd, ranToday: true }), { run: false, sleepMinutes: 0, reason: 'already-ran-today' });
});

test('localMidnightUtcIso gives the UTC instant of Berlin midnight in summer and winter', () => {
  assert.equal(localMidnightUtcIso(new Date('2026-07-15T10:00:00Z'), TZ), '2026-07-14T22:00:00.000Z');
  assert.equal(localMidnightUtcIso(new Date('2026-12-01T10:00:00Z'), TZ), '2026-11-30T23:00:00.000Z');
  // 23:30 UTC on Jul 15 is already Jul 16 in Berlin
  assert.equal(localMidnightUtcIso(new Date('2026-07-15T23:30:00Z'), TZ), '2026-07-15T22:00:00.000Z');
});
