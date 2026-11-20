import './lib/load-secrets.js';
import fs from 'fs';
import path from 'path';
import { loadPack, savePack, packDir, nextDueVersion, markVersionPublished, changelogFor } from './lib/skinpacks.js';
import { ensureCompletePack } from './lib/complete-pack.js';
import { skinpackUpdateKit, versionImageUrls } from './lib/kit.js';
import { loadProjects, saveProjects, findProject, markPublished } from './lib/cf-projects.js';
import { fetchGameVersionCatalog, bedrockVersions, buildMetadata, uploadFile } from './platforms/curseforge.js';
import { listFiles, syncPackWithFiles } from './platforms/curseforge-core.js';
import { setOutputs, arg, flag } from './lib/github-output.js';

// Releases the next due version of a skin pack (run after render-skins.js and skin-meta.js):
// makes sure the .mcpack holds every skin so far (builds a complete pack if not), writes the changelog, uploads to CurseForge Bedrock when
// config.bedrock.uploadApi is on, records the release and writes ./kit-issue.json with the new
// description section (the description itself has no API).
// node scripts/skin-release.js --pack <slug> [--dry-run] [--release-type alpha|beta|release]
const argv = process.argv.slice(2);
const slug = arg(argv, '--pack');
if (!slug) throw new Error('Usage: node scripts/skin-release.js --pack <slug> [--dry-run] [--release-type <type>]');
const dryRun = flag(argv, '--dry-run');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const b = config.bedrock || {};
const releaseType = arg(argv, '--release-type', process.env.RELEASE_TYPE || config.releaseType || 'release');

const pack = loadPack(slug);
const dir = packDir(slug);
const projectsForSync = loadProjects();
const syncEntry = findProject(projectsForSync, slug);
if (process.env.CF_CORE_API_KEY && Number.isInteger(syncEntry?.projectId)) {
  const changed = syncPackWithFiles(pack, await listFiles(syncEntry.projectId, { key: process.env.CF_CORE_API_KEY }));
  if (changed.length) console.log(`Already on CurseForge (uploaded by hand): V${changed.join(', V')}`);
  savePack(pack);
}
const v = nextDueVersion(pack);
if (!v) { console.log(`${slug}: no due version`); setOutputs({ released: 'false' }); process.exit(0); }
if (!v.media?.length) throw new Error(`V${v.version} has no renders — run render-skins.js --pack ${slug} first`);
if (!v.note) throw new Error(`V${v.version} has no update note — run skin-meta.js --pack ${slug} first`);

// The uploaded file always carries every skin up to this version (new players download only the latest file).
const complete = ensureCompletePack(pack, v, dir);
console.log(complete.built
  ? `Built ${complete.file}: all ${complete.total} skins (${complete.missing} were missing from ${v.sourceMcpack || 'the version'}), stable pack UUID`
  : `${complete.file} already contains all ${complete.total} skins`);
v.changelog = changelogFor(v, { imageUrls: versionImageUrls(pack, v), total: complete.total });
const filePath = path.join(dir, 'mcpack', v.mcpack);

const projects = loadProjects();
const entry = findProject(projects, slug);
if (!entry || !Number.isInteger(entry.projectId)) throw new Error(`No CurseForge projectId for ${slug} in data/cf-projects.json`);

let fileId = null, fileUrl = null, uploaded = false;
if (b.uploadApi) {
  const token = process.env.CF_API_TOKEN;
  if (!token && !dryRun) throw new Error('CF_API_TOKEN is missing');
  let gameVersionIds = [0];
  if (token) {
    // Every version of the previous file plus the newest Minecraft releases it did not have yet.
    const gv = bedrockVersions(await fetchGameVersionCatalog({ token, gameEndpoint: b.gameEndpoint }), { prefix: b.versionPrefix, include: pack.lastGameVersions || [] });
    gameVersionIds = gv.ids;
    console.log(`Game versions: ${gv.names.length}, newest ${gv.newest}${gv.added.length ? `, newly ticked: ${gv.added.join(', ')}` : ''}`);
  }
  const metadata = buildMetadata({ changelog: v.changelog, displayName: v.mcpack, releaseType, gameVersionIds });
  console.log('CurseForge metadata:', JSON.stringify(metadata, null, 2));
  if (!dryRun) {
    ({ fileId, url: fileUrl } = await uploadFile({ token, projectId: entry.projectId, filePath, metadata, gameEndpoint: b.gameEndpoint }));
    uploaded = true;
    console.log(`CurseForge ✓ ${fileUrl}`);
  }
} else {
  console.log('Bedrock upload API disabled (config.bedrock.uploadApi=false) — upload goes into the issue checklist');
}

fs.writeFileSync('./kit-issue.json', JSON.stringify({
  title: `Skinpack-Update V${v.version}: ${pack.name} (${slug})`,
  labels: ['cf-skin-update'],
  body: skinpackUpdateKit(pack, v, config, { uploaded, fileUrl })
}, null, 2));

if (!dryRun) {
  markVersionPublished(pack, v.version, { fileId, manual: !uploaded });
  markPublished(projects, slug, { projectId: entry.projectId, fileId, version: v.version, intervalDays: config.updateIntervalDays });
  saveProjects(projects);
}
savePack(pack);
console.log(`${slug} V${v.version}: ${uploaded ? 'uploaded' : 'prepared for manual upload'}${dryRun ? ' [dry-run]' : ''}`);
setOutputs({ released: 'true', version: v.version, uploaded: String(uploaded) });
