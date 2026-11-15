import fs from 'fs';
import path from 'path';
import { localParts, parseHHMM, slotFor, localMidnightUtcIso } from './schedule.js';

// Freigabe-Ablauf für NEUE Projekte im Studio (Vorbild: Projekt A, /admin/ueberpruefen).
// Eine Prüf-Einheit (Skinpack oder Mod) hat genau einen Status:
//
//   zur-pruefung ──Teile markiert + „An Claude zurückgeben“──▶ ueberarbeiten   („Wartet auf Claude“)
//        ▲                                                         │ Claude: npm run notes → ändert → --erledigt
//        └──────────────── alle Notizen erledigt ◀─────────────────┘
//   zur-pruefung ──Go (keine offene Notiz, keine rote Prüfung)──▶ geplant (Termin) ──Termin erreicht──▶ faellig
//   geplant/faellig ──„Go zurücknehmen“──▶ zur-pruefung
//   geplant/faellig ──Komplettlauf + „Hochgeladen? j“──▶ veroeffentlicht
//
// Gespeichert in <projektordner>/review.json (liegt in Git: wer hat wann was freigegeben).
// Updates bestehender Projekte brauchen kein Go (Entscheidung des Betreibers) und tauchen hier nicht auf.

export const STATUS = {
  PRUEFUNG: 'zur-pruefung',
  CLAUDE: 'ueberarbeiten',
  GEPLANT: 'geplant',
  FAELLIG: 'faellig',
  LIVE: 'veroeffentlicht'
};
export const APPROVED = [STATUS.GEPLANT, STATUS.FAELLIG];
export const MAX_NOTE = 2000;

const iso = d => (d instanceof Date ? d : new Date(d)).toISOString();

export function newReview(now = new Date()) {
  return { status: STATUS.PRUEFUNG, round: 1, parts: {}, history: [{ at: iso(now), event: 'zur Prüfung angelegt' }] };
}

