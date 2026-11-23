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
  assert.deepEqual(decide({ nowMinutes: parseHHMM('20:00'), slot, windowEnd, ranToday: false }), { run: false, sleepMinutes: 0, reason: 'before-slot' });
  assert.deepEqual(decide({ nowMinutes: parseHHMM('20:10'), slot, windowEnd, ranToday: false }), { run: true, sleepMinutes: 7, reason: 'waiting-for-slot' });
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

import { planAccounts, WAKE_UP_BUCKET_MINUTES, SLOT_MARGIN_MINUTES } from '../scripts/lib/schedule.js';

test('planAccounts: every account draws its own slot and runs at most once a day', () => {
  const base = { accounts: ['minecraft', 'stardewvalley', 'wow'], dateKey: '2026-11-20', windowName: 'evening', salt: 'repo', start: 18 * 60, end: 21 * 60 };
  const late = planAccounts({ ...base, nowMinutes: 20 * 60 + 50 });
  assert.deepEqual(late.map(x => x.account), base.accounts);
  for (const x of late) {
    assert.ok(x.slot >= 18 * 60 && x.slot <= 21 * 60 - 20, 'slot inside the window');
    assert.equal(x.run, true);
  }
  assert.ok(new Set(late.map(x => x.slot)).size > 1, 'the accounts do not share one slot');
  assert.deepEqual(planAccounts({ ...base, nowMinutes: 20 * 60 + 50 }).map(x => x.slot), late.map(x => x.slot), 'same slots on every fire of the day');
  assert.notDeepEqual(planAccounts({ ...base, dateKey: '2026-11-21', nowMinutes: 0 }).map(x => x.slot), late.map(x => x.slot));

  const ran = planAccounts({ ...base, nowMinutes: 20 * 60 + 50, ran: new Set(['wow']) });
  assert.deepEqual(ran.map(x => x.run), [true, true, false]);
  assert.equal(ran[2].reason, 'already-ran-today');
  assert.ok(planAccounts({ ...base, nowMinutes: 17 * 60 }).every(x => !x.run), 'before the window nothing starts');
  assert.ok(planAccounts({ ...base, nowMinutes: 21 * 60 }).every(x => x.reason === 'window-over'));
});

test('planAccounts with a wake-up bucket: an early start waits for every slot of the day', () => {
  // The daily wake-up call (a Claude routine, since GitHub's own cron arrives hours late or not at all)
  // starts the workflow once before the window; every leg sleeps until its own slot.
  const base = { accounts: ['minecraft', 'wow'], dateKey: '2026-11-23', windowName: 'evening', salt: 'repo', start: 18 * 60, end: 21 * 60 };
  const early = planAccounts({ ...base, nowMinutes: 16 * 60 + 50, bucket: WAKE_UP_BUCKET_MINUTES });
  for (const x of early) {
    assert.equal(x.run, true);
    assert.equal(x.reason, 'waiting-for-slot');
    assert.equal(x.sleepMinutes, x.slot - (16 * 60 + 50), 'sleeps exactly until the slot');
  }
  const normal = planAccounts({ ...base, nowMinutes: 16 * 60 + 50 });
  assert.deepEqual(early.map(x => x.slot), normal.map(x => x.slot), 'the wake-up call does not move the slots');
  assert.ok(normal.every(x => !x.run), 'a cron fire before the window still waits');
  assert.ok(planAccounts({ ...base, nowMinutes: 21 * 60 + 30, bucket: WAKE_UP_BUCKET_MINUTES }).every(x => x.reason === 'window-over'), 'late wake-up call: nothing');
  assert.deepEqual(planAccounts({ ...base, nowMinutes: 16 * 60 + 50, bucket: WAKE_UP_BUCKET_MINUTES, ran: new Set(['wow']) }).map(x => x.run), [true, false]);
});

test('the update job outlasts the longest wait of a wake-up call', async () => {
  const fs = await import('fs');
  const yml = fs.readFileSync('.github/workflows/evening.yml', 'utf-8');
  const update = yml.slice(yml.indexOf('\n  update:'));
  const timeout = Number(/timeout-minutes: (\d+)/.exec(update)[1]);
  const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
  const [, end] = config.windows.evening.map(parseHHMM);
  // The wake-up routine fires at 15:50 UTC = 16:50 Berlin in winter (17:50 in summer).
  const longestSleep = end - SLOT_MARGIN_MINUTES - (16 * 60 + 50);
  assert.ok(timeout >= longestSleep + 75, `update job: ${timeout} min must cover ${longestSleep} min of waiting plus 75 min of work`);
  assert.ok(timeout <= 360, 'GitHub stops every job after 6 hours');
  assert.ok(longestSleep <= WAKE_UP_BUCKET_MINUTES);
  assert.match(yml, /waitForSlot:/, 'workflow_dispatch input for a wake-up call by hand');
  assert.match(yml, /issue_comment:\n\s+types: \[created\]/, 'the routine wakes the workflow with a comment');
  assert.match(yml, /WAIT_FOR_SLOT: \$\{\{ \(inputs\.waitForSlot \|\| github\.event_name == 'issue_comment'\)/, 'the gate gets the wake-up flag');
  const gate = yml.slice(yml.indexOf('\n  gate:'), yml.indexOf('\n  update:'));
  assert.match(gate, /contains\(github\.event\.issue\.labels\.\*\.name, 'abend-wecker'\)/, 'only the wake-up issue counts');
  assert.match(gate, /github\.event\.comment\.user\.login == github\.repository_owner/, 'only the owner (or the routine acting for the owner) wakes the run');
  assert.doesNotMatch(yml, /github\.event\.comment\.body|github\.event\.issue\.title/, 'comment text never reaches a command');
});

test('the evening cron fires every BUCKET_MINUTES, off the full and half hour, across the whole window', async () => {
  const fs = await import('fs');
  const { BUCKET_MINUTES } = await import('../scripts/lib/schedule.js');
  const yml = fs.readFileSync('.github/workflows/evening.yml', 'utf-8');
  const m = /cron: '(\d+)-59\/(\d+) (\d+)-(\d+) \* \* \*'\n\s+timezone: Europe\/Berlin/.exec(yml);
  assert.ok(m, 'cron line "<offset>-59/<step> <from>-<to> * * *" with timezone Europe/Berlin');
  const [, offset, step, from, to] = m.map(Number);
  assert.equal(step, BUCKET_MINUTES, 'one fire per bucket, so a slot is never skipped and never started twice');
  assert.ok(offset % 30 !== 0, 'not at :00 or :30, where GitHub drops the most fires');
  const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
  const [start, end] = config.windows.evening.map(parseHHMM);
  assert.ok(from * 60 + offset <= start - BUCKET_MINUTES, 'first fire before the window opens');
  assert.ok(to * 60 + 59 >= end - BUCKET_MINUTES, 'fires until the window closes');
});

