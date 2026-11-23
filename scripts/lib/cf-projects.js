import fs from 'fs';
import { localParts } from './schedule.js';

// Tracking file for CurseForge projects.
// Entry shape:
// { modId, kind: 'mod'|'skinpack', name, cfName, projectId: number|null, status: 'pending'|'published'|'rejected',
//   version, lastPublishedAt: ISO|null, nextUpdateDue: ISO|null, updateCount,
//   files: [{ fileId, version, uploadedAt }] }

export const DEFAULT_PATH = './data/cf-projects.json';
export const kindOf = p => p.kind || 'mod';
export const DEFAULT_INTERVAL_DAYS = [23, 26];
const DAY_MS = 24 * 60 * 60 * 1000;

export function loadProjects(path = DEFAULT_PATH) {
  if (!fs.existsSync(path)) return [];
  const parsed = JSON.parse(fs.readFileSync(path, 'utf-8'));
  if (!Array.isArray(parsed)) throw new Error(`${path} must contain a JSON array`);
  return parsed;
}

export function saveProjects(projects, path = DEFAULT_PATH) {
  fs.writeFileSync(path, JSON.stringify(projects, null, 2) + '\n');
}

export function newEntry({ modId, name, version = '1.0.0', kind = 'mod' }) {
  return {
    modId, kind, name, cfName: null, projectId: null, status: 'pending',
    version, lastPublishedAt: null, nextUpdateDue: null, updateCount: 0, files: []
  };
}

export function findProject(projects, modId) {
  return projects.find(p => p.modId === modId) || null;
}

// Adds the entry if the modId is unknown; otherwise leaves the existing entry untouched.
export function upsertProject(projects, entry) {
  const existing = findProject(projects, entry.modId);
  if (existing) return existing;
  projects.push(entry);
  return entry;
}

// Pending mods whose CurseForge project has been created (projectId set) → ready to upload.
export function findPending(projects) {
  return projects.filter(p => kindOf(p) === 'mod' && p.status === 'pending' && Number.isInteger(p.projectId));
}

// Pending mods still waiting for the user to create the CurseForge project.
export function findUnassigned(projects) {
  return projects.filter(p => kindOf(p) === 'mod' && p.status === 'pending' && !Number.isInteger(p.projectId));
}

// Random per-project due date: now + [min, max) days.
export function nextDueDate({ now = new Date(), intervalDays = DEFAULT_INTERVAL_DAYS, rng = Math.random } = {}) {
  const [min, max] = intervalDays;
  if (!(min >= 1) || !(max >= min)) throw new Error(`Invalid updateIntervalDays ${JSON.stringify(intervalDays)}`);
  return new Date(now.getTime() + (min + rng() * (max - min)) * DAY_MS);
}

// Effective due date of a published project: the stored nextUpdateDue, but never earlier than
// lastPublishedAt + minIntervalDays (anti-spam floor, also protects against hand-edited values).
export function effectiveDue(p, { minIntervalDays = DEFAULT_INTERVAL_DAYS[0] } = {}) {
  if (!p.lastPublishedAt) return null;
  const floor = Date.parse(p.lastPublishedAt) + minIntervalDays * DAY_MS;
  const stored = p.nextUpdateDue ? Date.parse(p.nextUpdateDue) : floor;
  return new Date(Math.max(floor, stored));
}

// Picks the next published project (mod or skin pack) in the update cycle: among the projects whose
// due date has passed (never sooner than minIntervalDays after the last upload), the one that has
// gone longest without an update. So every project takes its turn before any project gets a second
// one. null if none is due. `eligible` can exclude projects that have nothing to update (e.g. a skin
// pack without a prepared next version).
export function pickForUpdate(projects, { now = new Date(), minIntervalDays = DEFAULT_INTERVAL_DAYS[0], eligible = () => true } = {}) {
  const nowMs = now.getTime();
  const due = projects
    .filter(p => p.status === 'published' && Number.isInteger(p.projectId) && p.lastPublishedAt && eligible(p))
    .map(p => ({ p, last: Date.parse(p.lastPublishedAt), due: effectiveDue(p, { minIntervalDays }) }))
    .filter(x => x.due.getTime() <= nowMs)
    .sort((a, b) => a.last - b.last || a.due - b.due);
  return due.length ? due[0].p : null;
}

// The project uploaded on the local calendar day of `now` (newest first), or null. The evening run
// uploads at most one file per account and day; after syncLastUpload this reflects CurseForge itself,
// so a run that uploaded and then failed (e.g. on the data push) still blocks a second upload.
export function uploadedToday(projects, { now = new Date(), timeZone = 'Europe/Berlin' } = {}) {
  const today = localParts(now, timeZone).dateKey;
  return projects
    .filter(p => p.lastPublishedAt && Number.isFinite(Date.parse(p.lastPublishedAt)))
    .filter(p => localParts(new Date(p.lastPublishedAt), timeZone).dateKey === today)
    .sort((a, b) => Date.parse(b.lastPublishedAt) - Date.parse(a.lastPublishedAt))[0] || null;
}

// Takes the real last upload from the project's CurseForge files (newest first, as listFiles returns
// them), so a file uploaded by hand also counts. Returns true when lastPublishedAt moved forward.
export function syncLastUpload(p, files) {
  const newest = (files || []).map(f => Date.parse(f.fileDate)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  if (!newest || (p.lastPublishedAt && Date.parse(p.lastPublishedAt) >= newest)) return false;
  p.lastPublishedAt = new Date(newest).toISOString();
  p.nextUpdateDue = null; // effectiveDue falls back to lastPublishedAt + minIntervalDays
  return true;
}

export function markPublished(projects, modId, { projectId, fileId, version, cfName, now = new Date(), intervalDays = DEFAULT_INTERVAL_DAYS, rng = Math.random }) {
  const p = findProject(projects, modId);
  if (!p) throw new Error(`Unknown mod ${modId} in cf-projects.json`);
  const wasPublished = p.status === 'published';
  p.projectId = projectId ?? p.projectId;
  if (cfName) p.cfName = cfName;
  p.status = 'published';
  p.version = version;
  p.lastPublishedAt = now.toISOString();
  p.nextUpdateDue = nextDueDate({ now, intervalDays, rng }).toISOString();
  if (wasPublished) p.updateCount = (p.updateCount || 0) + 1;
  p.files = p.files || [];
  p.files.push({ fileId, version, uploadedAt: now.toISOString() });
  return p;
}

export function markRejected(projects, modId) {
  const p = findProject(projects, modId);
  if (!p) throw new Error(`Unknown mod ${modId} in cf-projects.json`);
  p.status = 'rejected';
  return p;
}
