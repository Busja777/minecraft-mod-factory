import fs from 'fs';
import path from 'path';

// Prepared file updates for any game with an upload API: data/projects/<slug>/
//   project.json  { slug, game, name, cfProjectId, lastGameVersions: [names],
//                   versions: [{ version, file, changelog, displayName?, gameVersions?: [names],
//                                status: 'due'|'published', fileId, publishedAt }] }
//   files/<file>  the upload of each version
// The project page itself is created once by hand; the evening run uploads the next due version.
// nextDueVersion / hasDueVersion / markVersionPublished from skinpacks.js work on this shape too.

export const PROJECTS_ROOT = './data/projects';

export const releaseDir = (slug, root = PROJECTS_ROOT) => path.join(root, slug);
export const releaseFile = (slug, file, root = PROJECTS_ROOT) => path.join(releaseDir(slug, root), 'files', file);

export function listReleaseProjects(root = PROJECTS_ROOT) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(d => fs.existsSync(path.join(root, d, 'project.json'))).sort();
}

export function loadReleaseProject(slug, root = PROJECTS_ROOT) {
  const p = path.join(releaseDir(slug, root), 'project.json');
  if (!fs.existsSync(p)) throw new Error(`No project at ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function saveReleaseProject(project, root = PROJECTS_ROOT) {
  const dir = releaseDir(project.slug, root);
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(project, null, 2) + '\n');
  return dir;
}

export function newReleaseProject({ slug, game, name, projectId }) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')) throw new Error(`Invalid slug "${slug}" (lowercase letters, digits, hyphens)`);
  if (!Number.isInteger(projectId)) throw new Error(`Invalid CurseForge projectId "${projectId}"`);
  return { slug, game, name, cfProjectId: projectId, lastGameVersions: [], versions: [] };
}

export function addVersion(project, { version, file, changelog, displayName, gameVersions }) {
  if (!version) throw new Error('A version needs a version number');
  if (project.versions.some(v => v.version === version)) throw new Error(`${project.slug} already has a version ${version}`);
  if (!file) throw new Error(`Version ${version} needs a file`);
  if (project.versions.some(v => v.file.toLowerCase() === file.toLowerCase())) throw new Error(`${project.slug} already has a file named ${file}`);
  if (!changelog || !changelog.trim()) throw new Error(`Version ${version} needs a changelog`);
  const v = { version, file, changelog: changelog.trim(), status: 'due' };
  if (displayName) v.displayName = displayName;
  if (gameVersions?.length) v.gameVersions = gameVersions;
  project.versions.push(v);
  return v;
}

// Marks versions as published when CurseForge already has a file with the same name (uploaded by
// hand) and remembers the game versions of the newest file. files: newest first (listFiles).
export function syncReleasesWithFiles(project, files) {
  const byName = new Map(files.map(f => [f.fileName.toLowerCase(), f]));
  const changed = [];
  for (const v of project.versions) {
    const f = byName.get(v.file.toLowerCase());
    if (!f) continue;
    if (v.status !== 'published') changed.push(v.version);
    Object.assign(v, { status: 'published', fileId: f.id, publishedAt: new Date(f.fileDate).toISOString() });
  }
  if (files[0]) project.lastGameVersions = files[0].gameVersions;
  return changed;
}

// Refuses an upload that could not pass moderation anyway: missing file, empty changelog, or a
// file that is byte-identical to the last published one (updates must be real changes).
export function checkRelease(project, v, root = PROJECTS_ROOT) {
  const file = releaseFile(project.slug, v.file, root);
  if (!fs.existsSync(file)) throw new Error(`V${v.version}: ${file} is missing`);
  if (!v.changelog || !v.changelog.trim()) throw new Error(`V${v.version} has no changelog`);
  const bytes = fs.readFileSync(file);
  if (!bytes.length) throw new Error(`V${v.version}: ${file} is empty`);
  const last = project.versions.filter(x => x.status === 'published').at(-1);
  const lastFile = last && releaseFile(project.slug, last.file, root);
  if (lastFile && fs.existsSync(lastFile) && bytes.equals(fs.readFileSync(lastFile))) {
    throw new Error(`V${v.version} is identical to V${last.version} — an update must change the file`);
  }
  return file;
}
