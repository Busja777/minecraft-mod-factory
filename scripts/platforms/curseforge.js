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

// CurseForge echoes part of a bad token in its error text; the repo and its CI logs are public.
export function redact(text) {
  return String(text).replace(/(Token provided:\s*)\S+/gi, '$1[redacted]');
}

async function getJson(url, token, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'X-Api-Token': token } });
  if (!res.ok) throw new Error(`CurseForge GET ${url} failed (${res.status}): ${redact(await res.text())}`);
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

// Compares Bedrock version names numerically ("26.10" > "26.3", "27.0" > "26.60").
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

const NUMERIC = /^\d+(\.\d+)*$/;

// Game versions for the next file of a project, for any game: every release version the previous
// file listed (`include`), every one starting with `prefix`, and every one newer than all of
// those, so a new game release is always ticked as well. Beta/preview/snapshot versions are skipped.
//   types       names of the version types that count for "newer" (WoW: ['WoW Retail'], so a Retail
//               addon never gets Classic versions); default: all types
//   numericOnly carry only numeric version names forward (Bedrock); otherwise names like the
//               Sims 4 expansion packs of the previous file are kept too
// Nothing to carry forward (first file of a project) → the newest release version alone.
// → { ids, names, newest, added }
export function carryForwardVersions(catalog, { include = [], prefix = null, types = null, numericOnly = false, label = 'game' } = {}) {
  const skipTypes = new Set(catalog.types.filter(t => /beta|preview|snapshot/i.test(`${t.name} ${t.slug || ''}`)).map(t => t.id));
  const releases = catalog.versions.filter(v => !skipTypes.has(v.gameVersionTypeID) && !/beta|preview/i.test(v.name));
  const numeric = v => NUMERIC.test(String(v.name));
  const typeIds = types?.length ? new Set(catalog.types.filter(t => types.some(n => eq(n)(t.name))).map(t => t.id)) : null;
  if (typeIds && !typeIds.size) throw new Error(`CurseForge has no ${label} version type named ${types.join(' / ')}`);
  const counts = v => numeric(v) && (!typeIds || typeIds.has(v.gameVersionTypeID));

  const wanted = new Set(include.map(String));
  const base = releases.filter(v => (wanted.has(String(v.name)) && (!numericOnly || numeric(v))) || (prefix && numeric(v) && String(v.name).startsWith(prefix)));
  if (prefix && !base.length) throw new Error(`No CurseForge ${label} game versions start with "${prefix}"`);

  const candidates = releases.filter(counts).sort((x, y) => compareVersions(x.name, y.name));
  const top = base.filter(counts).map(v => String(v.name)).sort(compareVersions).at(-1);
  const newer = top ? candidates.filter(v => compareVersions(v.name, top) > 0) : candidates.slice(-1);
  const picked = [...base, ...newer];
  if (!picked.length) throw new Error(`No CurseForge ${label} game versions found`);

  // One id per name; where two types share a name, the one from `types` wins.
  const byName = new Map();
  for (const v of picked) if (!byName.has(String(v.name)) || counts(v)) byName.set(String(v.name), v);
  const all = [...byName.keys()];
  const names = [...all.filter(n => NUMERIC.test(n)).sort(compareVersions), ...all.filter(n => !NUMERIC.test(n)).sort()];
  return {
    ids: [...new Set(names.map(n => byName.get(n).id))],
    names,
    newest: names.filter(n => NUMERIC.test(n)).at(-1) || null,
    added: names.filter(n => !wanted.has(n))
  };
}

// Bedrock files list many game versions (e.g. 1.21.x and 26.0 … 26.60): the versions of the previous
// file, everything starting with `prefix` and every newer Minecraft release (27.0, …).
export function bedrockVersions(catalog, { prefix = '26.', include = [] } = {}) {
  return carryForwardVersions(catalog, { prefix, include, numericOnly: true, label: 'Bedrock' });
}

export function matchBedrockVersionIds(catalog, options = {}) {
  return bedrockVersions(catalog, options).ids;
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
    if (errorMessage) return `CurseForge upload failed (${status}, code ${errorCode}): ${redact(errorMessage)}`;
  } catch { /* not JSON */ }
  return `CurseForge upload failed (${status}): ${redact(text)}`;
}

const CONTENT_TYPES = { '.jar': 'application/java-archive', '.mcpack': 'application/zip', '.mcaddon': 'application/zip', '.zip': 'application/zip' };

// urlSection: path of the game's project pages on curseforge.com (config.games.<key>.urlSection).
export async function uploadFile({ token, projectId, jarPath, filePath = jarPath, metadata, gameEndpoint = 'minecraft', urlSection, fetchImpl = fetch }) {
  if (!token) throw new Error('CF_API_TOKEN is missing');
  if (!Number.isInteger(Number(projectId))) throw new Error(`Invalid CurseForge projectId "${projectId}"`);
  const form = new FormData();
  form.append('metadata', JSON.stringify(metadata), { contentType: 'application/json' });
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  form.append('file', fs.readFileSync(filePath), { filename: path.basename(filePath), contentType });

  const res = await fetchImpl(`${apiBase(gameEndpoint)}/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: { 'X-Api-Token': token, ...form.getHeaders() },
    body: form.getBuffer()
  });
  const text = await res.text();
  if (!res.ok) throw new Error(formatError(res.status, text));
  const result = JSON.parse(text);
  const section = urlSection || (gameEndpoint === 'minecraft' ? 'minecraft/mc-mods' : 'minecraft-bedrock/skins');
  return { fileId: result.id, url: `https://www.curseforge.com/${section}/${projectId}/files/${result.id}` };
}
