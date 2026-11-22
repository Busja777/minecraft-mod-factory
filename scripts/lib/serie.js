import fs from 'fs';
import path from 'path';
import { loadReleaseProject, saveReleaseProject, newReleaseProject, addVersion, releaseFile, listReleaseProjects } from './releases.js';
import { findProject, newEntry } from './cf-projects.js';

// The series: per game one row of 33 projects (data/serie/<reihe>.json), one upload per row and day.
//   { reihe, game, title, start: 'YYYY-MM-DD', logoStyle, arts: { code: label }, reserve: [names],
//     projects: [{ nr, slug, name, art, was, updates: [3 texts], nameChecked?: false }] }
// A project's source lives in tools/<reihe>/projects/<slug>/ (page.json, logo.png, changelogs/, src/),
// its stock in data/projects/<slug>/ (lib/releases.js), also before its CurseForge page exists.

export const SERIE_ROOT = './data/serie';
export const REIHEN = ['wow', 'java', 'stardew', 'bedrock'];

export function loadReihe(key, root = SERIE_ROOT) {
  const file = path.join(root, `${key}.json`);
  if (!fs.existsSync(file)) throw new Error(`Unbekannte Reihe "${key}" (${file} fehlt)`);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function saveReihe(reihe, root = SERIE_ROOT) {
  fs.writeFileSync(path.join(root, `${reihe.reihe}.json`), JSON.stringify(reihe, null, 2) + '\n');
}

export const loadReihen = (root = SERIE_ROOT) => REIHEN.filter(k => fs.existsSync(path.join(root, `${k}.json`))).map(k => loadReihe(k, root));

// → { reihe, project } or throws.
export function findSerieProject(reihen, slug) {
  for (const reihe of reihen) {
    const project = reihe.projects.find(p => p.slug === slug);
    if (project) return { reihe, project };
  }
  throw new Error(`Kein Serien-Projekt "${slug}"`);
}

export const projectDir = (reiheKey, slug, toolsRoot = './tools') => path.join(toolsRoot, reiheKey, 'projects', slug);
export const outDir = (reiheKey, project, outRoot = './Output/serie') => path.join(outRoot, reiheKey, `${String(project.nr).padStart(2, '0')}-${project.slug}`);

// Planned day of project nr: start + nr - 1 (calendar days, no time zone involved).
export function plannedDate(reihe, nr) {
  const [y, m, d] = reihe.start.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + nr - 1)).toISOString().slice(0, 10);
}

// Stock: the release project exists from the first built version on, with cfProjectId null until
// the operator has created the page.
export function ensureStockProject(reihe, project, root) {
  if (listReleaseProjects(root).includes(project.slug)) return loadReleaseProject(project.slug, root);
  const rp = newReleaseProject({ slug: project.slug, game: reihe.game, name: project.name, projectId: null });
  saveReleaseProject(rp, root);
  return rp;
}

// Puts a built, checked file into the stock. → the version entry
export function addStock(reihe, project, { version, file, changelog, gameVersions, versionTypes }, root) {
  if (!fs.existsSync(file)) throw new Error(`Datei fehlt: ${file}`);
  const rp = ensureStockProject(reihe, project, root);
  if (versionTypes?.length) rp.versionTypes = versionTypes;
  const v = addVersion(rp, { version, file: path.basename(file), changelog, gameVersions });
  saveReleaseProject(rp, root);
  fs.copyFileSync(file, releaseFile(project.slug, v.file, root));
  return v;
}

// geplant → gebaut (V1.0 in stock) → angelegt (ID entered, waits for its evening) → online
export function stateOf(project, { cfProjects = [], releaseRoot } = {}) {
  const entry = findProject(cfProjects, project.slug);
  if (entry?.status === 'published') return 'online';
  if (entry && Number.isInteger(entry.projectId)) return 'angelegt';
  if (!listReleaseProjects(releaseRoot).includes(project.slug)) return 'geplant';
  return loadReleaseProject(project.slug, releaseRoot).versions.length ? 'gebaut' : 'geplant';
}

// Versions still waiting in stock (0 when nothing is built).
export function stockCount(project, releaseRoot) {
  if (!listReleaseProjects(releaseRoot).includes(project.slug)) return 0;
  return loadReleaseProject(project.slug, releaseRoot).versions.filter(v => v.status === 'due').length;
}

// Overview of one row. vorsprung: built projects that are not online yet (days of head start).
export function reiheStand(reihe, ctx = {}) {
  const rows = reihe.projects.map(p => ({ ...p, state: stateOf(p, ctx), planned: plannedDate(reihe, p.nr), stock: stockCount(p, ctx.releaseRoot) }));
  const count = s => rows.filter(r => r.state === s).length;
  const next = rows.find(r => r.state !== 'online') || null;
  return {
    reihe: reihe.reihe, title: reihe.title, rows, next,
    online: count('online'), angelegt: count('angelegt'), gebaut: count('gebaut'), geplant: count('geplant'),
    vorsprung: count('gebaut') + count('angelegt')
  };
}

// Entering the project ID is the operator's Go for the first file: the entry is pending with
// autoStart, so the evening leg of the row uploads V1.0 by itself (select-mode.js).
export function registerProject(reihe, project, projectId, { cfProjects, releaseRoot, cfName = null } = {}) {
  if (!Number.isInteger(projectId) || projectId <= 0) throw new Error(`Ungültige Projekt-ID "${projectId}"`);
  if (cfProjects.some(p => p.projectId === projectId)) throw new Error(`Die Projekt-ID ${projectId} ist schon eingetragen.`);
  if (findProject(cfProjects, project.slug)) throw new Error(`"${project.slug}" ist schon eingetragen.`);
  if (!listReleaseProjects(releaseRoot).includes(project.slug)) throw new Error(`"${project.slug}" hat noch keine gebaute Version im Vorrat.`);
  const rp = loadReleaseProject(project.slug, releaseRoot);
  const first = rp.versions[0];
  if (!first) throw new Error(`"${project.slug}" hat noch keine gebaute Version im Vorrat.`);
  rp.cfProjectId = projectId;
  saveReleaseProject(rp, releaseRoot);
  const entry = {
    ...newEntry({ modId: project.slug, name: project.name, kind: 'file', version: first.version }),
    game: reihe.game, cfName: cfName || project.name, projectId, autoStart: true, serie: { reihe: reihe.reihe, nr: project.nr }
  };
  cfProjects.push(entry);
  return entry;
}
