import './lib/load-secrets.js';
import fs from 'fs';
import { loadProjects, saveProjects, pickForUpdate, syncLastUpload, findUnassigned, kindOf, DEFAULT_INTERVAL_DAYS } from './lib/cf-projects.js';
import { listFiles } from './platforms/curseforge-core.js';
import { loadPack, hasDueVersion, listPacks } from './lib/skinpacks.js';
import { localParts } from './lib/schedule.js';
import { setOutputs } from './lib/github-output.js';

// Decides what this run does. MODE:
//   update        → due project (oldest due first) or, with INPUT_MOD_ID, that project; nothing due → skip
//   scheduled-new → new mod if today (local) is in config.newModDays and the kit backlog is below maxPendingKits; else skip
//   new           → always a new mod
//   auto          → update if something is due, else scheduled-new logic (manual convenience)
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const mode = (process.env.MODE || 'auto').toLowerCase();
const requested = (process.env.INPUT_MOD_ID || '').trim();
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const projects = loadProjects();
const minIntervalDays = (config.updateIntervalDays || DEFAULT_INTERVAL_DAYS)[0];
const maxPendingKits = config.maxPendingKits ?? 5;
const newModDays = config.newModDays || [1, 3, 5, 6];
const local = localParts(now, config.timezone || 'Europe/Berlin');
const packs = new Set(listPacks());

// The real last upload comes from CurseForge (a file uploaded by hand counts too), so the 23-day
// rule and the cycle order hold even when data/cf-projects.json is behind. Read-only Core API.
async function syncLastUploads() {
  const key = process.env.CF_CORE_API_KEY;
  if (!key) { console.log('No CF_CORE_API_KEY — using the last uploads from data/cf-projects.json'); return; }
  const moved = [];
  for (const p of projects.filter(p => p.status === 'published' && Number.isInteger(p.projectId))) {
    try {
      if (syncLastUpload(p, await listFiles(p.projectId, { key }))) moved.push(`${p.modId} → ${p.lastPublishedAt.slice(0, 10)}`);
    } catch (e) {
      console.log(`::warning::Could not read the CurseForge files of ${p.modId}: ${e.message}`);
    }
  }
  if (moved.length) { console.log(`Last uploads taken from CurseForge: ${moved.join(', ')}`); saveProjects(projects); }
}
if (mode === 'update' || mode === 'auto') await syncLastUploads();

// Skin packs are only updatable while a prepared next version exists (local U-folders).
const eligible = p => kindOf(p) !== 'skinpack' || (packs.has(p.modId) && hasDueVersion(loadPack(p.modId)));

function pickUpdate() {
  if (requested) {
    const target = projects.find(p => p.modId === requested);
    if (!target) throw new Error(`No project with modId "${requested}" in data/cf-projects.json`);
    if (target.status !== 'published' || !Number.isInteger(target.projectId)) {
      throw new Error(`Project "${requested}" is ${target.status} without a published file — cannot update`);
    }
    if (!eligible(target)) throw new Error(`Skin pack "${requested}" has no prepared next version`);
    return target;
  }
  return pickForUpdate(projects, { now, minIntervalDays, eligible });
}

function scheduledNew() {
  const waiting = findUnassigned(projects).length;
  if (!newModDays.includes(local.weekday)) return { mode: 'skip', modId: '', reason: `weekday ${local.weekday} not in newModDays` };
  if (waiting >= maxPendingKits) {
    console.log(`::warning::${waiting} kits are waiting for CurseForge project creation (limit ${maxPendingKits}) — not generating a new mod.`);
    return { mode: 'skip', modId: '', reason: 'kit-backlog' };
  }
  return { mode: 'new', modId: '', reason: 'scheduled' };
}

let result;
if (mode === 'new') {
  result = { mode: 'new', modId: '', reason: 'manual' };
} else if (mode === 'update') {
  const target = pickUpdate();
  result = target ? { mode: 'update', modId: target.modId, reason: requested ? 'manual' : 'due' } : { mode: 'skip', modId: '', reason: 'nothing-due' };
} else if (mode === 'scheduled-new') {
  result = scheduledNew();
} else if (mode === 'auto') {
  const target = pickUpdate();
  result = target ? { mode: 'update', modId: target.modId, reason: 'due' } : scheduledNew();
} else {
  throw new Error(`Unknown MODE "${mode}" (expected new|update|scheduled-new|auto)`);
}

const picked = result.modId ? projects.find(p => p.modId === result.modId) : null;
result.kind = picked ? kindOf(picked) : 'mod';

console.log(`Selected mode: ${result.mode}${result.mode === 'update' ? ` [${result.kind}]` : ''}${result.modId ? ` (${result.modId})` : ''} — ${result.reason}`);
setOutputs(result);
