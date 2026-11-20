// Mojang's official Bedrock samples (github.com/Mojang/bedrock-samples): the vanilla behavior and
// resource packs plus id lists of every item, block, entity, effect, enchantment and biome. The
// Bedrock series is built from and checked against them; nothing of it is shipped in a pack.
//
//   cache: ~/.cache/mod-factory/bedrock/<tag>/bedrock-samples-<version>/
//     behavior_pack/   recipes, loot_tables, trading, entities, spawn_rules …
//     resource_pack/   sounds/sound_definitions.json, texts …
//     metadata/vanilladata_modules/mojang-<kind>.json   id lists
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const CACHE = process.env.BEDROCK_CACHE || path.join(os.homedir(), '.cache', 'mod-factory', 'bedrock');
// The release every pack of the series is built against until a pack names another one.
export const DEFAULT_TAG = 'v1.26.60.5';

const dirOf = tag => path.join(CACHE, tag, `bedrock-samples-${tag.replace(/^v/, '')}`);
export const samplesReady = (tag = DEFAULT_TAG) => fs.existsSync(path.join(dirOf(tag), 'version.json'));

// Downloads and unpacks a release once (about 170 MB). → samples
export async function ensureSamples(tag = DEFAULT_TAG) {
  const dir = dirOf(tag);
  if (!samplesReady(tag)) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const res = await fetch(`https://codeload.github.com/Mojang/bedrock-samples/zip/refs/tags/${tag}`);
    if (!res.ok) throw new Error(`${res.status}: bedrock-samples ${tag}`);
    new AdmZip(Buffer.from(await res.arrayBuffer())).extractAllTo(path.dirname(dir), true);
    if (!samplesReady(tag)) throw new Error(`bedrock-samples ${tag}: unexpected layout`);
  }
  return samplesOf(tag);
}

export function samplesOf(tag = DEFAULT_TAG) {
  const dir = dirOf(tag);
  const version = JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf-8')).latest.version;
  return { tag, dir, version, bp: path.join(dir, 'behavior_pack'), rp: path.join(dir, 'resource_pack'), meta: path.join(dir, 'metadata') };
}

// Mojang's files are JSON with // and /* */ comments; strings (which may contain "//") stay intact.
export function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1;
      if (i === 0) break;
    } else out += c;
  }
  // Mojang also leaves trailing commas now and then.
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

export const readJsonc = file => parseJsonc(fs.readFileSync(file, 'utf-8'));

// A vanilla file of the behavior ('bp') or resource ('rp') pack, or null.
export function vanilla(samples, side, rel) {
  const file = path.join(side === 'rp' ? samples.rp : samples.bp, rel);
  return fs.existsSync(file) ? readJsonc(file) : null;
}

// Every vanilla file under a folder of a pack: [{ rel, json }]
export function vanillaFiles(samples, side, folder) {
  const root = side === 'rp' ? samples.rp : samples.bp;
  const dir = path.join(root, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true }).map(f => f.split(path.sep).join('/')).filter(f => f.endsWith('.json')).sort()
    .map(f => ({ rel: `${folder}/${f}`, json: readJsonc(path.join(dir, f)) }));
}

const LISTS = { items: 'mojang-items', blocks: 'mojang-blocks', entities: 'mojang-entities', effects: 'mojang-effects', enchantments: 'mojang-enchantments', biomes: 'mojang-biomes' };
const cache = new Map();

// Vanilla ids of a kind ('items', 'blocks', 'entities', 'effects', 'enchantments', 'biomes')
// → Set of names without "minecraft:". The list is "data_items" in every file.
export function ids(samples, kind) {
  const key = `${samples.dir}:${kind}`;
  if (cache.has(key)) return cache.get(key);
  if (!LISTS[kind]) throw new Error(`No id list "${kind}"`);
  const data = readJsonc(path.join(samples.meta, 'vanilladata_modules', `${LISTS[kind]}.json`));
  const list = data.data_items || [];
  const set = new Set(list.map(e => String(e.name ?? e.command_name ?? e.serialization_name ?? e).replace(/^minecraft:/, '')));
  cache.set(key, set);
  return set;
}
