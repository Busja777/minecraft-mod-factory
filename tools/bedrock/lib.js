import AdmZip from 'adm-zip';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { pathToFileURL, fileURLToPath } from 'url';
import { ids, vanilla, vanillaFiles, DEFAULT_TAG } from './samples.js';

// Add-ons of the Bedrock series: behavior packs (recipes, loot, trading, entity behaviour), resource
// packs (sounds, texts) or both as one add-on. Built blind: Bedrock has no headless way to load a
// pack without accepting the EULA, so every file is checked against Mojang's samples of the release
// it is built for (tools/bedrock/samples.js) and copies the exact shape of a vanilla file.
//
// Layout: tools/bedrock/projects/<slug>/
//   pack.json   { kind: 'behavior' | 'resource' | 'addon', name, description, samples: 'v1.26.60.5',
//                 minEngine: [1, 26, 60], gameVersions: ['26.60'] }
//   pack.js     export default async ({ samples, ids, vanilla, vanillaFiles }) =>
//                 ({ 'bp/recipes/x.json': {…}, 'rp/sounds/sound_definitions.json': {…} })
//   page.json, logo.png, changelogs/<version>.md
// A file whose path is also a vanilla file replaces that vanilla file: it must be generated from
// the vanilla file of the same release (so a new release brings its changes along).
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECTS = path.join(HERE, 'projects');
export const KINDS = ['behavior', 'resource', 'addon'];
const SIDES = { behavior: ['bp'], resource: ['rp'], addon: ['bp', 'rp'] };
export const sidesOf = pack => SIDES[pack.kind];
export const extOf = pack => (pack.kind === 'addon' ? 'mcaddon' : 'mcpack');

export function listPacks(root = PROJECTS) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(slug => fs.existsSync(path.join(root, slug, 'pack.json'))).sort();
}

export function packOf(slug, root = PROJECTS) {
  const dir = path.join(root, slug);
  const file = path.join(dir, 'pack.json');
  if (!fs.existsSync(file)) throw new Error(`No pack "${slug}" under ${root}`);
  const meta = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!KINDS.includes(meta.kind)) throw new Error(`${slug}: kind must be behavior, resource or addon`);
  if (!Array.isArray(meta.minEngine) || meta.minEngine.length !== 3) throw new Error(`${slug}: minEngine is [major, minor, patch]`);
  if (!meta.gameVersions?.length) throw new Error(`${slug}: gameVersions are missing`);
  return { slug, dir, samples: DEFAULT_TAG, ...meta };
}

// → { 'bp/…' | 'rp/…': Buffer }
export async function generate(pack, samples) {
  const mod = await import(`${pathToFileURL(path.join(pack.dir, 'pack.js')).href}?t=${Date.now()}`);
  const out = await mod.default({
    samples,
    ids: kind => ids(samples, kind),
    vanilla: (side, rel) => vanilla(samples, side, rel),
    vanillaFiles: (side, folder) => vanillaFiles(samples, side, folder)
  });
  const files = {};
  for (const [p, v] of Object.entries(out)) files[p] = Buffer.isBuffer(v) ? v : Buffer.from(typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n', 'utf-8');
  return files;
}

const strip = id => String(id).replace(/^minecraft:/, '');
const isVanilla = id => !String(id).includes(':') || String(id).startsWith('minecraft:');
const RECIPE_KEYS = ['minecraft:recipe_shaped', 'minecraft:recipe_shapeless', 'minecraft:recipe_furnace', 'minecraft:recipe_brewing_mix', 'minecraft:recipe_brewing_container', 'minecraft:recipe_smithing_transform', 'minecraft:recipe_smithing_trim'];
// Folders a behavior / resource pack of the series uses; anything else needs a look first.
const BP_FOLDERS = new Set(['recipes', 'loot_tables', 'trading', 'entities', 'spawn_rules', 'items', 'blocks', 'functions', 'texts']);
const RP_FOLDERS = new Set(['sounds', 'texts', 'sounds.json']);

// Every string under the given keys anywhere in a JSON value.
function collect(value, keys, found = []) {
  if (Array.isArray(value)) value.forEach(v => collect(v, keys, found));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (keys.includes(k) && typeof v === 'string') found.push(v);
      else collect(v, keys, found);
    }
  }
  return found;
}

