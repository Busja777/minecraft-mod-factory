import './lib/load-secrets.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { readMcpack, humanize } from './lib/mcpack.js';
import { stageToVersion, stageOrder, newSkinsOnly, uniqueMcpackName, renumberStages, savePack, packDir, listPacks, loadPack } from './lib/skinpacks.js';
import { loadProjects, saveProjects, findProject, newEntry, nextDueDate, DEFAULT_INTERVAL_DAYS } from './lib/cf-projects.js';
import { slugify } from './lib/naming.js';
import { listFiles, syncPackWithFiles, downloadFile } from './platforms/curseforge-core.js';
import { arg } from './lib/github-output.js';

// Imports a local Bedrock skin pack folder (V1/ or root, U1…Un/) into data/skins/<slug>/ and
// registers it in data/cf-projects.json.
// node scripts/import-skinpack.js "<folder>" --project <id> --uploaded U1 [--last-upload 2026-04-18] [--name "Glowing Samurai"]
//   [--skip U3,U4]   leave out stage folders that need a check first (copies, wrong pack)
//   [--renumber]     number U-folders consecutively (U2 without U1 → U1)
// With CF_CORE_API_KEY and --project, a V1 that is missing locally is taken from CurseForge (oldest file).
// node scripts/import-skinpack.js --from-curseforge --project <id> --name "<CF name>"
//   builds the stages from the files on CurseForge (oldest = V1, then U1, U2, …) — for packs whose
//   local folder is missing or older than what is online.
const argv = process.argv.slice(2);
let folder = argv[0];
if (folder === '--from-curseforge') folder = await folderFromCurseForge();
if (!folder || folder.startsWith('--') || !fs.existsSync(folder)) {
  throw new Error('Usage: node scripts/import-skinpack.js "<folder>" --project <id> --uploaded <V1|Un> [--last-upload YYYY-MM-DD] [--name "<CF name>"]');
}
const name = arg(argv, '--name', path.basename(path.resolve(folder)));

async function folderFromCurseForge() {
  const id = Number(arg(argv, '--project'));
  if (!id || !process.env.CF_CORE_API_KEY) throw new Error('--from-curseforge needs --project <id> and CF_CORE_API_KEY');
  const files = (await listFiles(id, { key: process.env.CF_CORE_API_KEY })).reverse(); // oldest first
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-import-'));
  for (const [i, f] of files.entries()) {
    const stage = path.join(dir, i === 0 ? 'V1' : `U${i}`);
    fs.mkdirSync(stage);
    fs.writeFileSync(path.join(stage, f.fileName), await downloadFile(f));
  }
  console.log(`CurseForge ${id}: ${files.length} files downloaded as V1${files.length > 1 ? ` + U1–U${files.length - 1}` : ''}`);
  return dir;
}
const projectId = arg(argv, '--project') ? Number(arg(argv, '--project')) : null;
const uploaded = arg(argv, '--uploaded');
const lastUpload = arg(argv, '--last-upload');
const slug = slugify(name);
if (listPacks().includes(slug) && !argv.includes('--overwrite')) throw new Error(`Pack ${slug} already imported (use --overwrite)`);

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const warnings = [];
const isPreview = f => /preview|screenshot|cover|logo/i.test(f);

// Stage folders: V1 (or the folder root when there is no V1) and anything ending in U<n>.
const subdirs = fs.readdirSync(folder, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const stages = [];
const v1Dir = subdirs.find(d => /^v1$/i.test(d));
stages.push({ stage: 'V1', dir: v1Dir ? path.join(folder, v1Dir) : folder, root: !v1Dir });
for (const d of subdirs) {
  const m = /\bU(\d+)$/i.exec(d);
  if (m) stages.push({ stage: `U${m[1]}`, dir: path.join(folder, d) });
}
stages.sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage));
const skip = new Set(String(arg(argv, '--skip', '')).split(',').map(x => x.trim().toUpperCase()).filter(Boolean));
for (const st of skip) if (!stages.some(x => x.stage.toUpperCase() === st)) throw new Error(`--skip ${st}: no such stage folder`);
const kept = stages.filter(x => !skip.has(x.stage.toUpperCase()));
if (skip.size) warnings.push(`skipped on purpose: ${[...skip].join(', ')}`);
stages.splice(0, stages.length, ...(argv.includes('--renumber') ? renumberStages(kept) : kept));

