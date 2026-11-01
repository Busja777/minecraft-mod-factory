import fs from 'fs';

// Tracking file for CurseForge projects.
// Entry shape:
// { modId, name, cfName, projectId: number|null, status: 'pending'|'published'|'rejected',
//   version, lastPublishedAt: ISO|null, nextUpdateDue: ISO|null, updateCount,
//   files: [{ fileId, version, uploadedAt }] }

export const DEFAULT_PATH = './data/cf-projects.json';
export const DEFAULT_INTERVAL_DAYS = [22, 25];
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

export function newEntry({ modId, name, version = '1.0.0' }) {
  return {
    modId, name, cfName: null, projectId: null, status: 'pending',
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
  return projects.filter(p => p.status === 'pending' && Number.isInteger(p.projectId));
}

// Pending mods still waiting for the user to create the CurseForge project.
export function findUnassigned(projects) {
  return projects.filter(p => p.status === 'pending' && !Number.isInteger(p.projectId));
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

// Picks the published project whose due date is earliest and already reached; null if none is due.
export function pickForUpdate(projects, { now = new Date(), minIntervalDays = DEFAULT_INTERVAL_DAYS[0] } = {}) {
  const nowMs = now.getTime();
  const due = projects
    .filter(p => p.status === 'published' && Number.isInteger(p.projectId) && p.lastPublishedAt)
    .map(p => ({ p, due: effectiveDue(p, { minIntervalDays }) }))
    .filter(x => x.due.getTime() <= nowMs)
    .sort((a, b) => a.due - b.due);
  return due.length ? due[0].p : null;
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
