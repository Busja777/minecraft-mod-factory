import fs from 'fs';
import path from 'path';
import { loadMod, latestChangelog } from './lib/mods.js';
import { loadProjects, saveProjects, findProject, markPublished } from './lib/cf-projects.js';
import { resolveGameVersions, buildMetadata, uploadFile } from './platforms/curseforge.js';
import { createProject as createModrinthProject } from './platforms/modrinth.js';
import { setOutputs, arg, flag } from './lib/github-output.js';

// Uploads the built jar of a stored mod to the configured platforms.
// node scripts/publish.js --mod <modId> [--dry-run] [--release-type alpha|beta|release]
const argv = process.argv.slice(2);
const modId = arg(argv, '--mod');
if (!modId) throw new Error('Usage: node scripts/publish.js --mod <modId> [--dry-run] [--release-type <type>]');
const dryRun = flag(argv, '--dry-run');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const platforms = (process.env.PLATFORMS || (config.platforms || ['curseforge']).join(',')).split(',').map(s => s.trim()).filter(Boolean);
const releaseType = arg(argv, '--release-type', process.env.RELEASE_TYPE || config.releaseType || 'release');
const mcVersion = config.mcVersion || '1.21.1';

const { meta } = loadMod(modId);
const version = meta.version;
const changelog = latestChangelog(meta);

const libsDir = './template/build/libs';
const jars = fs.existsSync(libsDir) ? fs.readdirSync(libsDir).filter(f => f.endsWith('.jar') && !f.includes('sources') && !f.includes('javadoc')) : [];
const jarFile = jars.find(f => f === `${modId}-${version}.jar`) || jars[0];
if (!jarFile) throw new Error(`No jar for ${modId} in ${libsDir} — run inject + gradle build first`);
const jarPath = path.join(libsDir, jarFile);
console.log(`Publishing ${meta.name} v${version} (${jarFile}, ${(fs.statSync(jarPath).size / 1024).toFixed(0)} KB) to: ${platforms.join(', ')}${dryRun ? ' [dry-run]' : ''}`);

const projects = loadProjects();
const outputs = { modId, version };

if (platforms.includes('curseforge')) {
  const entry = findProject(projects, modId);
  if (!entry || !Number.isInteger(entry.projectId)) {
    throw new Error(`No CurseForge projectId for ${modId} in data/cf-projects.json — create the project from the kit first`);
  }
  if (entry.status === 'rejected') throw new Error(`CurseForge project for ${modId} is marked rejected — refusing to upload`);
  const token = process.env.CF_API_TOKEN;
  let gameVersionIds;
  if (token) {
    const gv = await resolveGameVersions({ token, mcVersion });
    gv.warnings?.forEach(w => console.log(`::warning::${w}`));
    gameVersionIds = gv.ids;
  } else if (dryRun) {
    console.log('::warning::CF_API_TOKEN not set — dry-run with unresolved game versions');
    gameVersionIds = [0];
  } else {
    throw new Error('CF_API_TOKEN is missing');
  }
  const metadata = buildMetadata({ changelog, displayName: `${meta.name} v${version}`, releaseType, gameVersionIds });
  console.log('CurseForge metadata:', JSON.stringify(metadata, null, 2));
  if (!dryRun) {
    const { fileId, url } = await uploadFile({ token, projectId: entry.projectId, jarPath, metadata });
    markPublished(projects, modId, { projectId: entry.projectId, fileId, version });
    saveProjects(projects);
    console.log(`CurseForge ✓ project ${entry.projectId}, file ${fileId} → ${url}`);
    Object.assign(outputs, { cfProjectId: entry.projectId, cfFileId: fileId });
  }
}

if (platforms.includes('modrinth')) {
  if (!dryRun) {
    const { slug } = await createModrinthProject({
      token: process.env.MODRINTH_API_TOKEN, mod: meta, jarPath, version, changelog, releaseType,
      iconPath: `./data/mods/${modId}/icon.png`,
      screenshots: [['./images/screenshot1.png', 'Feature showcase'], ['./images/screenshot2.png', 'UI overview']]
    });
    const entry = findProject(projects, modId);
    if (entry) { entry.modrinthSlug = slug; saveProjects(projects); }
    outputs.modrinthSlug = slug;
  } else {
    console.log('Modrinth: would create a new project (dry-run)');
  }
}

// Legacy anti-duplicate list used by generate.js; keep it in sync for published mods.
if (!dryRun) {
  const publishedPath = './data/published-mods.json';
  const published = fs.existsSync(publishedPath) ? JSON.parse(fs.readFileSync(publishedPath, 'utf-8')) : [];
  if (!published.some(p => p.modId === modId)) {
    published.push({ name: meta.name, modId, description: meta.description, features: meta.features, publishedAt: new Date().toISOString(), cfProjectId: outputs.cfProjectId ?? null, modrinthSlug: outputs.modrinthSlug ?? null });
    fs.writeFileSync(publishedPath, JSON.stringify(published, null, 2) + '\n');
  }
}

setOutputs(outputs);
