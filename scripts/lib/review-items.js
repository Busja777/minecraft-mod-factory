import fs from 'fs';
import path from 'path';
import { listPacks, loadPack, packDir, changelogFor } from './skinpacks.js';
import { listMods, loadMod, modDir } from './mods.js';
import { loadProjects, findProject, kindOf } from './cf-projects.js';
import { skinpackKitFields, modKitFields, versionImageUrls } from './kit.js';
import { pickUpdateVersion } from './macro-bundle.js';
import { loadReview, newReview, saveReview, openNotes, changedThisRound, STATUS } from './review.js';
import { runChecks } from './checks.js';

// Sammelt die Prüf-Einheiten fürs Studio aus data/skins und data/mods.
// Eine Einheit = ein NEUES Projekt (noch ohne CurseForge-Projekt-ID) oder eines mit review.json.
// Teile (parts) sind das, was der Betreiber einzeln mit „Ändern“ zurückgeben kann.

const rel = p => p.replace(/^\.\//, '');
export const fileUrl = p => `/files/${rel(p).split('/').map(encodeURIComponent).join('/')}`;

function projectIdOf(projects, id, fallback) {
  const e = findProject(projects, id);
  if (Number.isInteger(e?.projectId)) return e.projectId;
  return Number.isInteger(fallback) ? fallback : null;
}

function skinpackUnit(slug, projects) {
  const pack = loadPack(slug);
  const dir = packDir(slug);
  const projectId = projectIdOf(projects, slug, pack.cfProjectId);
  let review = loadReview(dir);
  if (!review && projectId) return null; // bestehendes Projekt ohne Studio-Historie → nur Updates
  return { kind: 'skinpack', key: slug, dir, pack, projectId, review };
}

function modUnit(modId, projects) {
  const entry = findProject(projects, modId);
  const dir = modDir(modId);
  const review = loadReview(dir);
  if (!review && !(entry && kindOf(entry) === 'mod' && entry.status === 'pending' && !Number.isInteger(entry.projectId))) return null;
  return { kind: 'mod', key: modId, dir, meta: loadMod(modId).meta, projectId: Number.isInteger(entry?.projectId) ? entry.projectId : null, review };
}

// Alle Einheiten; fehlende review.json wird für neue Projekte angelegt (Status zur-pruefung).
export function loadUnits({ now = new Date(), persist = true } = {}) {
  const projects = loadProjects();
  const units = [
    ...listPacks().map(s => skinpackUnit(s, projects)),
    ...listMods().map(m => modUnit(m, projects))
  ].filter(Boolean);
  for (const u of units) {
    if (!u.review) {
      u.review = newReview(now);
      if (persist) saveReview(u.dir, u.review);
    }
  }
  return units;
}

export function findUnit(kind, key, opts) {
  return loadUnits(opts).find(u => u.kind === kind && u.key === key) || null;
}

export function fieldsOf(u, config) {
  return u.kind === 'skinpack' ? skinpackKitFields(u.pack, config, { mode: 'new' }) : modKitFields(u.meta, config, { modId: u.key });
}

// Alles, was der Prüf-Modus für eine Einheit zeigt.
export async function unitDetail(u, config) {
  const f = fieldsOf(u, config);
  const parts = [
    { id: 'name', label: 'Projektname', type: 'text', value: f.name },
    { id: 'summary', label: 'Summary', type: 'text', value: f.summary },
    { id: 'logo', label: 'Logo (400×400)', type: 'image', src: fileUrl(`${f.dir}/${f.logo}`) },
    { id: 'cover', label: `Cover (720×340) · Galerie-Titel „${f.galleryTitle}“`, type: 'image', src: fileUrl(`${f.dir}/${f.cover}`) }
  ];
  const files = { logo: `${f.dir}/${f.logo}`, cover: `${f.dir}/${f.cover}` };
  let threeD = null;
  if (u.kind === 'skinpack') {
    const v = u.pack.versions[0];
    for (const s of v.skins || []) {
      const single = `${f.dir}/media/v${v.version}/${s.file}`;
      const raw = `${f.dir}/skins/${v.version}/${s.file}`;
      parts.push({ id: `skin:${s.file}`, label: s.name, type: 'skin', src: fs.existsSync(single) ? fileUrl(single) : fileUrl(raw), texture: fileUrl(raw) });
    }
    parts.push({ id: 'beschreibung', label: 'Beschreibung', type: 'markdown', value: f.description });
    parts.push({ id: 'changelog', label: `Changelog V${v.version}`, type: 'markdown', value: v.changelog || changelogFor(v, { imageUrls: versionImageUrls(u.pack, v) }) });
    parts.push({ id: 'datei', label: 'Datei', type: 'text', value: v.mcpack || '(noch keine .mcpack)' });
    files.mcpack = `${f.dir}/mcpack/${v.mcpack}`;
    const preview = `previews/${u.key}/index.html`;
    if (fs.existsSync(preview)) threeD = fileUrl(preview);
  } else {
    parts.push({ id: 'beschreibung', label: 'Beschreibung', type: 'markdown', value: f.description });
  }
  const checks = await runChecks(f, files);
  const r = u.review;
  const changed = changedThisRound(r);
  for (const p of parts) {
    const state = r.parts[p.id];
    p.note = state && !state.doneAt ? state.note : null;
    p.changed = changed.includes(p.id);
    p.lastNote = state?.doneAt ? state.note : null;
  }
  return { kind: u.kind, key: u.key, name: f.name, status: r.status, round: r.round, slot: r.slot || null, projectId: u.projectId, parts, checks, threeD, history: r.history.slice(-8) };
}

// Updates bestehender Projekte (ohne Go): nächster Termin + ggf. wartender manueller Upload.
export function updateInfo() {
  const projects = loadProjects();
  return projects.filter(p => p.status === 'published' && p.nextUpdateDue).map(p => {
    let waiting = null;
    if (kindOf(p) === 'skinpack' && listPacks().includes(p.modId)) {
      try { waiting = pickUpdateVersion(loadPack(p.modId)).version; } catch { /* nichts wartet */ }
    }
    return { kind: kindOf(p), key: p.modId, name: p.name, version: p.version, nextUpdateDue: p.nextUpdateDue, waiting };
  }).sort((a, b) => a.nextUpdateDue.localeCompare(b.nextUpdateDue));
}

// Übersicht in Abschnitten (Reihenfolge wie im Studio).
export function overview(units) {
  const card = u => {
    const name = u.kind === 'skinpack' ? u.pack.name : u.meta.name;
    const logo = u.kind === 'skinpack' ? `${u.dir}/${u.pack.logoFile || `${name}.png`}` : `${u.dir}/${u.meta.logoFile || `${name}.png`}`;
    return { kind: u.kind, key: u.key, name, status: u.review.status, round: u.review.round, slot: u.review.slot || null, notes: openNotes(u.review).length, logo: fs.existsSync(logo) ? fileUrl(logo) : null, publishedAt: u.review.publishedAt || null };
  };
  const by = s => units.filter(u => u.review.status === s).map(card);
  return {
    faellig: by(STATUS.FAELLIG),
    go: by(STATUS.PRUEFUNG),
    claude: by(STATUS.CLAUDE),
    geplant: by(STATUS.GEPLANT).sort((a, b) => a.slot.localeCompare(b.slot)),
    live: by(STATUS.LIVE).sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '')).slice(0, 10),
    updates: updateInfo()
  };
}

export const unitDirs = units => units.map(u => path.resolve(u.dir));