// With CF_CORE_API_KEY the upload state comes from CurseForge itself (file names = .mcpack names).
let cfFiles = null;
if (process.env.CF_CORE_API_KEY && projectId) {
  cfFiles = await listFiles(projectId, { key: process.env.CF_CORE_API_KEY });
  console.log(`CurseForge project ${projectId}: ${cfFiles.length} files (${cfFiles.map(f => f.fileName).join(', ')})`);
}

async function is64(file) {
  try { const m = await sharp(file).metadata(); return m.width === 64 && m.height === 64; } catch { return false; }
}

const dir = packDir(slug);
// Re-import keeps generated texts, renders and images; only skins/ and mcpack/ are rebuilt.
const previous = listPacks().includes(slug) ? loadPack(slug) : null;
for (const sub of ['skins', 'mcpack']) fs.rmSync(path.join(dir, sub), { recursive: true, force: true });
const versions = [];
const seen = new Set(); // textures of earlier stages, so a cumulative update pack only lists its new skins
const takenNames = new Set();
let packName = name;

for (const { stage, dir: sdir, root, folderStage } of stages) {
  const version = stageToVersion(stage);
  const files = fs.readdirSync(sdir);
  let mcpacks = files.filter(f => f.toLowerCase().endsWith('.mcpack'));
  let packSource = mcpacks.length ? path.join(sdir, mcpacks[0]) : null;
  const loosePngs = files.some(f => f.toLowerCase().endsWith('.png') && !isPreview(f));
  // V1 missing locally (empty folder): the oldest file on CurseForge is the first release.
  if (stage === 'V1' && !mcpacks.length && !loosePngs && cfFiles?.length) {
    const oldest = cfFiles.at(-1);
    packSource = await downloadFile(oldest);
    mcpacks = [oldest.fileName];
    warnings.push(`V1: not in the local folder, taken from CurseForge (${oldest.fileName})`);
  }
  if (mcpacks.length > 1) warnings.push(`${stage}: ${mcpacks.length} .mcpack files, using ${mcpacks[0]}`);
  let skins = [], title = '', mcpack = null;
  fs.mkdirSync(path.join(dir, 'skins', version), { recursive: true });

  if (mcpacks.length) {
    const read = readMcpack(packSource);
    read.issues.forEach(i => warnings.push(`${stage} ${mcpacks[0]}: ${i}`));
    // A placeholder title ("pack.name") or none: the CurseForge name is the better pack name.
    if (stage === 'V1' && read.packTitle && !/^pack\.|\$\{|\|\|/.test(read.packTitle)) packName = read.packTitle;
    const desc = read.manifest.header?.description || '';
    title = desc.includes('—') ? desc.split('—').pop().trim() : '';
    const present = read.skins.filter(s => s.png);
    const fresh = newSkinsOnly(present, seen);
    if (fresh.length < present.length) console.log(`${stage}: ${present.length - fresh.length} of ${present.length} skins are already in an earlier stage, ${fresh.length} new`);
    for (const s of fresh) {
      fs.writeFileSync(path.join(dir, 'skins', version, s.texture), s.png);
      skins.push({ file: s.texture, name: s.name, slim: s.slim });
    }
    mcpack = uniqueMcpackName(mcpacks[0], version, takenNames);
    if (mcpack !== mcpacks[0]) warnings.push(`${stage}: ${mcpacks[0]} is also used by an earlier stage, stored as ${mcpack}`);
    fs.mkdirSync(path.join(dir, 'mcpack'), { recursive: true });
    if (Buffer.isBuffer(packSource)) fs.writeFileSync(path.join(dir, 'mcpack', mcpack), packSource);
    else fs.copyFileSync(packSource, path.join(dir, 'mcpack', mcpack));
  } else {
    // No .mcpack (e.g. Glowing Stoneage updates): take loose 64x64 PNGs; the pack is built at publish time.
    const pngDir = root && fs.existsSync(path.join(sdir, 'PNG')) ? path.join(sdir, 'PNG') : sdir;
    for (const f of fs.readdirSync(pngDir).filter(f => f.toLowerCase().endsWith('.png') && !isPreview(f))) {
      if (!(await is64(path.join(pngDir, f)))) continue;
      if (!newSkinsOnly([{ png: fs.readFileSync(path.join(pngDir, f)) }], seen).length) continue;
      fs.copyFileSync(path.join(pngDir, f), path.join(dir, 'skins', version, f));
      skins.push({ file: f, name: humanize(f), slim: false });
    }
    warnings.push(`${stage}: no .mcpack, ${skins.length} loose skins (pack will be built on publish)`);
  }
  if (!skins.length) { warnings.push(`${stage}: no skins found, skipped`); fs.rmSync(path.join(dir, 'skins', version), { recursive: true, force: true }); continue; }
  versions.push({ stage, ...(folderStage ? { folder: folderStage } : {}), version, title, skins, mcpack, status: 'due', note: '', media: [], fileId: null, publishedAt: null });
}
if (!versions.length) throw new Error(`No skins found in ${folder}`);

if (uploaded && !cfFiles) {
  const upTo = stageOrder(uploaded);
  for (const v of versions) if (stageOrder(v.stage) <= upTo) Object.assign(v, { status: 'published', publishedAt: lastUpload ? new Date(lastUpload).toISOString() : null });
}

if (previous) {
  for (const v of versions) {
    const old = previous.versions.find(x => x.version === v.version);
    if (old) Object.assign(v, { note: old.note || '', media: old.media || [] });
  }
}
const keep = previous ? Object.fromEntries(['summary', 'legend', 'altNames', 'logoPrompt', 'coverPrompt', 'logoFile', 'coverFile'].filter(k => previous[k] !== undefined).map(k => [k, previous[k]])) : {};
const source = argv[0] === '--from-curseforge' ? 'curseforge' : path.basename(path.resolve(folder));
const pack = { slug, name, packName, summary: '', legend: '', altNames: [], ...keep, cfProjectId: projectId, source, versions };
if (cfFiles) {
  syncPackWithFiles(pack, cfFiles);
  const unknown = cfFiles.filter(f => !versions.some(v => v.mcpack?.toLowerCase() === f.fileName.toLowerCase()));
  unknown.forEach(f => warnings.push(`CurseForge file ${f.fileName} matches no local version`));
}
savePack(pack);

// Register / update the tracking entry.
const projects = loadProjects();
let entry = findProject(projects, slug);
if (!entry) { entry = newEntry({ modId: slug, name, kind: 'skinpack' }); projects.push(entry); }
Object.assign(entry, { kind: 'skinpack', game: 'bedrock', projectId, cfName: name });
const published = versions.filter(v => v.status === 'published');
// Already on CurseForge → published (updates wait for the projectId); nothing uploaded yet → pending.
if (published.length) {
  const lastFile = cfFiles?.[0]?.fileDate;
  const last = lastFile ? new Date(lastFile) : lastUpload ? new Date(lastUpload) : new Date();
  entry.status = 'published';
  entry.version = published.at(-1).version;
  entry.lastPublishedAt = last.toISOString();
  entry.nextUpdateDue = nextDueDate({ now: last, intervalDays: config.updateIntervalDays || DEFAULT_INTERVAL_DAYS }).toISOString();
  if (!lastUpload && !lastFile) warnings.push('no --last-upload given: first update waits the full 22–25 days from today');
  if (!projectId) warnings.push('no --project given: updates start once the CurseForge projectId is set in data/cf-projects.json');
} else {
  entry.status = 'pending';
}
saveProjects(projects);

console.log(`Imported "${name}" (${packName}) → ${dir}`);
for (const v of versions) console.log(`  ${v.stage} → V${v.version} ${v.status.padEnd(9)} ${v.skins.length} skins ${v.mcpack || '(no mcpack)'}${v.title ? ` — ${v.title}` : ''}`);
console.log(`  cf-projects: ${entry.status}, next update due ${entry.nextUpdateDue || '—'}`);
warnings.forEach(w => console.log(`::warning::${w}`));
