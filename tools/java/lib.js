import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { pathToFileURL, fileURLToPath } from 'url';
import { registry, itemTagExists, packFormat } from './vanilla.js';

// Data packs, resource packs and Fabric mods of the Minecraft Java series.
// Layout: tools/java/projects/<slug>/
//   pack.json      { kind: 'data' | 'resource', name, description, mc: '1.21.1', gameVersions: ['1.21', '1.21.1'] }
//                  optional "also": ['26.3'] — more Minecraft versions the same zip serves (see buildZip)
//                  with "also": "alsoLoads": { '1.21.1': ['1.21.2', …], '26.3': [ … ], broken: [ … ] } — every
//                  release between them and which file set it reads (see planTiers)
//                  or { kind: 'mod', name, description, mc, modId, gameVersions: ['1.21.1', 'Fabric', 'Java 21', 'Server', 'Client'] }
//   pack.js        export default async ({ vanilla, version, format }) => ({ 'data/<ns>/recipe/x.json': {…}, … })
//                  It is called once per Minecraft version; `format` is that version's pack format, so
//                  the generator can write a file the way that version reads it.
//   page.json, logo.png, changelogs/<version>.md, shots/ (in-game screenshots)
// The pack is generated, checked against the vanilla registries of its Minecraft version and zipped
// with pack.mcmeta and pack.png (the logo at 128 px).
// A mod is Java code instead of pack.js (src/main/java, src/test/java); it is built and tested by the
// shared Gradle build in tools/java/fabric/, so generate, checkPack and buildZip are only for packs.
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECTS = path.join(HERE, 'projects');

// Pack format (major) of every Minecraft release from 1.21 on (data, resource). Source: the
// version.json inside the jars. Versions that are not listed here (snapshots, newer releases) are
// read from the downloaded jar (vanilla.js → packFormat). A new release belongs in this list: the
// releases in it are the ones a zip's declared range is checked against (planTiers).
export const PACK_FORMAT = {
  '1.21': { data: 48, resource: 34 }, '1.21.1': { data: 48, resource: 34 },
  '1.21.2': { data: 57, resource: 42 }, '1.21.3': { data: 57, resource: 42 }, '1.21.4': { data: 61, resource: 46 },
  '1.21.5': { data: 71, resource: 55 }, '1.21.6': { data: 80, resource: 63 }, '1.21.7': { data: 81, resource: 64 }, '1.21.8': { data: 81, resource: 64 },
  '1.21.9': { data: 88, resource: 69 }, '1.21.10': { data: 88, resource: 69 }, '1.21.11': { data: 94, resource: 75 },
  '26.1': { data: 101, resource: 84 }, '26.1.1': { data: 101, resource: 84 }, '26.1.2': { data: 101, resource: 84 },
  '26.2': { data: 107, resource: 88 }, '26.3': { data: 121, resource: 97 }
};
export const RELEASES = Object.keys(PACK_FORMAT);
export const formatOf = (mc, kind) => PACK_FORMAT[mc]?.[kind] ?? packFormat(mc, kind)[0];
// From these formats on (Minecraft 1.21.9) pack.mcmeta declares min_format / max_format instead of pack_format.
export const RANGE_FORMAT = { data: 82, resource: 65 };
// The Minecraft versions a pack is built for: its base version first, then pack.also.
export const versionsOf = pack => [pack.mc, ...(pack.also || [])];
// "26.4-snapshot-10" → "26.4": what the version will be called on CurseForge.
export const releaseName = mc => String(mc).split('-')[0];
export const KINDS = ['data', 'resource', 'mod'];
export const isMod = pack => pack.kind === 'mod';

// Folders a 1.21 data pack uses (singular since 1.21; the old plural names are ignored by the game).
export const DATA_FOLDERS = new Set(['recipe', 'advancement', 'loot_table', 'tags', 'function', 'predicate', 'item_modifier', 'structure', 'worldgen', 'enchantment', 'trim_material', 'trim_pattern', 'damage_type', 'banner_pattern', 'painting_variant', 'jukebox_song', 'chat_type', 'dimension', 'dimension_type', 'enchantment_provider', 'wolf_variant']);
const PLURAL = { recipes: 'recipe', advancements: 'advancement', loot_tables: 'loot_table', functions: 'function', predicates: 'predicate', item_modifiers: 'item_modifier', structures: 'structure' };

