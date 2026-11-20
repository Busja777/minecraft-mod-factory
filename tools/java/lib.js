import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { pathToFileURL, fileURLToPath } from 'url';
import { registry, itemTagExists } from './vanilla.js';

// Data packs, resource packs and Fabric mods of the Minecraft Java series.
// Layout: tools/java/projects/<slug>/
//   pack.json      { kind: 'data' | 'resource', name, description, mc: '1.21.1', gameVersions: ['1.21', '1.21.1'] }
//                  or { kind: 'mod', name, description, mc, modId, gameVersions: ['1.21.1', 'Fabric', 'Java 21', 'Server', 'Client'] }
//   pack.js        export default async ({ vanilla, version }) => ({ 'data/<ns>/recipe/x.json': {…}, … })
//   page.json, logo.png, changelogs/<version>.md, shots/ (in-game screenshots)
// The pack is generated, checked against the vanilla registries of its Minecraft version and zipped
// with pack.mcmeta and pack.png (the logo at 128 px).
// A mod is Java code instead of pack.js (src/main/java, src/test/java); it is built and tested by the
// shared Gradle build in tools/java/fabric/, so generate, checkPack and buildZip are only for packs.
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECTS = path.join(HERE, 'projects');

// pack_format per Minecraft version (data, resource). Source: the version.json inside the jars.
export const PACK_FORMAT = { '1.21.1': { data: 48, resource: 34 } };
export const KINDS = ['data', 'resource', 'mod'];
export const isMod = pack => pack.kind === 'mod';

// Folders a 1.21 data pack uses (singular since 1.21; the old plural names are ignored by the game).
const DATA_FOLDERS = new Set(['recipe', 'advancement', 'loot_table', 'tags', 'function', 'predicate', 'item_modifier', 'structure', 'worldgen', 'enchantment', 'trim_material', 'trim_pattern', 'damage_type', 'banner_pattern', 'painting_variant', 'jukebox_song', 'chat_type', 'dimension', 'dimension_type', 'enchantment_provider', 'wolf_variant']);
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
  if (!PACK_FORMAT[meta.mc]) throw new Error(`${slug}: unknown Minecraft version ${meta.mc}`);
  if (meta.kind === 'mod' && !/^[a-z][a-z0-9_]{1,63}$/.test(meta.modId || '')) throw new Error(`${slug}: a mod needs a modId (lowercase letters, digits, _)`);
  return { slug, dir, ...meta };
}

// → { 'path/in/pack': Buffer }
export async function generate(pack, vanilla) {
  const mod = await import(`${pathToFileURL(path.join(pack.dir, 'pack.js')).href}?t=${Date.now()}`);
  const out = await mod.default({ vanilla, version: pack.mc, registry: name => registry(vanilla, name) });
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
export function checkPack(pack, files, vanilla) {
  const problems = [];
  const items = registry(vanilla, 'item');
  const blocks = registry(vanilla, 'block');
  const triggers = registry(vanilla, 'trigger_type');
  const serializers = registry(vanilla, 'recipe_serializer');
  const soundEvents = registry(vanilla, 'sound_event');
  const ownAdvancements = new Set();
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
      else if (!DATA_FOLDERS.has(m[2])) problems.push(`${p}: unknown data folder "${m[2]}"`);
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

export async function buildZip(pack, files, version, outDir) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) throw new Error(`Invalid version "${version}"`);
  const zip = new AdmZip();
  const format = PACK_FORMAT[pack.mc][pack.kind];
  const mcmeta = { pack: { pack_format: format, description: `${pack.description} (v${version})` } };
  zip.addFile('pack.mcmeta', Buffer.from(JSON.stringify(mcmeta, null, 2) + '\n'));
  const logo = path.join(pack.dir, 'logo.png');
  if (fs.existsSync(logo)) zip.addFile('pack.png', await sharp(logo).resize(128, 128).png().toBuffer());
  for (const p of Object.keys(files).sort()) zip.addFile(p, files[p]);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, zipName(pack, version));
  zip.writeZip(file);
  return file;
}
