import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { HERE, DATA } from './wiki.js';
import { validate } from './schema.js';

// Content Patcher packs of the Stardew Valley series. The game is not owned: every pack is built
// "blind" from the documented 1.6 formats and checked as strictly as that allows.
// Layout: tools/stardew/projects/<slug>/
//   pack.json      { name, description, uniqueId: 'SevEvolution.<PascalName>', minimumApiVersion,
//                    contentPatcher: '<min CP version>', gameVersions: [...] }
//   pack.js        export default async ({ items, npcs, version }) => ({ 'content.json': {…}, 'i18n/default.json': {…} })
//   page.json, changelogs/<version>.md
// The lib adds manifest.json and zips everything into one folder "[CP] <Name>/".
export { HERE };
export const PROJECTS = path.join(HERE, 'projects');
export const AUTHOR = 'SevEvolution';
export const CP_ID = 'Pathoschild.ContentPatcher';

// 1.6 asset names the series may target, each with the wiki page that documents it. A pack that
// needs another asset adds it here together with its source.
export const TARGETS = {
  'Data/mail': 'https://stardewvalleywiki.com/Modding:Mail_data',
  'Data/TriggerActions': 'https://stardewvalleywiki.com/Modding:Trigger_actions',
  'Data/Characters': 'https://stardewvalleywiki.com/Modding:NPC_data',
  'Data/NPCGiftTastes': 'https://stardewvalleywiki.com/Modding:Gift_taste_data',
  'Data/Objects': 'https://stardewvalleywiki.com/Modding:Objects',
  'Data/Shops': 'https://stardewvalleywiki.com/Modding:Shops',
  'Data/Machines': 'https://stardewvalleywiki.com/Modding:Machines',
  'Data/CookingRecipes': 'https://stardewvalleywiki.com/Modding:Recipe_data',
  'Data/CraftingRecipes': 'https://stardewvalleywiki.com/Modding:Recipe_data',
  'Data/Crops': 'https://stardewvalleywiki.com/Modding:Crop_data',
  'Data/FruitTrees': 'https://stardewvalleywiki.com/Modding:Fruit_trees',
  'Data/GiantCrops': 'https://stardewvalleywiki.com/Modding:Giant_crops',
  'Data/FishPondData': 'https://stardewvalleywiki.com/Modding:Fish_ponds',
  'Data/Fish': 'https://stardewvalleywiki.com/Modding:Fish_data',
  'Data/Locations': 'https://stardewvalleywiki.com/Modding:Location_data',
  'Data/FarmAnimals': 'https://stardewvalleywiki.com/Modding:Animal_data',
  'Data/Buildings': 'https://stardewvalleywiki.com/Modding:Buildings',
  'Data/Monsters': 'https://stardewvalleywiki.com/Modding:Monster_data',
  'Data/SpecialOrders': 'https://stardewvalleywiki.com/Modding:Special_orders',
  // The texts of special orders: Data/SpecialOrders names them as [key] lookups into this asset.
  'Strings/SpecialOrderStrings': 'https://stardewvalleywiki.com/Modding:Special_orders',
  'Data/Bundles': 'https://stardewvalleywiki.com/Modding:Bundles',
  'Data/TailoringRecipes': 'https://stardewvalleywiki.com/Modding:Tailoring',
  'Data/MuseumRewards': 'https://stardewvalleywiki.com/Modding:Museum',
  'Data/GarbageCans': 'https://stardewvalleywiki.com/Modding:Garbage_cans',
  'Strings/StringsFromCSFiles': 'https://stardewvalleywiki.com/Modding:Dialogue',
  'Strings/UI': 'https://stardewvalleywiki.com/Modding:Dialogue'
};
// Per-NPC assets: Characters/Dialogue/<NPC> and Characters/Dialogue/MarriageDialogue<NPC>
// (https://stardewvalleywiki.com/Modding:Dialogue).
const NPC_TARGETS = [/^Characters\/Dialogue\/MarriageDialogue(\w+)$/, /^Characters\/Dialogue\/(\w+)$/];

