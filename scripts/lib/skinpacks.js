import fs from 'fs';
import path from 'path';

// Storage for Bedrock skin packs: data/skins/<slug>/
//   pack.json   { slug, name, packName, summary, legend, altNames, cfProjectId,
//                 versions: [{ stage, version, title, skins: [{ file, name, slim }], mcpack,
//                              status: 'published'|'due', note, media: [relPaths], fileId, publishedAt }] }
//   skins/<version>/<file>.png · mcpack/<file>.mcpack · media/*.png · <Name>.png · <Name> Cover.png

export const SKINS_ROOT = './data/skins';

export const packDir = (slug, root = SKINS_ROOT) => path.join(root, slug);

export function listPacks(root = SKINS_ROOT) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(d => fs.existsSync(path.join(root, d, 'pack.json'))).sort();
}

export function loadPack(slug, root = SKINS_ROOT) {
  const p = path.join(packDir(slug, root), 'pack.json');
  if (!fs.existsSync(p)) throw new Error(`No skin pack at ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function savePack(pack, root = SKINS_ROOT) {
  const dir = packDir(pack.slug, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(pack, null, 2) + '\n');
  return dir;
}

// V1 → 1.0, U1 → 1.1, U4 → 1.4
export function stageToVersion(stage) {
  const m = /^(V1|U(\d+))$/i.exec(String(stage).trim());
  if (!m) throw new Error(`Unknown stage "${stage}" (expected V1 or U<n>)`);
  return m[2] ? `1.${Number(m[2])}` : '1.0';
}

export function stageOrder(stage) {
  return Number(stageToVersion(stage).split('.')[1]);
}

export const publishedVersions = pack => pack.versions.filter(v => v.status === 'published');
export const nextDueVersion = pack => pack.versions.find(v => v.status === 'due') || null;
export const hasDueVersion = pack => !!nextDueVersion(pack);

export function markVersionPublished(pack, version, { fileId = null, now = new Date(), manual = false } = {}) {
  const v = pack.versions.find(x => x.version === version);
  if (!v) throw new Error(`Pack ${pack.slug} has no version ${version}`);
  Object.assign(v, { status: 'published', fileId, publishedAt: now.toISOString(), manual });
  return v;
}

export function changelogFor(v) {
  const names = v.skins.map(s => `- ${s.name}`).join('\n');
  const title = v.title ? ` — ${v.title}` : '';
  return `## V${v.version}${title}\n\n${v.note ? v.note + '\n\n' : ''}${v.version === '1.0' ? 'Skins in this pack' : 'New skins'}:\n${names}\n`;
}
