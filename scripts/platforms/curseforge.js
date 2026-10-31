import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

// CurseForge Upload API (legacy "upload-file" API, authenticated with the UUID upload token
// from Account Settings → My API Tokens — NOT the Studios key that starts with $2a$).
// Docs: https://support.curseforge.com/en/support/solutions/articles/9000197321-curseforge-upload-api
// L1: always form.getBuffer() with native fetch.

export const DEFAULT_CACHE = './data/cf-game-versions.json';

export function apiBase(gameEndpoint = 'minecraft') {
  return `https://${gameEndpoint}.curseforge.com/api`;
}

async function getJson(url, token, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'X-Api-Token': token } });
  if (!res.ok) throw new Error(`CurseForge GET ${url} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function fetchGameVersionCatalog({ token, gameEndpoint = 'minecraft', fetchImpl = fetch } = {}) {
  if (!token) throw new Error('CF_API_TOKEN is missing');
  const base = apiBase(gameEndpoint);
  const [types, versions] = await Promise.all([
    getJson(`${base}/game/version-types`, token, fetchImpl),
    getJson(`${base}/game/versions`, token, fetchImpl)
  ]);
  return { types, versions };
}

function findVersion(catalog, typeMatcher, nameMatcher) {
  const typeIds = new Set(catalog.types.filter(typeMatcher).map(t => t.id));
  return catalog.versions.find(v => typeIds.has(v.gameVersionTypeID) && nameMatcher(v.name)) || null;
}

const eq = a => b => String(a).toLowerCase() === String(b).toLowerCase();

// Resolves the numeric game-version IDs for an upload. Minecraft version + loader are
// mandatory (throws if unresolved); Java and Environment are best-effort.
export function matchGameVersionIds(catalog, { mcVersion, loader = 'Fabric', java = 'Java 21', environments = ['Server', 'Client'] }) {
  const majorMinor = mcVersion.split('.').slice(0, 2).join('.');
  const mc =
    findVersion(catalog, t => eq(`Minecraft ${majorMinor}`)(t.name), eq(mcVersion)) ||
    findVersion(catalog, t => /^minecraft\b/i.test(t.name), eq(mcVersion));
  if (!mc) throw new Error(`CurseForge game version "${mcVersion}" not found in catalog`);

  const loaderV = findVersion(catalog, t => /modloader/i.test(t.name) || /modloader/i.test(t.slug || ''), eq(loader));
  if (!loaderV) throw new Error(`CurseForge modloader "${loader}" not found in catalog`);

  const ids = [mc.id, loaderV.id];
  const warnings = [];
  const javaV = java ? findVersion(catalog, t => /^java$/i.test(t.name), eq(java)) : null;
  if (java && !javaV) warnings.push(`Java version "${java}" not found, skipping`);
  if (javaV) ids.push(javaV.id);
  for (const env of environments) {
    const envV = findVersion(catalog, t => /^environment$/i.test(t.name), eq(env));
    if (envV) ids.push(envV.id); else warnings.push(`Environment "${env}" not found, skipping`);
  }
  return { ids, warnings, resolved: { mcVersion, loader, java: javaV ? java : null } };
}

// Resolves IDs with a per-mcVersion cache file so CI does not hit the catalog on every run.
export async function resolveGameVersions({ token, mcVersion, loader = 'Fabric', cachePath = DEFAULT_CACHE, fetchImpl = fetch, gameEndpoint = 'minecraft' }) {
  const key = `${gameEndpoint}:${mcVersion}:${loader}`;
  let cache = {};
  if (fs.existsSync(cachePath)) {
    try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')); } catch { cache = {}; }
  }
  if (Array.isArray(cache[key]) && cache[key].length >= 2) return { ids: cache[key], warnings: [], fromCache: true };

  const catalog = await fetchGameVersionCatalog({ token, gameEndpoint, fetchImpl });
  const result = matchGameVersionIds(catalog, { mcVersion, loader });
  cache[key] = result.ids;
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n');
  return { ...result, fromCache: false };
}

export function buildMetadata({ changelog, displayName, releaseType = 'release', gameVersionIds }) {
  if (!changelog || !changelog.trim()) throw new Error('CurseForge requires a non-empty changelog');
  if (!['alpha', 'beta', 'release'].includes(releaseType)) throw new Error(`Invalid releaseType "${releaseType}"`);
  if (!Array.isArray(gameVersionIds) || gameVersionIds.length === 0) throw new Error('gameVersionIds must not be empty');
  return { changelog, changelogType: 'markdown', displayName, gameVersions: gameVersionIds, releaseType };
}

function formatError(status, text) {
  try {
    const { errorCode, errorMessage } = JSON.parse(text);
    if (errorMessage) return `CurseForge upload failed (${status}, code ${errorCode}): ${errorMessage}`;
  } catch { /* not JSON */ }
  return `CurseForge upload failed (${status}): ${text}`;
}

export async function uploadFile({ token, projectId, jarPath, metadata, gameEndpoint = 'minecraft', fetchImpl = fetch }) {
  if (!token) throw new Error('CF_API_TOKEN is missing');
  if (!Number.isInteger(Number(projectId))) throw new Error(`Invalid CurseForge projectId "${projectId}"`);
  const form = new FormData();
  form.append('metadata', JSON.stringify(metadata), { contentType: 'application/json' });
  form.append('file', fs.readFileSync(jarPath), { filename: path.basename(jarPath), contentType: 'application/java-archive' });

  const res = await fetchImpl(`${apiBase(gameEndpoint)}/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: { 'X-Api-Token': token, ...form.getHeaders() },
    body: form.getBuffer()
  });
  const text = await res.text();
  if (!res.ok) throw new Error(formatError(res.status, text));
  const result = JSON.parse(text);
  return { fileId: result.id, url: `https://www.curseforge.com/minecraft/mc-mods/${projectId}/files/${result.id}` };
}
