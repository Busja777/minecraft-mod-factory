import crypto from 'crypto';

// Pure scheduling helpers for the randomized daily run windows (no I/O).

export const BUCKET_MINUTES = 30;   // cron fires every 30 min inside a window
export const SLOT_MARGIN_MINUTES = 20; // keep the slot this far from the window end

// Local wall-clock parts for an instant in a IANA timezone. weekday: 0=Sunday … 6=Saturday.
export function localParts(now, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short'
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour, minute, weekday, minutesOfDay: hour * 60 + minute
  };
}

export function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid time "${s}" (expected HH:MM)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatMinutes(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// Deterministic slot (minutes of day) for a date + window: uniform in [start, end - margin].
// Every cron fire of the same day computes the same slot.
export function slotFor({ dateKey, windowName, salt = '', start, end, margin = SLOT_MARGIN_MINUTES }) {
  const span = end - margin - start;
  if (span < 0) throw new Error(`Window ${windowName} too short for margin`);
  const hash = crypto.createHash('sha256').update(`${dateKey}|${windowName}|${salt}`).digest();
  const r = hash.readUInt32BE(0) / 0x100000000; // [0, 1)
  return start + Math.floor(r * (span + 1));
}

// Decides whether this cron fire should run the heavy job.
//   ranToday            → no (already done or running)
//   now >= end          → no (window over)
//   now >= slot         → yes, immediately (slot bucket or catch-up after a late/dropped fire)
//   slot - now <= bucket→ yes, after sleeping until the slot minute
//   otherwise           → no (too early)
export function decide({ nowMinutes, slot, windowEnd, ranToday, bucket = BUCKET_MINUTES }) {
  if (ranToday) return { run: false, sleepMinutes: 0, reason: 'already-ran-today' };
  if (nowMinutes >= windowEnd) return { run: false, sleepMinutes: 0, reason: 'window-over' };
  if (nowMinutes >= slot) return { run: true, sleepMinutes: 0, reason: nowMinutes - slot < bucket ? 'slot-reached' : 'catch-up' };
  if (slot - nowMinutes <= bucket) return { run: true, sleepMinutes: slot - nowMinutes, reason: 'waiting-for-slot' };
  return { run: false, sleepMinutes: 0, reason: 'before-slot' };
}

// UTC ISO string of local midnight (start of the local day that contains `now`).
export function localMidnightUtcIso(now, timeZone) {
  const p = localParts(now, timeZone);
  const guess = Date.UTC(p.year, p.month - 1, p.day); // treat local date as UTC, then correct by the zone offset
  const g = localParts(new Date(guess), timeZone);
  const asUtc = Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute);
  const offsetMs = asUtc - guess; // positive east of UTC
  return new Date(guess - offsetMs).toISOString();
}