export function loadReview(dir) {
  const file = path.join(dir, 'review.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null;
}

export function saveReview(dir, review) {
  fs.writeFileSync(path.join(dir, 'review.json'), JSON.stringify(review, null, 2) + '\n');
  return review;
}

// Teile mit einer Notiz, die Claude noch nicht erledigt hat.
export const openNotes = r => Object.entries(r.parts || {}).filter(([, p]) => p.note && !p.doneAt).map(([part, p]) => ({ part, ...p }));

function expect(r, allowed, what) {
  if (!allowed.includes(r.status)) throw new Error(`${what} geht nur im Status ${allowed.join(' / ')} (aktuell: ${r.status})`);
}
const log = (r, now, event) => { r.history.push({ at: iso(now), event }); return r; };

// „Ändern“ an einem Teil: speichert, was Claude ändern soll (überschreibt eine offene Notiz desselben Teils).
export function markPart(r, part, note, now = new Date()) {
  expect(r, [STATUS.PRUEFUNG], 'Ändern');
  const text = String(note || '').trim();
  if (!text) throw new Error('Bitte schreib kurz, was Claude ändern soll');
  if (text.length > MAX_NOTE) throw new Error(`Notiz ist zu lang (max. ${MAX_NOTE} Zeichen)`);
  r.parts[part] = { note: text, at: iso(now), round: r.round };
  return log(r, now, `Ändern: ${part}`);
}

// Notiz zurücknehmen, solange sie noch nicht an Claude gegangen ist.
export function clearPart(r, part, now = new Date()) {
  expect(r, [STATUS.PRUEFUNG], 'Notiz zurücknehmen');
  if (!r.parts[part] || r.parts[part].doneAt) throw new Error(`Keine offene Notiz bei ${part}`);
  delete r.parts[part];
  return log(r, now, `Notiz zurückgenommen: ${part}`);
}

export function returnToClaude(r, now = new Date()) {
  expect(r, [STATUS.PRUEFUNG], 'An Claude zurückgeben');
  const n = openNotes(r).length;
  if (!n) throw new Error('Es gibt keine Notiz, die Claude bearbeiten könnte');
  r.status = STATUS.CLAUDE;
  return log(r, now, `an Claude zurückgegeben (${n} Notiz${n === 1 ? '' : 'en'})`);
}

// Claude hat einen Teil überarbeitet. Sind alle erledigt, liegt das Pack wieder beim Betreiber (neue Runde).
export function resolveNote(r, part, now = new Date()) {
  expect(r, [STATUS.CLAUDE], 'Erledigt melden');
  const p = r.parts[part];
  if (!p || !p.note || p.doneAt) throw new Error(`Keine offene Notiz bei ${part}`);
  p.doneAt = iso(now);
  log(r, now, `erledigt: ${part}`);
  if (!openNotes(r).length) {
    r.round += 1;
    for (const q of Object.values(r.parts)) if (q.doneAt && !q.changedInRound) q.changedInRound = r.round;
    r.status = STATUS.PRUEFUNG;
    log(r, now, `alles überarbeitet → Runde ${r.round} zur Prüfung`);
  }
  return r;
}

// Teile, die seit der aktuellen Runde neu sind (zeigt das Studio als „neu seit Runde n“).
export const changedThisRound = r => Object.entries(r.parts || {}).filter(([, p]) => p.changedInRound === r.round).map(([part]) => part);

// Go: nur ohne offene Notiz und ohne rote Prüfung. slot = ISO-Zeitpunkt aus planSlot().
export function approve(r, { checks = [], slot, now = new Date() }) {
  expect(r, [STATUS.PRUEFUNG], 'Go');
  if (openNotes(r).length) throw new Error('Es gibt noch offene Notizen: erst an Claude zurückgeben oder zurücknehmen');
  const red = checks.filter(c => c.level === 'error');
  if (red.length) throw new Error(`Prüfungen nicht bestanden: ${red.map(c => c.label).join(', ')}`);
  if (!slot) throw new Error('Kein Termin');
  Object.assign(r, { status: STATUS.GEPLANT, approvedAt: iso(now), slot });
  return log(r, now, `Go – eingeplant für ${slot}`);
}

export function withdraw(r, now = new Date()) {
  expect(r, APPROVED, 'Go zurücknehmen');
  r.status = STATUS.PRUEFUNG;
  delete r.slot;
  delete r.approvedAt;
  return log(r, now, 'Go zurückgenommen');
}

// Termin erreicht → fällig (true, wenn sich etwas geändert hat).
export function markDue(r, now = new Date()) {
  if (r.status !== STATUS.GEPLANT || new Date(r.slot) > now) return false;
  r.status = STATUS.FAELLIG;
  log(r, now, 'Termin erreicht – fällig');
  return true;
}

export function markReviewPublished(r, now = new Date()) {
  expect(r, APPROVED, 'Veröffentlicht melden');
  r.status = STATUS.LIVE;
  r.publishedAt = iso(now);
  return log(r, now, 'veröffentlicht');
}

// Nächster freier Upload-Termin: Morgenfenster (config.windows.morning) an einem Upload-Tag
// (config.newModDays, 0 = Sonntag), höchstens EIN neues Projekt pro Tag. Die Minute ist pro Tag
// fest und zufällig (slotFor, wie die bisherigen Workflows). Heute nur, wenn der Termin noch kommt.
export function planSlot({ config, now = new Date(), takenDays = [], salt = 'neues-projekt' }) {
  const tz = config.timezone || 'Europe/Berlin';
  const [startS, endS] = config.windows?.morning || ['06:00', '12:00'];
  const start = parseHHMM(startS), end = parseHHMM(endS);
  const days = config.newModDays || [1, 3, 5, 6];
  for (let i = 0; i < 60; i++) {
    const p = localParts(new Date(now.getTime() + i * 86400000), tz);
    if (!days.includes(p.weekday) || takenDays.includes(p.dateKey)) continue;
    const minute = slotFor({ dateKey: p.dateKey, windowName: 'morning', salt, start, end });
    const midnight = new Date(localMidnightUtcIso(new Date(`${p.dateKey}T12:00:00Z`), tz));
    const at = new Date(midnight.getTime() + minute * 60000);
    if (at > now) return { slot: at.toISOString(), dateKey: p.dateKey };
  }
  throw new Error('Kein freier Upload-Tag in den nächsten 60 Tagen');
}

// Tage, die schon ein eingeplantes Projekt haben.
export function takenDaysOf(reviews, config) {
  const tz = config.timezone || 'Europe/Berlin';
  return reviews.filter(r => APPROVED.includes(r.status) && r.slot).map(r => localParts(new Date(r.slot), tz).dateKey);
}
