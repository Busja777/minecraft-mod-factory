import { findProject, upsertProject, newEntry, markPublished } from '../cf-projects.js';
import { markVersionPublished } from '../skinpacks.js';

// Writes what the browser run learned back into the pipeline's state (pure: mutates the objects
// passed in, the caller saves them).

// "https://authors.curseforge.com/#/projects/1498885/files" → ".../projects/{id}/files"
export function urlTemplate(url, projectId) {
  if (!url || !projectId) return null;
  const s = String(projectId);
  return url.includes(s) ? url.replace(s, '{id}') : null;
}

// After "Create": the new project's id goes into data/cf-projects.json (and pack.json).
export function recordProjectId({ projects, pack, task, name, projectId }) {
  const entry = findProject(projects, task.id) || upsertProject(projects, newEntry({ modId: task.id, name, kind: task.kind, version: pack?.versions?.[0]?.version }));
  entry.projectId = projectId;
  if (task.kind === 'skinpack') entry.game = 'bedrock';
  if (pack) pack.cfProjectId = projectId;
  return entry;
}

// After the user confirmed "Add File": the version counts as published (uploaded by hand), and the
// project's next update is scheduled (23–26 days, config.updateIntervalDays).
export function recordUpload({ projects, pack, task, version, intervalDays, now = new Date(), rng }) {
  const v = pack.versions.find(x => x.version === version);
  if (!v) throw new Error(`${pack.name} hat keine Version ${version}`);
  if (v.status === 'published') return null; // already recorded (e.g. by skin-release.js)
  markVersionPublished(pack, version, { manual: true, now });
  const entry = findProject(projects, task.id);
  if (!entry || !Number.isInteger(entry.projectId)) throw new Error(`Keine Projekt-ID für ${task.id} in data/cf-projects.json`);
  return markPublished(projects, task.id, { projectId: entry.projectId, fileId: v.fileId ?? null, version, now, intervalDays, rng });
}