// Triggers, actions and game state queries of 1.6 that the series uses.
// https://stardewvalleywiki.com/Modding:Trigger_actions, https://stardewvalleywiki.com/Modding:Game_state_queries
export const TRIGGERS = ['DayStarted', 'DayEnding', 'LocationChanged'];
export const ACTIONS = ['AddBuff', 'RemoveBuff', 'AddConversationTopic', 'RemoveConversationTopic', 'AddFriendshipPoints', 'AddItem', 'RemoveItem', 'AddMail', 'RemoveMail', 'AddMoney', 'AddQuest', 'RemoveQuest', 'AddSpecialOrder', 'RemoveSpecialOrder', 'If', 'IncrementStat', 'MarkActionApplied', 'MarkCookingRecipeKnown', 'MarkCraftingRecipeKnown', 'MarkEventSeen', 'MarkQuestionAnswered', 'MarkSongHeard', 'Null', 'RemoveTemporaryAnimatedSprites', 'SetNpcInvisible', 'SetNpcVisible'];
export const QUERIES = ['ANY', 'TRUE', 'FALSE', 'DATE_RANGE', 'DAY_OF_MONTH', 'DAY_OF_WEEK', 'DAYS_PLAYED', 'IS_FESTIVAL_DAY', 'SEASON', 'SEASON_DAY', 'TIME', 'YEAR', 'WEATHER', 'IS_HOST', 'IS_MULTIPLAYER', 'IS_COMMUNITY_CENTER_COMPLETE', 'IS_JOJA_MART_COMPLETE', 'PLAYER_HAS_MAIL', 'PLAYER_HAS_MET', 'PLAYER_HEARTS', 'PLAYER_FRIENDSHIP_POINTS', 'PLAYER_NPC_RELATIONSHIP', 'PLAYER_HAS_SEEN_EVENT', 'PLAYER_HAS_RUN_TRIGGER_ACTION', 'PLAYER_HAS_ITEM', 'PLAYER_HAS_CAUGHT_FISH', 'PLAYER_STAT', 'PLAYER_FARMHOUSE_UPGRADE', 'MINE_LOWEST_LEVEL_REACHED', 'RANDOM', 'SYNCED_RANDOM'];
const NPC_QUERIES = { PLAYER_HAS_MET: 'all', PLAYER_HEARTS: 1, PLAYER_FRIENDSHIP_POINTS: 1, PLAYER_NPC_RELATIONSHIP: 1 };
const NPC_ACTIONS = { AddFriendshipPoints: 0, SetNpcInvisible: 0, SetNpcVisible: 0 };
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
// Item type prefixes of 1.6 (https://stardewvalleywiki.com/Modding:Items#Item_types).
const ITEM_ID = /\((O|BC|B|F|FL|H|P|S|T|TR|W|WP|BO|M)\)([A-Za-z0-9_.{}]+)/g;

export const loadRef = () => ({
  items: JSON.parse(fs.readFileSync(path.join(DATA, 'items.json'), 'utf-8')),
  npcs: JSON.parse(fs.readFileSync(path.join(DATA, 'npcs.json'), 'utf-8'))
});

export function listPacks(root = PROJECTS) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(slug => fs.existsSync(path.join(root, slug, 'pack.json'))).sort();
}

export function packOf(slug, root = PROJECTS) {
  const dir = path.join(root, slug);
  const file = path.join(dir, 'pack.json');
  if (!fs.existsSync(file)) throw new Error(`No pack "${slug}" under ${root}`);
  const meta = JSON.parse(fs.readFileSync(file, 'utf-8'));
  for (const k of ['name', 'description', 'uniqueId', 'minimumApiVersion', 'contentPatcher', 'gameVersions']) if (!meta[k]) throw new Error(`${slug}: pack.json needs ${k}`);
  return { slug, dir, ...meta };
}

