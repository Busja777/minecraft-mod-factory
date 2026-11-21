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

// pack_format per Minecraft version (data, resource). Source: the version.json inside the jars.
// Versions that are not listed here are read from the downloaded jar (vanilla.js → packFormat).
export const PACK_FORMAT = { '1.21.1': { data: 48, resource: 34 }, '26.3': { data: 121, resource: 97 } };
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

// A loot function whose "id" names a potion, not an item (vanilla: stray and bogged arrows).
const POTION_ID = o => /^(minecraft:)?set_potion$/.test(o.function || o.type || '');

// Every item id or tag found under the given keys anywhere in a JSON value.
function collect(value, keys, found = []) {
  if (Array.isArray(value)) value.forEach(v => collect(v, keys, found));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'id' && POTION_ID(value)) continue;
      if (keys.includes(k) && typeof v === 'string') found.push({ key: k, value: v });
      else if (keys.includes(k) && Array.isArray(v) && v.every(x => typeof x === 'string')) v.forEach(x => found.push({ key: k, value: x }));
      else collect(v, keys, found);
    }
  }
  return found;
}

// The potion ids of every set_potion function in a JSON value.
function potionIds(value, found = []) {
  if (Array.isArray(value)) value.forEach(v => potionIds(v, found));
  else if (value && typeof value === 'object') {
    if (POTION_ID(value) && typeof value.id === 'string') found.push(value.id);
    Object.values(value).forEach(v => potionIds(v, found));
  }
  return found;
}

// Checks a generated pack against the vanilla data of its version. → [problem texts]
export function checkPack(pack, files, vanilla) {
  const problems = [];
  const items = registry(vanilla, 'item');
  const blocks = registry(vanilla, 'block');
  const triggers = registry(vanilla, 'trigger_type');
  const serializers = registry(vanilla, 'recipe_serializer');
  const soundEvents = registry(vanilla, 'sound_event');
  const potions = registry(vanilla, 'potion');
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
    for (const id of potionIds(j)) if (isVanilla(id) && !potions.has(strip(id))) problems.push(`${p}: unknown potion ${id}`);
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
// The game refuses "formats" on an overlay that starts at format 82 or later, and the old game
// needs it on every overlay. So a pack that still serves a version before 1.21.9 can only have
// overlays for those old versions: all newer versions share the root.
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

// files: the pack for its base version (pack.mc). more: [{ mc, files }] for the newer versions in
// pack.also. The newest version's files go into the root; each older version gets an overlay
// folder with the files it needs in its own spelling. Files that are the same everywhere are
// stored once. With one version the zip is what it always was.
export async function buildZip(pack, files, version, outDir, more = []) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) throw new Error(`Invalid version "${version}"`);
  const zip = new AdmZip();
  const tiers = [{ mc: pack.mc, files }, ...more].map(t => ({ ...t, format: formatOf(t.mc, pack.kind), directory: overlayDir(t.mc) })).sort((a, b) => a.format - b.format);
  if (tiers[0].mc !== pack.mc) throw new Error(`${pack.slug}: "also" lists a version older than the base version ${pack.mc}`);
  const root = tiers.at(-1);
  const overlays = tiers.slice(0, -1).map(t => {
    const extra = Object.keys(root.files).filter(p => !(p in t.files));
    if (extra.length) throw new Error(`${pack.slug}: ${extra.slice(0, 3).join(', ')} only exist for ${root.mc}; Minecraft ${t.mc} would read them too (an overlay can replace files, not hide them)`);
    const own = Object.keys(t.files).filter(p => !root.files[p] || !root.files[p].equals(t.files[p]));
    // The overlay covers exactly the format it was checked against. Versions in between (and newer
    // ones) read the root, the newest spelling, which is what later versions are most likely to accept.
    return { ...t, to: t.format, files: Object.fromEntries(own.map(p => [p, t.files[p]])) };
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