// The keys of an object and, one level down, of its object values: the shape a file must keep.
const shape = o => Object.entries(o || {}).flatMap(([k, v]) => [k, ...(v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).map(c => `${k}.${c}`) : [])]).sort();

// Checks a generated pack against the samples of its release. → [problem texts]
export function checkPack(pack, files, samples) {
  const problems = [];
  const items = ids(samples, 'items');
  const blocks = ids(samples, 'blocks');
  const entities = ids(samples, 'entities');
  const json = {};
  const sides = sidesOf(pack);
  for (const [p, buf] of Object.entries(files)) {
    if (/[A-Z ]/.test(p)) problems.push(`${p}: paths must be lowercase without spaces`);
    const [side, folder] = p.split('/');
    if (!sides.includes(side)) { problems.push(`${p}: a ${pack.kind} pack only has ${sides.map(s => `${s}/`).join(' and ')}`); continue; }
    if (!(side === 'bp' ? BP_FOLDERS : RP_FOLDERS).has(folder)) problems.push(`${p}: unknown folder "${folder}"`);
    if (p.endsWith('manifest.json') || p.endsWith('pack_icon.png')) problems.push(`${p}: manifest and icon are written by the build`);
    if (!p.endsWith('.json')) continue;
    try { json[p] = JSON.parse(buf.toString('utf-8')); } catch (e) { problems.push(`${p}: not valid JSON (${e.message})`); }
  }
  const ownLoot = new Set(Object.keys(json).filter(p => p.startsWith('bp/loot_tables/')).map(p => p.slice(3)));
  for (const [p, j] of Object.entries(json)) {
    const rel = p.slice(3);
    const side = p.slice(0, 2);
    const original = vanilla(samples, side, rel);
    // Replacing a vanilla file: same format version and the same top-level shape as vanilla's own.
    if (original) {
      if (original.format_version !== j.format_version) problems.push(`${p}: replaces a vanilla file of format ${original.format_version} with ${j.format_version}`);
      const missing = shape(original).filter(k => !shape(j).includes(k) && !/^(components|component_groups|events)\./.test(k) && !/^minecraft:entity\.(components|component_groups|events)\./.test(k));
      if (missing.length) problems.push(`${p}: drops ${missing.slice(0, 3).join(', ')} of the vanilla file`);
    }
    if (rel.startsWith('recipes/')) {
      if (rel.split('/').length > 2) problems.push(`${p}: recipes lie flat in recipes/ like vanilla's (sub-folders are not proven to load)`);
      const key = RECIPE_KEYS.find(k => j[k]);
      if (!key) problems.push(`${p}: no known recipe type (${Object.keys(j).filter(k => k !== 'format_version').join(', ')})`);
      else {
        const id = j[key].description?.identifier;
        if (!id || !id.includes(':')) problems.push(`${p}: description.identifier needs a namespace`);
        else if (strip(id) !== id && !original) problems.push(`${p}: new recipes need our own namespace, not ${id}`);
        if (!j.format_version) problems.push(`${p}: format_version is missing`);
        if (!j[key].unlock && /shaped|shapeless/.test(key)) problems.push(`${p}: recipes since 1.20.10 need "unlock" (else the recipe book never shows them)`);
      }
    }
    for (const id of collect(j, ['item'])) if (isVanilla(id) && !items.has(strip(id))) problems.push(`${p}: unknown item ${id}`);
    if (rel.startsWith('loot_tables/') || rel.startsWith('trading/')) {
      for (const e of collect(j, ['name'])) {
        if (e.startsWith('loot_tables/')) { if (!ownLoot.has(e) && !vanilla(samples, 'bp', e)) problems.push(`${p}: loot table ${e} does not exist`); }
        else if (isVanilla(e) && !items.has(strip(e)) && !blocks.has(strip(e))) problems.push(`${p}: unknown item ${e}`);
      }
    }
    if (rel.startsWith('spawn_rules/') || rel.startsWith('entities/')) {
      const id = (j['minecraft:entity'] || j['minecraft:spawn_rules'])?.description?.identifier;
      if (id && isVanilla(id) && !entities.has(strip(id))) problems.push(`${p}: unknown entity ${id}`);
    }
  }
  const sounds = json['rp/sounds/sound_definitions.json'];
  if (sounds) {
    const known = vanilla(samples, 'rp', 'sounds/sound_definitions.json')?.sound_definitions || {};
    for (const [event, def] of Object.entries(sounds.sound_definitions || {})) {
      if (!known[event] && !event.includes(':') && !event.startsWith(`${pack.slug.replace(/-/g, '_')}.`)) problems.push(`sound_definitions.json: unknown vanilla sound event ${event}`);
      const vanillaNames = new Set((known[event]?.sounds || []).map(s => (typeof s === 'string' ? s : s.name)));
      for (const s of def.sounds || []) {
        const name = typeof s === 'string' ? s : s.name;
        if (known[event] && !vanillaNames.has(name)) problems.push(`sound_definitions.json: ${event} points to ${name}, which vanilla does not use for this event`);
        if (typeof s === 'object' && s.volume !== undefined && !(s.volume > 0 && s.volume <= 1)) problems.push(`sound_definitions.json: ${event} volume ${s.volume} outside (0, 1]`);
      }
    }
  }
  return problems;
}