// "1.0" → "1.0.0" (SMAPI reads both, the full form is clearer in the log).
export function semver(version) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) throw new Error(`Invalid version "${version}"`);
  return version.split('.').length === 2 ? `${version}.0` : version;
}
const cmp = (a, b) => { const x = a.split('.').map(Number); const y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

// The newest version that has a changelog (used when no version is given).
export function latestVersion(pack) {
  const dir = path.join(pack.dir, 'changelogs');
  const versions = fs.existsSync(dir) ? fs.readdirSync(dir).map(f => /^(\d+\.\d+(?:\.\d+)?)\.md$/.exec(f)?.[1]).filter(Boolean) : [];
  if (!versions.length) throw new Error(`${pack.slug}: no changelogs/<version>.md`);
  return versions.sort(cmp).at(-1);
}

export function manifestOf(pack, version) {
  return {
    Name: pack.name,
    Author: AUTHOR,
    Version: semver(version),
    Description: pack.description,
    UniqueID: pack.uniqueId,
    MinimumApiVersion: pack.minimumApiVersion,
    UpdateKeys: [],
    ContentPackFor: { UniqueID: CP_ID, MinimumVersion: pack.contentPatcher }
  };
}

// → { 'manifest.json': Buffer, 'content.json': Buffer, 'i18n/default.json': Buffer, … }
export async function generate(pack, ref = loadRef(), version = latestVersion(pack)) {
  const mod = await import(`${pathToFileURL(path.join(pack.dir, 'pack.js')).href}?t=${Date.now()}`);
  const out = { 'manifest.json': manifestOf(pack, version), ...(await mod.default({ ...ref, version, pack })) };
  const files = {};
  for (const [p, v] of Object.entries(out)) {
    files[p] = Buffer.isBuffer(v) ? v : Buffer.from(typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n', 'utf-8');
  }
  return files;
}

// Every string in a JSON value, with its path.
function strings(value, at = '$', found = []) {
  if (typeof value === 'string') found.push({ at, value });
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${at}[${i}]`, found));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, `${at}.${k}`, found);
  return found;
}

// Splits a space-delimited argument string, keeping "quoted parts" together (trigger action format).
export function splitArgs(text) {
  return [...String(text).matchAll(/"((?:\\.|[^"])*)"|(\S+)/g)].map(m => m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]);
}

// "SEASON_DAY fall 13, PLAYER_HAS_MET Current Abigail" → [['SEASON_DAY','fall','13'], …]
// Commas inside quotes belong to ANY sub-queries; those are not split here.
export function splitQueries(condition) {
  const parts = [];
  let cur = '';
  let quoted = false;
  for (const ch of String(condition)) {
    if (ch === '"') quoted = !quoted;
    if (ch === ',' && !quoted) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts.map(p => splitArgs(p.trim())).filter(a => a.length);
}

// Checks a generated pack against the documented 1.6 / Content Patcher formats. → [problem texts]
//   ref:     { items, npcs } from tools/stardew/data/
//   schemas: { manifest, contentPatcher } (the official smapi.io schemas), or null to skip them
export function checkPack(pack, files, ref = loadRef(), schemas = null) {
  const problems = [];
  const add = msg => problems.push(msg);
  const items = ref.items.items;
  const npcs = ref.npcs.npcs;
  const json = {};
  for (const [p, buf] of Object.entries(files)) {
    if (/\\/.test(p) || p.startsWith('/') || p.includes('..')) add(`${p}: invalid path`);
    if (!/^(manifest\.json|content\.json|i18n\/[a-z]{2}(-[A-Z]{2})?\.json|i18n\/default\.json|assets\/[a-z0-9_\-/]+\.(png|json))$/.test(p)) add(`${p}: unexpected file (allowed: manifest.json, content.json, i18n/*.json, assets/*.png|json)`);
    if (!p.endsWith('.json')) continue;
    try { json[p] = JSON.parse(buf.toString('utf-8')); } catch (e) { add(`${p}: not valid JSON (${e.message})`); }
  }
  for (const f of ['manifest.json', 'content.json']) if (!json[f]) add(`${f} is missing`);
  const manifest = json['manifest.json'] || {};
  const content = json['content.json'] || {};

  if (schemas) {
    for (const msg of validate(schemas.manifest, manifest)) add(`manifest.json: ${msg}`);
    for (const msg of validate(schemas.contentPatcher, content)) add(`content.json: ${msg}`);
  }

  // manifest beyond the schema: our author, ID scheme and the Content Patcher dependency
  if (manifest.Author !== AUTHOR) add(`manifest.json: Author must be ${AUTHOR}`);
  if (manifest.UniqueID !== pack.uniqueId || !/^SevEvolution\.[A-Z][A-Za-z0-9]+$/.test(manifest.UniqueID || '')) add(`manifest.json: UniqueID must be SevEvolution.<PascalName> and match pack.json`);
  if (manifest.ContentPackFor?.UniqueID !== CP_ID) add(`manifest.json: ContentPackFor.UniqueID must be ${CP_ID}`);
  if (manifest.ContentPackFor?.MinimumVersion !== pack.contentPatcher) add(`manifest.json: ContentPackFor.MinimumVersion must be ${pack.contentPatcher} (pack.json)`);
  if (manifest.EntryDll) add('manifest.json: a content pack has no EntryDll');

  // Format = the Content Patcher version the pack is written for (author guide, "Format version"):
  // same major.minor as the required Content Patcher, and not newer than it.
  const fmt = String(content.Format || '');
  const cp = String(pack.contentPatcher || '');
  if (!/^\d+\.\d+\.\d+$/.test(fmt)) add(`content.json: Format "${fmt}" is not a version like 2.9.0`);
  else if (fmt.split('.').slice(0, 2).join('.') !== cp.split('.').slice(0, 2).join('.') || cmp(fmt, cp) > 0) add(`content.json: Format ${fmt} does not match Content Patcher ${cp} from pack.json`);

  // i18n: every {{i18n:key}} exists in default.json, every key there is used
  const i18n = json['i18n/default.json'];
  const used = new Set();
  for (const { value } of strings(content)) for (const m of value.matchAll(/\{\{\s*i18n\s*:\s*([^|}\s]+)/gi)) used.add(m[1]);
  // Config texts (Content Patcher config.md, "Translations"): config.<field>.name / .description,
  // config.<field>.values.<value> for an AllowValues value, config.section.<section>.name /
  // .description. Content Patcher reads them itself; keys are not case-sensitive.
  const configKeys = new Map();
  const configKey = k => configKeys.set(k.toLowerCase(), k);
  for (const [field, def] of Object.entries(content.ConfigSchema || {})) {
    for (const part of ['name', 'description']) configKey(`config.${field}.${part}`);
    for (const v of String(def?.AllowValues || '').split(',').map(x => x.trim()).filter(Boolean)) configKey(`config.${field}.values.${v}`);
    if (def?.Section) for (const part of ['name', 'description']) configKey(`config.section.${def.Section}.${part}`);
  }
  const isConfigKey = k => configKeys.has(k.toLowerCase());
  if (used.size && !i18n) add('i18n/default.json is missing but content.json uses {{i18n}}');
  if (i18n) {
    for (const k of used) if (!(k in i18n)) add(`content.json: i18n key "${k}" is missing in i18n/default.json`);
    for (const k of Object.keys(i18n)) {
      if (used.has(k) || isConfigKey(k)) continue;
      if (/^config\./i.test(k)) add(`i18n/default.json: key "${k}" names no ConfigSchema field, AllowValues value or section`);
      else add(`i18n/default.json: key "${k}" is never used`);
    }
    for (const [k, v] of Object.entries(i18n)) if (typeof v !== 'string' || !v.trim()) add(`i18n/default.json: "${k}" must be a non-empty text`);
    for (const [p, tr] of Object.entries(json)) if (p.startsWith('i18n/') && p !== 'i18n/default.json') for (const k of Object.keys(tr)) if (!(k in i18n)) add(`${p}: key "${k}" is not in default.json`);
  }
  const text = s => s.replace(/\{\{\s*i18n\s*:\s*([^|}\s]+)[^}]*\}\}/gi, (_, k) => i18n?.[k] ?? '');

  const npcName = (name, where) => { if (!npcs[name]) add(`${where}: unknown NPC "${name}"`); };
  const ownMail = new Set();
  const mailSent = [];
  const ownObjects = new Set();
  for (const [i, patch] of (content.Changes || []).entries()) {
    const at = `content.json Changes[${i}]`;
    for (const target of String(patch.Target || '').split(',').map(t => t.trim()).filter(Boolean)) {
      const npcTarget = NPC_TARGETS.map(re => re.exec(target)).find(Boolean);
      if (npcTarget) npcName(npcTarget[1], `${at} Target ${target}`);
      else if (!TARGETS[target]) add(`${at}: Target "${target}" is not a known 1.6 asset (allow list in tools/stardew/lib.js)`);
    }
    if (patch.Action !== 'Include' && !patch.Target) add(`${at}: ${patch.Action} needs a Target`);
    if (patch.Action !== 'EditData' || !patch.Entries) continue;
    const entries = patch.Entries;
    if (patch.Target === 'Data/mail') {
      for (const [key, value] of Object.entries(entries)) {
        ownMail.add(key);
        if (!key.startsWith('{{ModId}}_')) add(`${at}: mail key "${key}" must start with {{ModId}}_ so it cannot clash with other mods`);
        if (/Cooking|passOut/.test(key)) add(`${at}: mail key "${key}" contains Cooking/passOut and would never count as received`);
        const letter = text(String(value));
        if ((letter.match(/\[#\]/g) || []).length !== 1 || !/\[#\]\s*\S/.test(letter)) add(`${at}: letter "${key}" needs exactly one "[#]<letter name>"`);
        // The commands themselves (%item … %% and %action … %%) are taken out first: the closing %% would
        // otherwise count as a stray %.
        if (/%(?!item |action |%|secretsanta)/.test(letter.replace(/%(item|action) [^%]*%%/g, ''))) add(`${at}: letter "${key}" has a stray % (mail commands are %item … %% and %action … %%)`);
      }
    }
    if (patch.Target === 'Data/Objects') for (const key of Object.keys(entries)) ownObjects.add(key);
    if (patch.Target === 'Data/NPCGiftTastes') for (const key of Object.keys(entries)) if (!key.startsWith('Universal_')) npcName(key, `${at} Entries`);
    if (patch.Target === 'Data/TriggerActions') {
      for (const [key, entry] of Object.entries(entries)) {
        const where = `${at} trigger action ${key}`;
        if (!entry || typeof entry !== 'object') { add(`${where}: must be an object`); continue; }
        if (entry.Id !== key) add(`${where}: Id must equal the entry key`);
        if (!key.startsWith('{{ModId}}_')) add(`${where}: Id must start with {{ModId}}_`);
        for (const t of String(entry.Trigger || '').split(/\s+/).filter(Boolean)) if (!TRIGGERS.includes(t)) add(`${where}: unknown trigger ${t}`);
        if (!entry.Trigger) add(`${where}: Trigger is missing`);
        const actions = [...(entry.Actions || []), ...(entry.Action ? [entry.Action] : [])];
        if (!actions.length) add(`${where}: no Action or Actions`);
        for (const a of actions) checkAction(a, where);
        if (entry.Condition) checkCondition(entry.Condition, where);
        if (entry.SkipPermanentlyCondition) checkCondition(entry.SkipPermanentlyCondition, where);
      }
    }
  }

  function checkCondition(condition, where) {
    for (const args of splitQueries(condition)) {
      const name = args[0].replace(/^!/, '');
      if (!QUERIES.includes(name)) { add(`${where}: unknown game state query ${name}`); continue; }
      if (name === 'SEASON_DAY') {
        const rest = args.slice(1);
        if (!rest.length || rest.length % 2) add(`${where}: SEASON_DAY needs pairs of <season> <day>`);
        for (let k = 0; k + 1 < rest.length; k += 2) {
          if (!SEASONS.includes(rest[k].toLowerCase())) add(`${where}: SEASON_DAY season "${rest[k]}" is not spring, summer, fall or winter`);
          if (!(Number(rest[k + 1]) >= 1 && Number(rest[k + 1]) <= 28)) add(`${where}: SEASON_DAY day "${rest[k + 1]}" is not 1 to 28`);
        }
      }
      if (name in NPC_QUERIES) {
        const names = NPC_QUERIES[name] === 'all' ? args.slice(2) : [args[2]];
        if (!['All', 'Any', 'Current', 'Host', 'Target'].includes(args[1])) add(`${where}: ${name} needs a player (Current, Host, All, Any, Target)`);
        for (const n of names) if (!['Any', 'AnyDateable'].includes(n)) npcName(n, where);
      }
    }
  }

  function checkAction(action, where) {
    const args = splitArgs(action);
    if (!ACTIONS.includes(args[0])) { add(`${where}: unknown action ${args[0]}`); return; }
    if (args[0] === 'If') {
      const parts = String(action).slice(3).split('##').map(s => s.trim());
      checkCondition(parts[0], where);
      parts.slice(1).forEach(a => checkAction(a, where));
      return;
    }
    if (args[0] in NPC_ACTIONS) npcName(args[1 + NPC_ACTIONS[args[0]]], where);
    if (args[0] === 'AddMail' || args[0] === 'RemoveMail') {
      if (!['All', 'Current', 'Host'].includes(args[1])) add(`${where}: ${args[0]} needs a player (Current, Host, All)`);
      if (args[3] && !['now', 'tomorrow', 'received', 'all'].includes(args[3].toLowerCase())) add(`${where}: ${args[0]} type "${args[3]}" is not now, tomorrow, received or all`);
      if (args[0] === 'AddMail' && args[3]?.toLowerCase() === 'all') add(`${where}: AddMail cannot use type all`);
      if (args[0] === 'AddMail') mailSent.push({ id: args[2], where });
    }
    if ((args[0] === 'AddItem' || args[0] === 'RemoveItem') && !/^\(\w+\)/.test(args[1] || '')) add(`${where}: ${args[0]} needs a qualified item ID like (O)24, got "${args[1]}"`);
  }

  for (const { id, where } of mailSent) if (id?.startsWith('{{ModId}}_') && !ownMail.has(id)) add(`${where}: AddMail sends "${id}", which no Data/mail entry of this pack defines`);

  // Item IDs: qualified 1.6 IDs anywhere (letters, actions, fields) must be known vanilla objects
  // or objects this pack defines; fields named *ItemId must hold a qualified ID or an item query.
  const all = strings(content);
  for (const { at, value } of all) {
    for (const m of value.matchAll(ITEM_ID)) {
      const id = m[0];
      if (m[2].startsWith('{{ModId}}')) { if (m[1] !== 'O' || !ownObjects.has(m[2])) add(`${at}: ${id} is not an object defined by this pack`); continue; }
      if (!items[id]) add(`${at}: unknown item ${id} (not in tools/stardew/data/items.json)`);
    }
    if (/ItemId(s)?(\[\d+\])?$/.test(at) && !/^\(\w+\)\S+$/.test(value) && !/^[A-Z][A-Z_]+(\s|$)/.test(value)) add(`${at}: "${value}" is not a qualified item ID like (O)24`);
    for (const m of text(value).matchAll(/%item\s+(\w+)\s+([^%]*)%%/g)) {
      if (m[1] !== 'id') { add(`${at}: %item ${m[1]} is not the 1.6 form, use %item id (O)<id> <count> %%`); continue; }
      for (const tok of m[2].trim().split(/\s+/).filter(t => !/^\d+$/.test(t))) if (!/^\(\w+\)/.test(tok)) add(`${at}: %item id "${tok}" is not a qualified item ID`);
    }
  }
  // letters from i18n are checked for item IDs too
  if (i18n) for (const [k, v] of Object.entries(i18n)) for (const m of String(v).matchAll(ITEM_ID)) if (!items[m[0]]) add(`i18n/default.json "${k}": unknown item ${m[0]}`);
  return problems;
}

export const folderName = pack => `[CP] ${pack.name}`;
export const zipName = (pack, version) => `${pack.name.replace(/[^A-Za-z0-9]+/g, '')}-${version}.zip`;

// One top folder "[CP] <Name>/" like the author guide shows for Mods/.
export function buildZip(pack, files, version, outDir) {
  semver(version);
  const manifest = JSON.parse(files['manifest.json'].toString('utf-8'));
  if (manifest.Version !== semver(version)) throw new Error(`manifest.json has version ${manifest.Version}, expected ${semver(version)}`);
  const zip = new AdmZip();
  const dirs = new Set([folderName(pack)]);
  for (const p of Object.keys(files)) p.split('/').slice(0, -1).forEach((_, i, a) => dirs.add(`${folderName(pack)}/${a.slice(0, i + 1).join('/')}`));
  for (const d of [...dirs].sort()) zip.addFile(`${d}/`, Buffer.alloc(0));
  for (const p of Object.keys(files).sort()) zip.addFile(`${folderName(pack)}/${p}`, files[p]);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, zipName(pack, version));
  zip.writeZip(file);
  return file;
}
