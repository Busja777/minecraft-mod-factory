// Reference data for the Stardew Valley series, taken from public documentation only (the game is
// not owned). Downloads go to the cache, the extracted lists live in the repo:
//
//   cache: ~/.cache/mod-factory/stardew/
//     content-patcher.json, manifest.json     the official JSON schemas from smapi.io
//     wiki/<page>.json                        MediaWiki API answers (wikitext + revision id)
//   repo:  tools/stardew/data/items.json      known vanilla object IDs → English name
//          tools/stardew/data/npcs.json       giftable villagers: birthday, loved gifts
//
//   npm run stardew -- daten     downloads again and rewrites both data files
//
// The wiki is read through its MediaWiki API (api.php) with curl. The article URLs (and the API for
// Node's fetch) answer with a Cloudflare check page instead; we never try to get past such a check.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATA = path.join(HERE, 'data');
export const CACHE = process.env.STARDEW_CACHE || path.join(os.homedir(), '.cache', 'mod-factory', 'stardew');
export const SCHEMAS = {
  contentPatcher: { url: 'https://smapi.io/schemas/content-patcher.json', file: 'content-patcher.json' },
  manifest: { url: 'https://smapi.io/schemas/manifest.json', file: 'manifest.json' }
};
const WIKI = 'https://stardewvalleywiki.com';
const API = `${WIKI}/mediawiki/api.php`;
const UA = { 'User-Agent': 'mod-factory-docs/1.0' };

// The 34 giftable villagers of https://stardewvalleywiki.com/Villagers (marriage candidates and
// the other giftable townspeople). Leo lives on Ginger Island.
export const MARRIAGE = ['Alex', 'Elliott', 'Harvey', 'Sam', 'Sebastian', 'Shane', 'Abigail', 'Emily', 'Haley', 'Leah', 'Maru', 'Penny'];
export const TOWNSPEOPLE = ['Caroline', 'Clint', 'Demetrius', 'Dwarf', 'Evelyn', 'George', 'Gus', 'Jas', 'Jodi', 'Kent', 'Krobus', 'Leo', 'Lewis', 'Linus', 'Marnie', 'Pam', 'Pierre', 'Robin', 'Sandy', 'Vincent', 'Willy', 'Wizard'];
export const ISLAND = ['Leo'];
export const SEASONS = ['spring', 'summer', 'fall', 'winter'];

const stripBom = s => s.replace(/^﻿/, '');

export const schemaFile = key => path.join(CACHE, SCHEMAS[key].file);
export const hasSchemas = () => Object.keys(SCHEMAS).every(k => fs.existsSync(schemaFile(k)));
export const loadSchema = key => JSON.parse(stripBom(fs.readFileSync(schemaFile(key), 'utf-8')));

// Downloads the official schemas once (or again with force). → { contentPatcher, manifest }
export async function ensureSchemas({ force = false } = {}) {
  for (const { url, file } of Object.values(SCHEMAS)) {
    const target = path.join(CACHE, file);
    if (fs.existsSync(target) && !force) continue;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const text = await res.text();
    JSON.parse(stripBom(text));
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(target, text);
  }
  return { contentPatcher: loadSchema('contentPatcher'), manifest: loadSchema('manifest') };
}

