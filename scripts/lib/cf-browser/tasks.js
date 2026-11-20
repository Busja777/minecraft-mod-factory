import { findProject, findUnassigned, kindOf } from '../cf-projects.js';
import { pickUpdateVersion } from '../macro-bundle.js';
import { APPROVED } from '../review.js';
import { pageBehind } from '../page-state.js';

// Open CurseForge chores for the `npm run cf` menu.
// projects: data/cf-projects.json · packs: loaded pack.json objects
// reviews (optional): { <key>: review.json } aus dem Studio. Wenn angegeben, erscheinen neue Projekte
// erst nach dem Go (Status geplant/faellig); ohne reviews verhält sich die Liste wie früher.
// → { todo: [task], more: [task], waitingForGo: number }   task: { cmd, kind, id, label, version?, projectId? }
export function listTasks({ projects, packs, reviews }) {
  const todo = [], more = [];
  let waitingForGo = 0;
  const approved = key => !reviews || APPROVED.includes(reviews[key]?.status);

  for (const p of findUnassigned(projects)) {
    if (!approved(p.modId)) { waitingForGo++; continue; }
    todo.push({ cmd: 'publish', kind: 'mod', id: p.modId, label: `Neues Projekt veröffentlichen: ${p.name} (Mod)` });
  }

  for (const pack of packs) {
    const entry = findProject(projects, pack.slug);
    const projectId = Number.isInteger(entry?.projectId) ? entry.projectId : (Number.isInteger(pack.cfProjectId) ? pack.cfProjectId : null);
    if (!projectId) {
      if (!approved(pack.slug)) { waitingForGo++; continue; }
      todo.push({ cmd: 'publish', kind: 'skinpack', id: pack.slug, label: `Neues Projekt veröffentlichen: ${pack.name} (Skinpack)` });
      continue;
    }
    let waiting = null;
    try { waiting = pickUpdateVersion(pack); } catch { /* nothing waiting */ }
    if (waiting) todo.push({ cmd: 'update', kind: 'skinpack', id: pack.slug, projectId, version: waiting.version, label: `Skinpack-Update hochladen: ${pack.name} V${waiting.version}` });
    // The description has no API: after an upload it waits for one helper run.
    const behind = pageBehind({ ...pack, cfProjectId: projectId });
    if (behind) {
      const task = { cmd: 'seite', kind: 'skinpack', id: pack.slug, projectId, version: behind.version, label: `Beschreibung nachziehen: ${pack.name} V${behind.version}` };
      if (behind.filled) more.push({ ...task, label: `${task.label} – schon ausgefüllt, CurseForge zeigt es noch nicht` });
      else todo.push(task);
    }
    more.push({ cmd: 'media', kind: 'skinpack', id: pack.slug, projectId, label: `Cover & Media: ${pack.name}` });
  }

  for (const p of projects) {
    if (kindOf(p) === 'mod' && Number.isInteger(p.projectId)) {
      more.push({ cmd: 'media', kind: 'mod', id: p.modId, projectId: p.projectId, label: `Cover & Media: ${p.name}` });
    }
  }
  return { todo, more, waitingForGo };
}

// The day's list for `npm run cf -- heute`: everything that waits for the operator, in the order it
// is worked through in one browser window. Files first (the description describes them), then new
// projects, then descriptions. A new project only counts once its planned date has come (Studio:
// geplant → faellig); earlier it is listed as "planned" and left alone.
// → { tasks, planned, counts: { uploads, projects, pages }, summary }
const DAY_ORDER = { update: 0, publish: 1, seite: 2 };
export function dayPlan({ todo, waitingForGo = 0, reviews, now = new Date() }) {
  const due = t => {
    const r = reviews?.[t.id];
    return t.cmd !== 'publish' || !r || r.status === 'faellig' || (r.status === 'geplant' && new Date(r.slot) <= now);
  };
  const known = todo.filter(t => t.cmd in DAY_ORDER);
  const tasks = known.filter(due).sort((a, b) => DAY_ORDER[a.cmd] - DAY_ORDER[b.cmd]);
  const planned = known.filter(t => !due(t)).length;
  const n = cmd => tasks.filter(t => t.cmd === cmd).length;
  const counts = { uploads: n('update'), projects: n('publish'), pages: n('seite') };
  const parts = [
    counts.pages && `${counts.pages} ${counts.pages === 1 ? 'Beschreibung' : 'Beschreibungen'}`,
    counts.projects && `${counts.projects} ${counts.projects === 1 ? 'neues Projekt' : 'neue Projekte'}`,
    counts.uploads && `${counts.uploads} ${counts.uploads === 1 ? 'Upload' : 'Uploads'} von Hand`
  ].filter(Boolean);
  const later = [
    planned && `${planned} ${planned === 1 ? 'neues Projekt ist' : 'neue Projekte sind'} für später geplant`,
    waitingForGo && `${waitingForGo} ${waitingForGo === 1 ? 'wartet' : 'warten'} im Studio auf dein Go`
  ].filter(Boolean);
  return { tasks, planned, counts, summary: `${parts.length ? `Heute: ${parts.join(', ')}` : 'Heute ist nichts offen'}${later.length ? ` (${later.join(', ')})` : ''}` };
}