// A UUID that stays the same for a pack forever (so the game treats every update as the same
// pack) and differs between packs and their parts: name-based, from the slug.
export function stableUuid(slug, part) {
  const h = crypto.createHash('sha1').update(`mod-factory/bedrock/${slug}/${part}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const triple = version => { const [a, b = 0, c = 0] = version.split('.').map(Number); return [a, b, c]; };

// manifest.json of one side, as the vanilla packs write it (format_version 2).
export function manifest(pack, side, version) {
  const bp = side === 'bp';
  const out = {
    format_version: 2,
    header: {
      name: `${pack.name}${pack.kind === 'addon' ? (bp ? ' (behavior)' : ' (resources)') : ''}`,
      description: `${pack.description} (v${version})`,
      uuid: stableUuid(pack.slug, `${side}-header`),
      version: triple(version),
      min_engine_version: pack.minEngine
    },
    modules: [{ description: pack.description, type: bp ? 'data' : 'resources', uuid: stableUuid(pack.slug, `${side}-module`), version: triple(version) }]
  };
  // In an add-on the behavior pack pulls in its resource pack, so a world needs only one switch.
  if (pack.kind === 'addon' && bp) out.dependencies = [{ uuid: stableUuid(pack.slug, 'rp-header'), version: triple(version) }];
  return out;
}

export const fileName = (pack, version) => `${pack.name.replace(/[^A-Za-z0-9]+/g, '')}-${version}.${extOf(pack)}`;

// One .mcpack (one side) or .mcaddon (both sides, each in its own folder). The pack icon is the
// logo at 256 px, as Bedrock shows it in the pack list.
export async function buildPack(pack, files, version, outDir) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) throw new Error(`Invalid version "${version}"`);
  const zip = new AdmZip();
  const logo = path.join(pack.dir, 'logo.png');
  const icon = fs.existsSync(logo) ? await sharp(logo).resize(256, 256).png().toBuffer() : null;
  const sides = sidesOf(pack);
  for (const side of sides) {
    const prefix = pack.kind === 'addon' ? `${pack.name.replace(/[^A-Za-z0-9]+/g, '')}_${side.toUpperCase()}/` : '';
    zip.addFile(`${prefix}manifest.json`, Buffer.from(JSON.stringify(manifest(pack, side, version), null, 2) + '\n'));
    if (icon) zip.addFile(`${prefix}pack_icon.png`, icon);
    for (const p of Object.keys(files).filter(f => f.startsWith(`${side}/`)).sort()) zip.addFile(prefix + p.slice(3), files[p]);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, fileName(pack, version));
  zip.writeZip(file);
  return file;
}