export function listPacks(root = PROJECTS) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(slug => fs.existsSync(path.join(root, slug, 'pack.json'))).sort();
}

export function packOf(slug, root = PROJECTS) {
  const dir = path.join(root, slug);
  const file = path.join(dir, 'pack.json');
  if (!fs.existsSync(file)) throw new Error(`No pack "${slug}" under ${root}`);
  const meta = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!KINDS.includes(meta.kind)) throw new Error(`${slug}: kind must be data, resource or mod`);
  if (!/^\d+\.\d+/.test(meta.mc || '')) throw new Error(`${slug}: "mc" must be a Minecraft version`);
  if (meta.also && (meta.kind === 'mod' || !Array.isArray(meta.also) || meta.also.some(v => !/^\d+\.\d+/.test(v)))) throw new Error(`${slug}: "also" is a list of Minecraft versions (packs only)`);
  const lists = meta.alsoLoads && typeof meta.alsoLoads === 'object' && !Array.isArray(meta.alsoLoads) ? Object.values(meta.alsoLoads) : null;
  if (meta.alsoLoads && (meta.kind === 'mod' || !lists || lists.some(l => !Array.isArray(l) || l.some(v => !/^\d+\.\d+/.test(v))))) throw new Error(`${slug}: "alsoLoads" maps a version of the pack (or "broken") to a list of Minecraft versions (packs only)`);
  if (meta.kind === 'mod' && !/^[a-z][a-z0-9_]{1,63}$/.test(meta.modId || '')) throw new Error(`${slug}: a mod needs a modId (lowercase letters, digits, _)`);
  return { slug, dir, ...meta };
}

// → { 'path/in/pack': Buffer }
export async function generate(pack, vanilla, version = pack.mc) {
  const mod = await import(`${pathToFileURL(path.join(pack.dir, 'pack.js')).href}?t=${Date.now()}`);
  const out = await mod.default({ vanilla, version, format: formatOf(version, pack.kind), registry: name => registry(vanilla, name) });
  const files = {};
  for (const [p, v] of Object.entries(out)) {
    files[p] = Buffer.isBuffer(v) ? v : Buffer.from(typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n', 'utf-8');
  }
  return files;
}

const strip = id => String(id).replace(/^minecraft:/, '');
const isVanilla = id => !String(id).includes(':') || String(id).startsWith('minecraft:');

// Every item id or tag found under the given keys anywhere in a JSON value.
function collect(value, keys, found = []) {
  if (Array.isArray(value)) value.forEach(v => collect(v, keys, found));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (keys.includes(k) && typeof v === 'string') found.push({ key: k, value: v });
      else if (keys.includes(k) && Array.isArray(v) && v.every(x => typeof x === 'string')) v.forEach(x => found.push({ key: k, value: x }));
      else collect(v, keys, found);
    }
  }
  return found;
}