// One page as { title, revid, wikitext }, cached under wiki/.
async function wikiPage(title, { force }) {
  const file = path.join(CACHE, 'wiki', `${title.replace(/[^A-Za-z0-9.]+/g, '_')}.json`);
  if (!force && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  const url = `${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext|revid&format=json&formatversion=2`;
  // curl, not fetch: the wiki answers Node's fetch with a Cloudflare check page (403).
  const r = spawnSync('curl', ['-sS', '--fail', '-A', UA['User-Agent'], url], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`curl failed for ${url}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout);
  if (!j.parse) throw new Error(`wiki page ${title} not found`);
  const page = { title: j.parse.title, revid: j.parse.revid, wikitext: j.parse.wikitext };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(page));
  await new Promise(r => setTimeout(r, 500));
  return page;
}

const pageUrl = (title, revid) => `${WIKI}/mediawiki/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&oldid=${revid}`;

// Modding:Objects/Object sprites: a table of every sprite in springobjects with its item ID. A row of
// 24 images is followed by a row of 24 IDs; an image named after an item ("File:Parsnip.png") gives
// the name, unnamed sprites ("File:Springobjects026.png") are not counted as known items.
export function parseObjectSprites(wikitext) {
  const rows = wikitext.split(/\n\|-[^\n]*\n/).map(r => r.split('\n').filter(l => l.startsWith('|') && !l.startsWith('|}')).map(l => l.slice(1).trim()));
  const items = {};
  for (let i = 0; i + 1 < rows.length; i++) {
    const images = rows[i];
    const ids = rows[i + 1];
    if (!images.some(c => c.startsWith('[[File:')) || !ids.every(c => /^\d+$/.test(c))) continue;
    ids.forEach((id, k) => {
      const m = /^\[\[File:([^|\]]+)\.png/i.exec(images[k] || '');
      if (!m || /^Springobjects\d+$/i.test(m[1])) return;
      items[`(O)${Number(id)}`] = m[1].trim();
    });
  }
  return items;
}

// Modding:Gift taste data, raw Data/NPCGiftTastes: "<npc>": "love text/<ids>/like text/<ids>/…".
// Each entry lists item IDs, category numbers (negative) and, since 1.6, context tags (lower case
// with underscores, like "doll_item"). → { loves: { npc: { ids: ['(O)66', …], tags: [...] } }, version }
const isTag = s => /^[a-z0-9]+(_[a-z0-9]+)+$/.test(s);
function splitTastes(list) {
  const parts = list.split(/\s+/).filter(Boolean).filter(id => !/^-\d+$/.test(id));
  return { ids: parts.filter(p => !isTag(p)).map(id => `(O)${id}`), tags: parts.filter(isTag) };
}
export function parseLoves(wikitext) {
  const m = /<syntaxhighlight lang="json">\s*(\{[\s\S]*?\n\})\s*<\/syntaxhighlight>/.exec(wikitext);
  if (!m) throw new Error('gift taste raw data not found');
  const raw = JSON.parse(m[1]);
  const loves = {};
  for (const [npc, value] of Object.entries(raw)) loves[npc] = splitTastes(npc.startsWith('Universal_') ? value : value.split('/')[1] || '');
  return { loves, version: /as of \{\{version\|([\d.]+)\}\}/.exec(wikitext)?.[1] || null };
}

// Villager page infobox: birthday "{{Season|Summer}} 13" or "{{Season|Fall|13}}", favorites "{{Name|X}}…".
export function parseVillager(wikitext) {
  const field = name => new RegExp(`^\\|\\s*${name}\\s*=\\s*(.*)$`, 'm').exec(wikitext)?.[1] || '';
  const b = /\{\{Season\|(\w+)(?:\|(\d+))?\}\}\s*(\d+)?/.exec(field('birthday'));
  if (!b) throw new Error('birthday not found');
  const season = b[1].toLowerCase();
  if (!SEASONS.includes(season)) throw new Error(`unknown season ${b[1]}`);
  const favorites = [...field('favorites').matchAll(/\{\{Name\|([^|}]+)/g)].map(x => x[1].trim());
  return { birthday: { season, day: Number(b[2] || b[3]) }, favorites };
}

export async function refreshData({ force = true } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const sprites = await wikiPage('Modding:Objects/Object sprites', { force });
  const items = parseObjectSprites(sprites.wikitext);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'items.json'), JSON.stringify({
    source: pageUrl(sprites.title, sprites.revid),
    fetched: today,
    note: 'Objects of the springobjects sprite sheet whose sprite the wiki names after an item; accurate as of 1.6 per the page. Newer 1.6 objects with text IDs are not in this list.',
    items
  }, null, 2) + '\n');

  const gifts = await wikiPage('Modding:Gift taste data', { force });
  const { loves, version } = parseLoves(gifts.wikitext);
  const npcs = {};
  const revs = {};
  for (const name of [...MARRIAGE, ...TOWNSPEOPLE].sort()) {
    const page = await wikiPage(name, { force });
    revs[name] = page.revid;
    const v = parseVillager(page.wikitext);
    npcs[name] = {
      birthday: v.birthday,
      marriageCandidate: MARRIAGE.includes(name),
      island: ISLAND.includes(name),
      loves: loves[name]?.ids || [],
      lovedTags: loves[name]?.tags || [],
      favorites: v.favorites
    };
  }
  fs.writeFileSync(path.join(DATA, 'npcs.json'), JSON.stringify({
    source: {
      villagers: `${WIKI}/Villagers`,
      birthdaysAndFavorites: `infobox of each villager page, ${WIKI}/<Name> (revisions in "revisions")`,
      loves: `${pageUrl(gifts.title, gifts.revid)} (raw Data/NPCGiftTastes as of ${version})`
    },
    fetched: today,
    revisions: revs,
    universalLoves: loves.Universal_Love.ids,
    npcs
  }, null, 2) + '\n');
  return { items: Object.keys(items).length, npcs: Object.keys(npcs).length };
}
