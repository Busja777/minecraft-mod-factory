import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { readMcpack, humanize } from './lib/mcpack.js';
import { stageToVersion, stageOrder, savePack, packDir, listPacks, loadPack } from './lib/skinpacks.js';
import { loadProjects, saveProjects, findProject, newEntry, nextDueDate, DEFAULT_INTERVAL_DAYS } from './lib/cf-projects.js';
import { slugify } from './lib/naming.js';
import { listFiles, syncPackWithFiles } from './platforms/curseforge-core.js';
import { arg } from './lib/github-output.js';

// Imports a local Bedrock skin pack folder (V1/ or root, U1…Un/) into data/skins/<slug>/ and
// registers it in data/cf-projects.json.
// node scripts/import-skinpack.js "<folder>" --project <id> --uploaded U1 [--last-upload 2026-04-18] [--name "Glowing Samurai"]
const argv = process.argv.slice(2);
const folder = argv[0];
if (!folder || folder.startsWith('--') || !fs.existsSync(folder)) {
  throw new Error('Usage: node scripts/import-skinpack.js "<folder>" --project <id> --uploaded <V1|Un> [--last-upload YYYY-MM-DD] [--name "<CF name>"]');
}
const name = arg(argv, '--name', path.basename(path.resolve(folder)));
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

async function is64(file) {
  try { const m = await sharp(file).metadata(); return m.width === 64 && m.height === 64; } catch { return false; }
}

const dir = packDir(slug);
// Re-import keeps generated texts, renders and images; only skins/ and mcpack/ are rebuilt.
const previous = listPacks().includes(slug) ? loadPack(slug) : null;
for (const sub of ['skins', 'mcpack']) fs.rmSync(path.join(dir, sub), { recursive: true, force: true });
const versions = [];
let packName = name;

for (const { stage, dir: sdir, root } of stages) {
  const version = stageToVersion(stage);
  const files = fs.readdirSync(sdir);
  const mcpacks = files.filter(f => f.toLowerCase().endsWith('.mcpack'));
  if (mcpacks.length > 1) warnings.push(`${stage}: ${mcpacks.length} .mcpack files, using ${mcpacks[0]}`);
  let skins = [], title = '', mcpack = null;
  fs.mkdirSync(path.join(dir, 'skins', version), { recursive: true });

  if (mcpacks.length) {
    const read = readMcpack(path.join(sdir, mcpacks[0]));
    read.issues.forEach(i => warnings.push(`${stage} ${mcpacks[0]}: ${i}`));
    if (stage === 'V1' && read.packTitle) packName = read.packTitle;
    const desc = read.manifest.header?.description || '';
    title = desc.includes('—') ? desc.split('—').pop().trim() : '';
    for (const s of read.skins) {
      if (!s.png) continue;
      fs.writeFileSync(path.join(dir, 'skins', version, s.texture), s.png);
      skins.push({ file: s.texture, name: s.name, slim: s.slim });
    }
    mcpack = mcpacks[0];
    fs.mkdirSync(path.join(dir, 'mcpack'), { recursive: true });
    fs.copyFileSync(path.join(sdir, mcpack), path.join(dir, 'mcpack', mcpack));
  } else {
    // No .mcpack (e.g. Glowing Stoneage updates): take loose 64x64 PNGs; the pack is built at publish time.
    const pngDir = root && fs.existsSync(path.join(sdir, 'PNG')) ? path.join(sdir, 'PNG') : sdir;
    for (const f of fs.readdirSync(pngDir).filter(f => f.toLowerCase().endsWith('.png') && !isPreview(f))) {
      if (!(await is64(path.join(pngDir, f)))) continue;
      fs.copyFileSync(path.join(pngDir, f), path.join(dir, 'skins', version, f));
      skins.push({ file: f, name: humanize(f), slim: false });
    }
    warnings.push(`${stage}: no .mcpack, ${skins.length} loose skins (pack will be built on publish)`);
  }
  if (!skins.length) { warnings.push(`${stage}: no skins found, skipped`); fs.rmSync(path.join(dir, 'skins', version), { recursive: true, force: true }); continue; }
  versions.push({ stage, version, title, skins, mcpack, status: 'due', note: '', media: [], fileId: null, publishedAt: null });
}
if (!versions.length) throw new Error(`No skins found in ${folder}`);

// With CF_CORE_API_KEY the upload state comes from CurseForge itself (file names = .mcpack names).
let cfFiles = null;
if (process.env.CF_CORE_API_KEY && projectId) {
  cfFiles = await listFiles(projectId, { key: process.env.CF_CORE_API_KEY });
  console.log(`CurseForge project ${projectId}: ${cfFiles.length} files (${cfFiles.map(f => f.fileName).join(', ')})`);
}
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
const pack = { slug, name, packName, summary: '', legend: '', altNames: [], ...keep, cfProjectId: projectId, source: path.basename(path.resolve(folder)), versions };
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
