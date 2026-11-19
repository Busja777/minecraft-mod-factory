// CurseForge Core API (api.curseforge.com), read-only. Authenticated with the Studios key
// ("$2a$…", secret CF_CORE_API_KEY) — the upload API needs the separate UUID token instead.
const BASE = 'https://api.curseforge.com/v1';

async function get(path, key, fetchImpl = fetch) {
  if (!key) throw new Error('CF_CORE_API_KEY is missing');
  const res = await fetchImpl(`${BASE}${path}`, { headers: { 'x-api-key': key, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CurseForge Core API ${path} failed (${res.status})`);
  return (await res.json()).data;
}

export async function findGameId(slug, { key, fetchImpl } = {}) {
  const games = await get('/games?pageSize=50', key, fetchImpl);
  const g = games.find(x => x.slug === slug);
  if (!g) throw new Error(`CurseForge game "${slug}" not found`);
  return g.id;
}

export async function findProjectBySlug({ gameSlug = 'minecraft-bedrock', slug, key, fetchImpl }) {
  const gameId = await findGameId(gameSlug, { key, fetchImpl });
  const hits = await get(`/mods/search?gameId=${gameId}&slug=${encodeURIComponent(slug)}`, key, fetchImpl);
  return hits.find(m => m.slug === slug) || null;
}

// Newest first: [{ id, fileName, fileDate, gameVersions: [names], releaseType }]
export async function listFiles(projectId, { key, fetchImpl, pageSize = 50 } = {}) {
  const files = await get(`/mods/${projectId}/files?pageSize=${pageSize}`, key, fetchImpl);
  return files
    .map(f => ({ id: f.id, fileName: f.fileName, fileDate: f.fileDate, gameVersions: f.gameVersions || [], releaseType: f.releaseType, downloadUrl: f.downloadUrl || null }))
    .sort((a, b) => Date.parse(b.fileDate) - Date.parse(a.fileDate));
}

// Downloads one of the project's own files (e.g. a V1 that only exists on CurseForge any more).
export async function downloadFile(file, fetchImpl = fetch) {
  if (!file?.downloadUrl) throw new Error(`CurseForge offers no download for ${file?.fileName || 'this file'}`);
  const res = await fetchImpl(file.downloadUrl);
  if (!res.ok) throw new Error(`Download of ${file.fileName} failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// Project description as CurseForge stores it (HTML).
export async function getDescription(projectId, { key, fetchImpl } = {}) {
  return (await get(`/mods/${projectId}/description`, key, fetchImpl)) || '';
}

// Gallery of a project: [{ id, title, url }]
export async function getScreenshots(projectId, { key, fetchImpl } = {}) {
  const mod = await get(`/mods/${projectId}`, key, fetchImpl);
  return (mod?.screenshots || []).map(s => ({ id: s.id, title: s.title || '', url: s.url }));
}

// Marks pack versions as published when CurseForge already has a file with the same .mcpack name.
export function syncPackWithFiles(pack, files) {
  const byName = new Map(files.map(f => [f.fileName.toLowerCase(), f]));
  const changed = [];
  for (const v of pack.versions) {
    // sourceMcpack: the original file when the release replaced it with a complete pack
    const f = [v.mcpack, v.sourceMcpack].filter(Boolean).map(n => byName.get(n.toLowerCase())).find(Boolean);
    if (f && v.status !== 'published') changed.push(v.version);
    if (f) Object.assign(v, { status: 'published', fileId: f.id, publishedAt: new Date(f.fileDate).toISOString() });
  }
  if (files[0]) pack.lastGameVersions = files[0].gameVersions;
  return changed;
}