// Checks a generated pack against the vanilla data of its version. → [problem texts]
// foreign: the files were written for another version and this one only reads them (pack.alsoLoads).
// A sound event this version does not have is then left alone: nothing in it plays the event, the
// game only notes the missing files in its log.
export function checkPack(pack, files, vanilla, { foreign = false } = {}) {
  const problems = [];
  const items = registry(vanilla, 'item');
  const blocks = registry(vanilla, 'block');
  const triggers = registry(vanilla, 'trigger_type');
  const serializers = registry(vanilla, 'recipe_serializer');
  const soundEvents = registry(vanilla, 'sound_event');
  const ownAdvancements = new Set();
  // Newer versions bring new data folders (villager_trade, timeline …): whatever vanilla itself uses is known.
  const vanillaData = path.join(vanilla.data, 'minecraft');
  const folders = new Set([...DATA_FOLDERS, ...(fs.existsSync(vanillaData) ? fs.readdirSync(vanillaData) : [])]);
  const json = {};
  for (const [p, buf] of Object.entries(files)) {
    if (!p.endsWith('.json') && !p.endsWith('.mcmeta')) continue;
    try { json[p] = JSON.parse(buf.toString('utf-8')); } catch (e) { problems.push(`${p}: not valid JSON (${e.message})`); }
  }
  for (const p of Object.keys(files)) {
    if (/[A-Z ]/.test(p)) problems.push(`${p}: paths must be lowercase without spaces`);
    const m = /^data\/([a-z0-9_.-]+)\/([a-z_]+)\//.exec(p);
    if (pack.kind === 'data') {
      if (!p.startsWith('data/')) { problems.push(`${p}: a data pack only has data/`); continue; }
      if (!m) { problems.push(`${p}: expected data/<namespace>/<folder>/…`); continue; }
      if (PLURAL[m[2]]) problems.push(`${p}: the folder is "${PLURAL[m[2]]}" since 1.21, "${m[2]}" is ignored`);
      else if (!folders.has(m[2])) problems.push(`${p}: unknown data folder "${m[2]}"`);
      if (m[2] === 'advancement') ownAdvancements.add(`${m[1]}:${p.replace(/^data\/[^/]+\/advancement\//, '').replace(/\.json$/, '')}`);
    } else if (!p.startsWith('assets/')) problems.push(`${p}: a resource pack only has assets/`);
  }
  for (const [p, j] of Object.entries(json)) {
    if (/\/recipe\//.test(p)) {
      if (!serializers.has(strip(j.type))) problems.push(`${p}: unknown recipe type ${j.type}`);
      if (!j.result || !j.result.id) problems.push(`${p}: result needs an "id" (1.21 format)`);
    }
    if (/\/advancement\//.test(p)) {
      for (const [name, c] of Object.entries(j.criteria || {})) if (!triggers.has(strip(c.trigger))) problems.push(`${p}: criterion ${name} has unknown trigger ${c.trigger}`);
      if (!j.criteria || !Object.keys(j.criteria).length) problems.push(`${p}: an advancement needs criteria`);
      if (j.display && !j.display.icon?.id) problems.push(`${p}: display.icon needs an "id" (1.21 format)`);
    }
    for (const { key, value } of collect(j, ['item', 'items', 'id'])) {
      if (value.startsWith('#')) { if (isVanilla(value.slice(1)) && !itemTagExists(vanilla, value)) problems.push(`${p}: unknown item tag ${value}`); continue; }
      if (key === 'id' && !/\/(recipe|advancement|loot_table)\//.test(p)) continue;
      if (isVanilla(value) && !items.has(strip(value))) problems.push(`${p}: unknown item ${value}`);
    }
    for (const { value } of collect(j, ['block', 'blocks'])) {
      if (!value.startsWith('#') && isVanilla(value) && !blocks.has(strip(value))) problems.push(`${p}: unknown block ${value}`);
    }
    if (/\/advancement\//.test(p) && j.parent && !ownAdvancements.has(j.parent) && !fs.existsSync(path.join(vanilla.data, 'minecraft', 'advancement', `${strip(j.parent)}.json`))) {
      problems.push(`${p}: parent ${j.parent} does not exist`);
    }
  }
  const sounds = json['assets/minecraft/sounds.json'];
  if (sounds) {
    const index = JSON.parse(fs.readFileSync(path.join(vanilla.dir, 'asset-index.json'), 'utf-8')).objects;
    for (const [event, def] of Object.entries(sounds)) {
      if (foreign && !soundEvents.has(event)) continue;
      if (!soundEvents.has(event)) problems.push(`sounds.json: unknown sound event ${event}`);
      for (const s of def.sounds || []) {
        const name = typeof s === 'string' ? s : s.name;
        const isEvent = typeof s === 'object' && s.type === 'event';
        if (isEvent ? !soundEvents.has(strip(name)) : !index[`minecraft/sounds/${strip(name)}.ogg`]) problems.push(`sounds.json: ${event} points to missing sound ${name}`);
        if (typeof s === 'object' && s.volume !== undefined && !(s.volume > 0 && s.volume <= 1)) problems.push(`sounds.json: ${event} volume ${s.volume} outside (0, 1]`);
      }
    }
  }
  return problems;
}

export const zipName = (pack, version) => `${pack.name.replace(/[^A-Za-z0-9]+/g, '')}-${version}.zip`;
export const jarName = (pack, version) => `${pack.name.replace(/[^A-Za-z0-9]+/g, '')}-${version}.jar`;

// pack.mcmeta for a pack that serves the given formats (ascending). The files of the newest
// format lie in the root of the pack; every older format gets an overlay folder that replaces
// what that version reads differently. Pure, see tests.
//   one old format:    pack_format
//   one new format:    min_format / max_format
//   old and new:       both spellings (the old game reads pack_format / supported_formats /
//                      formats, the new one min_format / max_format)
// What the game accepts (tried with hand-made packs on 1.21.5, 1.21.11, 26.1, 26.2 and 26.3, and
// with the game's own Pack.readPackMetadata of 26.1 to 26.3):
// - Before 1.21.9 the game reads pack_format and supported_formats and ignores min/max_format.
// - From 1.21.9 on, a pack whose min_format is below 82 must have pack_format and supported_formats,
//   and supported_formats must end where max_format ends ("declaration mismatch" otherwise); a pack
//   from 82 on must not have supported_formats, and pack_format must lie inside min..max_format.
//   Otherwise the game cannot read the metadata. So both spellings always declare the same single
//   range: a zip for 1.21.1 and 26.3 declares 48–121, every version in between included.
// - A whole number in max_format means every minor format of it (121 covers 121.x).
// - The game refuses "formats" on an overlay that starts at format 82 or later, and every overlay
//   needs it while the pack serves a version before 1.21.9. So such a pack can only have overlays
//   that start before format 82; they may reach past it.
// - The game's headless test server loads every pack it is given, whatever range it declares: the
//   load test checks the files, not the range.
export function mcmeta({ kind, description, min, max, overlays = [] }) {
  const limit = RANGE_FORMAT[kind];
  const old = min < limit;
  // Key order as in every file already in the stock (pack_format, description): the stock check compares bytes.
  const pack = old ? { pack_format: min, description } : { description };
  if (old && max > min) pack.supported_formats = { min_inclusive: min, max_inclusive: max };
  if (max >= limit) { pack.min_format = min; pack.max_format = max; }
  const meta = { pack };
  const entries = overlays.map(o => {
    if (old && o.format >= limit) throw new Error(`a pack that serves format ${min} cannot carry an overlay for format ${o.format}: versions from format ${limit} on must share one set of files`);
    return { ...(o.format < limit ? { formats: { min_inclusive: o.format, max_inclusive: o.to } } : {}), ...(max >= limit ? { min_format: o.format, max_format: o.to } : {}), directory: o.directory };
  });
  if (entries.length) meta.overlays = { entries };
  return meta;
}

export const overlayDir = mc => `mc_${releaseName(mc).replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;

// Which files every Minecraft release inside a zip's range reads. Because the zip has to declare
// one range from its oldest to its newest version (see mcmeta), each release in between accepts it
// too, so pack.json accounts for every one of them in "alsoLoads":
//   { "<one of the pack's own versions>": [releases that read its files], "broken": [releases] }
// A release goes under the file set it was checked with (the game's load test where the version has
// one, otherwise the vanilla checks); "broken" holds releases on which no file set works yet (the
// build names them every time). Releases with the same format as one of the pack's own versions
// read what that version reads and need no entry. The newest version's files lie in the root;
// every older file set gets an overlay from its own format up to the newest release listed under it.
// mcs: the pack's own versions. → { tiers: [{ mc, format, to, loads: [{ mc, format }] }] ascending, broken: [{ mc, format }] }
export function planTiers(pack, mcs = versionsOf(pack)) {
  const tiers = mcs.map(mc => ({ mc, format: formatOf(mc, pack.kind), loads: [] })).sort((a, b) => a.format - b.format);
  const [min, max] = [tiers[0].format, tiers.at(-1).format];
  const root = tiers.at(-1);
  const seen = new Set(mcs);
  const broken = [];
  for (const [key, list] of Object.entries(pack.alsoLoads || {})) {
    const tier = tiers.find(t => t.mc === key);
    if (!tier && key !== 'broken') throw new Error(`${pack.slug}: alsoLoads "${key}" is not one of the versions the zip is built for (${mcs.join(', ')})`);
    for (const mc of list) {
      if (seen.has(mc)) throw new Error(`${pack.slug}: Minecraft ${mc} is listed twice (alsoLoads, mc, also)`);
      seen.add(mc);
      const format = formatOf(mc, pack.kind);
      if (format < min || format > max) throw new Error(`${pack.slug}: Minecraft ${mc} (format ${format}) lies outside the range of the zip (${min}–${max})`);
      (tier ? tier.loads : broken).push({ mc, format });
    }
  }
  tiers.forEach((t, i) => {
    t.to = t === root ? max : Math.max(t.format, ...t.loads.map(l => l.format));
    if (t === root) return;
    const early = t.loads.find(l => l.format < t.format);
    if (early) throw new Error(`${pack.slug}: Minecraft ${early.mc} (format ${early.format}) is older than ${t.mc} and cannot read its overlay`);
    if (t.to >= tiers[i + 1].format) throw new Error(`${pack.slug}: the files of ${t.mc} would reach up to format ${t.to}, past ${tiers[i + 1].mc} (format ${tiers[i + 1].format})`);
  });
  const reads = format => tiers.find(t => t !== root && format >= t.format && format <= t.to) || root;
  for (const t of tiers) for (const l of t.loads) {
    if (reads(l.format) !== t) throw new Error(`${pack.slug}: Minecraft ${l.mc} (format ${l.format}) would read the files of ${reads(l.format).mc}, not those of ${t.mc}`);
  }
  const formats = new Set(tiers.map(t => t.format));
  const missing = RELEASES.filter(r => !seen.has(r) && !formats.has(PACK_FORMAT[r][pack.kind]) && PACK_FORMAT[r][pack.kind] >= min && PACK_FORMAT[r][pack.kind] <= max);
  if (missing.length) throw new Error(`${pack.slug}: the zip declares formats ${min}–${max}, so Minecraft ${missing.join(', ')} accept it too. Check which files work there and list them in pack.json "alsoLoads" (or under "broken")`);
  return { tiers, broken };
}

// The releases a pack serves besides its own versions: [{ mc, tier }] (tier: the version whose files it reads).
export const loadsOf = pack => planTiers(pack).tiers.flatMap(t => t.loads.map(l => ({ mc: l.mc, tier: t.mc })));

// files: the pack for its base version (pack.mc). more: [{ mc, files }] for the newer versions in
// pack.also. The newest version's files go into the root; each older version gets an overlay
// folder with the files it needs in its own spelling, for its own format and the releases
// pack.alsoLoads puts under it (planTiers). Files that are the same everywhere are stored once.
// With one version the zip is what it always was.
export async function buildZip(pack, files, version, outDir, more = []) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) throw new Error(`Invalid version "${version}"`);
  const zip = new AdmZip();
  const tiers = [{ mc: pack.mc, files }, ...more].map(t => ({ ...t, format: formatOf(t.mc, pack.kind), directory: overlayDir(t.mc) })).sort((a, b) => a.format - b.format);
  if (tiers[0].mc !== pack.mc) throw new Error(`${pack.slug}: "also" lists a version older than the base version ${pack.mc}`);
  const plan = planTiers(pack, tiers.map(t => t.mc)).tiers;
  const root = tiers.at(-1);
  const overlays = tiers.slice(0, -1).map(t => {
    const extra = Object.keys(root.files).filter(p => !(p in t.files));
    if (extra.length) throw new Error(`${pack.slug}: ${extra.slice(0, 3).join(', ')} only exist for ${root.mc}; Minecraft ${t.mc} would read them too (an overlay can replace files, not hide them)`);
    const own = Object.keys(t.files).filter(p => !root.files[p] || !root.files[p].equals(t.files[p]));
    // The overlay covers the format it was built for and the releases alsoLoads puts under it;
    // every other version reads the root.
    return { ...t, to: plan.find(p => p.mc === t.mc).to, files: Object.fromEntries(own.map(p => [p, t.files[p]])) };
  }).filter(o => Object.keys(o.files).length);   // a version that reads everything like the root needs no folder
  const meta = mcmeta({ kind: pack.kind, description: `${pack.description} (v${version})`, min: tiers[0].format, max: root.format, overlays });
  zip.addFile('pack.mcmeta', Buffer.from(JSON.stringify(meta, null, 2) + '\n'));
  const logo = path.join(pack.dir, 'logo.png');
  if (fs.existsSync(logo)) zip.addFile('pack.png', await sharp(logo).resize(128, 128).png().toBuffer());
  for (const p of Object.keys(root.files).sort()) zip.addFile(p, root.files[p]);
  for (const o of overlays) for (const p of Object.keys(o.files).sort()) zip.addFile(`${o.directory}/${p}`, o.files[p]);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, zipName(pack, version));
  zip.writeZip(file);
  return file;
}
