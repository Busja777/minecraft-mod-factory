import { findProject, findUnassigned, kindOf } from '../cf-projects.js';
import { pickUpdateVersion } from '../macro-bundle.js';
import { APPROVED } from '../review.js';
import { pageBehind, behindLabel } from '../page-state.js';

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
    // Description and gallery have no API: after an upload the page waits for one helper run.
    const behind = pageBehind({ ...pack, cfProjectId: projectId });
    if (behind) {
      const task = { cmd: 'seite', kind: 'skinpack', id: pack.slug, projectId, version: behind.version, label: `Seite nachziehen: ${pack.name} (${behindLabel(behind)})` };
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
