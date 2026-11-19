import './lib/load-secrets.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { readMcpack } from './lib/mcpack.js';
import { listPacks, loadPack } from './lib/skinpacks.js';
import { loadProjects } from './lib/cf-projects.js';
import { listFiles } from './platforms/curseforge-core.js';
import { classify, simulateSchedule, renderMarkdown, toCsv } from './lib/inventory.js';
import { renderPage, renderPreview } from './lib/inventory-page.js';
import { packDir } from './lib/skinpacks.js';
import { arg } from './lib/github-output.js';

// Stock overview of every CurseForge project of the account: what is on CurseForge, what is
// prepared locally, what the evening runs will upload next. Reads only (Core API + local folders).
// npm run bestand [-- --out Output/bestand]   → bestand.html (overview page), BESTAND.md, bestand.csv
const argv = process.argv.slice(2);
const AUTHOR_ID = 132070502;
const GAMES = [78022, 432]; // Minecraft Bedrock, Minecraft Java
const key = process.env.CF_CORE_API_KEY;
if (!key) throw new Error('CF_CORE_API_KEY fehlt in secrets.env');
const outDir = path.resolve(arg(argv, '--out', 'Output/bestand'));
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const mapping = JSON.parse(fs.readFileSync('./data/bestand.json', 'utf-8'));
const ROOT = mapping.root.replace(/^~/, os.homedir());

async function search(gameId) {
  const all = [];
  for (let index = 0; ; index += 50) {
    const res = await fetch(`https://api.curseforge.com/v1/mods/search?gameId=${gameId}&authorId=${AUTHOR_ID}&pageSize=50&index=${index}`, { headers: { 'x-api-key': key, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`CurseForge search failed (${res.status})`);
    const page = (await res.json()).data;
    all.push(...page);
    if (page.length < 50) return all;
  }
}

const isPreview = f => /preview|screenshot|cover|logo/i.test(f);
async function is64(file) {
  try { const m = await sharp(file).metadata(); return m.width === 64 && (m.height === 64 || m.height === 32); } catch { return false; }
}

// [{ stage: 'V1'|'U1'…, skins }] — skins = largest skin pack in the folder, else loose 64x64 PNGs.
async function scanFolder(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  const subs = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  const stages = [];
  const v1 = subs.find(s => /^v1$/i.test(s));
  stages.push({ stage: 'V1', dir: v1 ? path.join(dir, v1) : dir });
  for (const s of subs) { const m = /\bU(\d+)$/i.exec(s); if (m) stages.push({ stage: `U${m[1]}`, dir: path.join(dir, s) }); }
  stages.sort((a, b) => (a.stage === 'V1' ? 0 : Number(a.stage.slice(1))) - (b.stage === 'V1' ? 0 : Number(b.stage.slice(1))));
  for (const s of stages) {
    const files = fs.readdirSync(s.dir);
    let skins = 0;
    for (const f of files.filter(f => /\.mcpack$/i.test(f))) {
      try { skins = Math.max(skins, readMcpack(path.join(s.dir, f)).skins.length); } catch { /* not a skin pack */ }
    }
    if (!skins) for (const f of files.filter(f => /\.png$/i.test(f) && !isPreview(f))) if (await is64(path.join(s.dir, f))) skins++;
    s.skins = skins;
    delete s.dir;
  }
  return stages;
}

const now = new Date();
const projects = (await Promise.all(GAMES.map(search))).flat();
const packs = Object.fromEntries(listPacks().map(s => [s, loadPack(s)]));
const packById = Object.fromEntries(Object.values(packs).filter(p => Number.isInteger(p.cfProjectId)).map(p => [p.cfProjectId, p]));
const entries = loadProjects();

const rows = [];
for (const project of projects) {
  const map = mapping.projects[String(project.id)] || {};
  const files = await listFiles(project.id, { key });
  const stages = map.folder ? await scanFolder(path.join(ROOT, map.folder)) : [];
  const pack = packById[project.id] || null;
  const entry = pack ? entries.find(e => e.modId === pack.slug) : null;
  rows.push(classify({ project, files, pack, stages, entry, map, now }));
}

// Folders under the skin root that belong to no project (possible new projects).
const used = new Set([...Object.values(mapping.projects).map(m => m.folder), ...mapping.ignore].filter(Boolean));
const skinRoot = path.join(ROOT, mapping.skinRoot);
const localOnly = [];
for (const name of fs.readdirSync(skinRoot).sort()) {
  const rel = `${mapping.skinRoot}/${name}`;
  if (used.has(rel) || !fs.statSync(path.join(skinRoot, name)).isDirectory()) continue;
  const stages = await scanFolder(path.join(skinRoot, name));
  if (stages.some(s => s.skins)) localOnly.push({ folder: name, stages });
}

const schedule = simulateSchedule({ entries, packs, now, evenings: 150, intervalDays: config.updateIntervalDays });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'BESTAND.md'), renderMarkdown({ rows, schedule, localOnly, now }));
fs.writeFileSync(path.join(outDir, 'bestand.csv'), toCsv(rows));
fs.writeFileSync(path.join(outDir, 'bestand.html'), renderPage({ rows, schedule, localOnly, decisions: mapping.decisions || [], now }));
// Preview page with copies of the render rows next to it (Output/ is not in git).
const imgDir = path.join(outDir, 'vorschau-bilder');
fs.mkdirSync(imgDir, { recursive: true });
const imageFor = (pack, v) => {
  const src = v.media?.[0] && path.join(packDir(pack.slug), v.media[0]);
  if (!src || !fs.existsSync(src)) return null;
  const name = `${pack.slug}-v${v.version}.png`;
  fs.copyFileSync(src, path.join(imgDir, name));
  return `vorschau-bilder/${name}`;
};
fs.writeFileSync(path.join(outDir, 'vorschau.html'), renderPreview({ packs: Object.values(packs), imageFor, now }));
const count = g => rows.filter(r => r.group === g).length;
console.log(`✓ ${rows.length} Projekte: A ${count('A')} · B ${count('B')} · Resource Packs ${count('RP')} · Java ${count('Java')} · ${localOnly.length} lokale Ordner ohne Projekt`);
console.log(`  ${schedule.length} Updates im Fahrplan → ${path.relative(process.cwd(), outDir)}/bestand.html (Übersicht), vorschau.html (alle Skins), BESTAND.md, bestand.csv`);
