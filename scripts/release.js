import './lib/load-secrets.js';
import fs from 'fs';
import { loadReleaseProject, saveReleaseProject, syncReleasesWithFiles, checkRelease } from './lib/releases.js';
import { nextDueVersion, markVersionPublished } from './lib/skinpacks.js';
import { gameOf, tokenFor } from './lib/games.js';
import { loadProjects, saveProjects, findProject, markPublished } from './lib/cf-projects.js';
import { fetchGameVersionCatalog, carryForwardVersions, exactVersions, buildMetadata, uploadFile } from './platforms/curseforge.js';
import { listFiles } from './platforms/curseforge-core.js';
import { setOutputs, arg, flag } from './lib/github-output.js';

// Uploads the next prepared version of a project of any game in config.games (data/projects/<slug>/).
// The project page was created once by hand; this only adds a file with its changelog. The file
// gets every game version of the previous file plus the newer releases of the game (Minecraft
// Java: exactly the versions the file was built for).
// node scripts/release.js --project <slug> [--dry-run] [--release-type alpha|beta|release]
const argv = process.argv.slice(2);
const slug = arg(argv, '--project');
if (!slug) throw new Error('Usage: node scripts/release.js --project <slug> [--dry-run] [--release-type <type>]');
const dryRun = flag(argv, '--dry-run');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const releaseType = arg(argv, '--release-type', process.env.RELEASE_TYPE || config.releaseType || 'release');

const project = loadReleaseProject(slug);
const game = gameOf(config, project.game);
const projects = loadProjects();
const entry = findProject(projects, slug);
if (!entry || !Number.isInteger(entry.projectId)) throw new Error(`No CurseForge projectId for ${slug} in data/cf-projects.json`);
if (entry.status === 'rejected') throw new Error(`CurseForge project for ${slug} is marked rejected — refusing to upload`);

// A file uploaded by hand counts as published; the newest file's game versions are carried forward.
if (process.env.CF_CORE_API_KEY) {
  const changed = syncReleasesWithFiles(project, await listFiles(entry.projectId, { key: process.env.CF_CORE_API_KEY }));
  if (changed.length) console.log(`Already on CurseForge (uploaded by hand): V${changed.join(', V')}`);
  if (!dryRun) saveReleaseProject(project);
}

const v = nextDueVersion(project);
if (!v) { console.log(`${slug}: no due version`); setOutputs({ released: 'false' }); process.exit(0); }
const filePath = checkRelease(project, v);
if (game.carryNewer === false && !v.gameVersions?.length) throw new Error(`V${v.version} of ${slug} needs its game versions (${game.name} files only fit the versions they were built for)`);

const token = tokenFor(game);
if (!token && !dryRun) throw new Error(`${game.tokenEnv} is missing (upload token of the ${game.name} account)`);
let gameVersionIds = [0];
if (token) {
  const include = v.gameVersions?.length ? v.gameVersions : project.lastGameVersions || [];
  const catalog = await fetchGameVersionCatalog({ token, gameEndpoint: game.gameEndpoint });
  // carryNewer: false (Minecraft Java) → a file only gets the versions it was built for.
  const gv = game.carryNewer === false
    ? { ...exactVersions(catalog, v.gameVersions || [], { label: game.name }), added: [] }
    : carryForwardVersions(catalog, { include, types: project.versionTypes || game.versionTypes, label: game.name });
  gameVersionIds = gv.ids;
  console.log(`Game versions: ${gv.names.join(', ')}${gv.added.length ? ` (newly ticked: ${gv.added.join(', ')})` : ''}`);
} else {
  console.log(`::warning::${game.tokenEnv} not set — dry-run with unresolved game versions`);
}

const metadata = buildMetadata({ changelog: v.changelog, displayName: v.displayName || v.file, releaseType, gameVersionIds });
console.log('CurseForge metadata:', JSON.stringify(metadata, null, 2));

if (!dryRun) {
  const { fileId, url } = await uploadFile({ token, projectId: entry.projectId, filePath, metadata, gameEndpoint: game.gameEndpoint, urlSection: game.urlSection });
  console.log(`CurseForge ✓ ${url}`);
  markVersionPublished(project, v.version, { fileId });
  markPublished(projects, slug, { projectId: entry.projectId, fileId, version: v.version, intervalDays: config.updateIntervalDays });
  saveProjects(projects);
  saveReleaseProject(project);
}
console.log(`${slug} V${v.version} (${game.name}): ${dryRun ? 'checked, nothing uploaded [dry-run]' : 'uploaded'}`);
setOutputs({ released: String(!dryRun), version: v.version });
