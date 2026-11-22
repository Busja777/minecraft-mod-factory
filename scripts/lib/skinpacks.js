import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { shortName } from './description.js';

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

// Update packs are often cumulative ("…_Complete.mcpack" repeats every earlier skin). Returns only
// the skins whose texture was not part of an earlier stage and remembers the new ones in `seen`.
export function newSkinsOnly(skins, seen = new Set()) {
  const fresh = [];
  for (const s of skins) {
    const hash = crypto.createHash('sha1').update(s.png).digest('hex');
    if (seen.has(hash)) continue;
    seen.add(hash);
    fresh.push(s);
  }
  return fresh;
}

// Several stages often ship a file with the same name (Arabic_Medieval_Skins.mcpack in V1 and every
// U-folder). The first keeps its name (that is the one on CurseForge), later ones get the version
// appended so they do not overwrite each other in data/skins/<slug>/mcpack/.
export function uniqueMcpackName(name, version, taken) {
  if (!taken.has(name.toLowerCase())) { taken.add(name.toLowerCase()); return name; }
  const unique = name.replace(/(\.mcpack)$/i, `_V${version.replace('.', '_')}$1`);
  taken.add(unique.toLowerCase());
  return unique;
}

// --renumber: U-folders numbered with gaps ("Granpa Skinpack U2" without U1) become U1, U2, … in order.
export function renumberStages(stages) {
  let n = 0;
  return stages.map(s => (s.stage === 'V1' ? s : { ...s, stage: `U${++n}`, folderStage: s.stage }));
}

export const publishedVersions = pack => pack.versions.filter(v => v.status === 'published');
// The next version to upload. A version can wait for its season: with `preferFrom`
// (YYYY-MM-DD) it is not due before that day, and the versions after it wait too, because every
// stock file contains everything before it and the order never changes. Other projects of the
// same leg go up in the meantime.
const day = now => new Date(now).toISOString().slice(0, 10);
export const nextDueVersion = (pack, now = new Date()) => {
  const v = pack.versions.find(x => x.status === 'due') || null;
  return v?.preferFrom && day(now) < v.preferFrom ? null : v;
};
export const hasDueVersion = (pack, now = new Date()) => !!nextDueVersion(pack, now);
// A version waiting for its season: { version, preferFrom } or null.
export const seasonHold = (pack, now = new Date()) => {
  const v = pack.versions.find(x => x.status === 'due');
  return v?.preferFrom && day(now) < v.preferFrom ? { version: v.version, preferFrom: v.preferFrom } : null;
};

export function markVersionPublished(pack, version, { fileId = null, now = new Date(), manual = false } = {}) {
  const v = pack.versions.find(x => x.version === version);
  if (!v) throw new Error(`Pack ${pack.slug} has no version ${version}`);
  Object.assign(v, { status: 'published', fileId, publishedAt: now.toISOString(), manual });
  return v;
}

const listNames = names => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] || '';

// imageUrls: public URLs of the version's renders. CurseForge moderators want screenshots of the
// new content in the changelog too (Anleitung_CF), so they are appended as Markdown images.
// total: number of skins in the uploaded file (all versions up to v), told to players in the changelog.
// Updates open with a one-liner naming the new skins; skins with a story get it on their line.
export function changelogFor(v, { imageUrls = [], total = 0 } = {}) {
  const first = v.version === '1.0';
  const n = v.skins.length;
  const intro = first ? '' : `${n} new skin${n === 1 ? '' : 's'} ${n === 1 ? 'joins' : 'join'} the pack: ${listNames([...new Set(v.skins.map(s => shortName(s.name)))])}.\n\n`;
  const names = v.skins.map(s => `- ${s.story ? `**${s.name}** — ${s.story}` : s.name}`).join('\n');
  const title = v.title ? ` — ${v.title}` : '';
  const images = imageUrls.map(u => `\n![V${v.version} skins](${u})\n`).join('');
  const all = total > n ? `\nThis download contains all ${total} skins of the pack, so new players get everything in one file.\n` : '';
  return `## V${v.version}${title}\n\n${intro}${v.note ? v.note + '\n\n' : ''}${first ? 'Skins in this pack' : 'New skins'}:\n${names}\n${all}${images}`;
}
