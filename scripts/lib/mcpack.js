import AdmZip from 'adm-zip';
import crypto from 'crypto';
import path from 'path';

// Reads and builds Bedrock skin packs (.mcpack = zip with manifest.json, skins.json, texts/, PNGs).

const SLIM = /customSlim/i;

export function parseLang(text) {
  const map = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^([^#=\s][^=]*)=(.*)$/.exec(line.trim());
    if (m) map[m[1].trim()] = m[2].trim();
  }
  return map;
}

function entry(zip, name) {
  return zip.getEntry(name) || zip.getEntries().find(e => e.entryName.toLowerCase().endsWith('/' + name.toLowerCase())) || null;
}

const json = e => JSON.parse(e.getData().toString('utf8').replace(/^﻿/, ''));

export function readMcpack(source) {
  const zip = new AdmZip(source);
  const manifestE = entry(zip, 'manifest.json');
  const skinsE = entry(zip, 'skins.json');
  if (!manifestE || !skinsE) throw new Error(`Not a skin pack (manifest.json/skins.json missing): ${source}`);
  const manifest = json(manifestE);
  const skinsJson = json(skinsE);
  const langE = entry(zip, 'texts/en_US.lang') || entry(zip, 'en_US.lang');
  const lang = langE ? parseLang(langE.getData().toString('utf8')) : {};
  const ns = skinsJson.localization_name || skinsJson.serialize_name;
  const skins = (skinsJson.skins || []).map(s => {
    const texE = entry(zip, s.texture);
    return {
      texture: path.basename(s.texture),
      name: lang[`skin.${ns}.${s.localization_name}`] || humanize(s.localization_name || s.texture),
      slim: SLIM.test(s.geometry || ''),
      geometry: s.geometry,
      png: texE ? texE.getData() : null
    };
  });
  return { manifest, skinsJson, lang, packTitle: lang[`skinpack.${ns}`] || manifest.header?.name, skins, issues: manifestIssues(manifest, skins) };
}

export function humanize(id) {
  return String(id).replace(/\.png$/i, '').replace(/_+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function manifestIssues(manifest, skins = []) {
  const issues = [];
  const h = manifest.header || {};
  for (const [k, v] of [['name', h.name], ['description', h.description]]) {
    if (!v) issues.push(`manifest ${k} is empty`);
    else if (/\|\||pack\.(name|description)|\$\{/.test(v)) issues.push(`manifest ${k} contains a placeholder: ${v}`);
  }
  if (h.uuid && manifest.modules?.some(m => m.uuid === h.uuid)) issues.push('header and module share the same UUID');
  for (const s of skins) if (!s.png) issues.push(`texture ${s.texture} missing in pack`);
  if (skins.some(s => s.geometry && !/^geometry\.humanoid\.custom(Slim)?$/.test(s.geometry))) issues.push('custom geometry (4D) skins cannot be rendered');
  return issues;
}

const locId = name => humanize(name).replace(/[^A-Z0-9]/g, '') || 'Skin';

// Builds a fresh .mcpack with new UUIDs. skins: [{ name, png: Buffer, slim }]
export function buildMcpack({ packName, description, serializeName, skins, version = [1, 0, 0], minEngine = [1, 16, 0] }) {
  if (!skins?.length) throw new Error('buildMcpack needs at least one skin');
  const ns = serializeName || packName.replace(/[^A-Za-z0-9]/g, '');
  const manifest = {
    format_version: 2,
    header: { name: packName, description, uuid: crypto.randomUUID(), version, min_engine_version: minEngine },
    modules: [{ type: 'skin_pack', uuid: crypto.randomUUID(), version }]
  };
  const used = new Set();
  const entries = skins.map((s, i) => {
    let id = locId(s.name); while (used.has(id)) id += i; used.add(id);
    const file = `${id.toLowerCase()}.png`;
    return { s, id, file };
  });
  const skinsJson = {
    serialize_name: ns, localization_name: ns,
    skins: entries.map(({ s, id, file }) => ({ localization_name: id, geometry: s.slim ? 'geometry.humanoid.customSlim' : 'geometry.humanoid.custom', texture: file, type: 'free' }))
  };
  const lang = [`skinpack.${ns}=${packName}`, ...entries.map(({ s, id }) => `skin.${ns}.${id}=${s.name}`)].join('\n') + '\n';
  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addFile('skins.json', Buffer.from(JSON.stringify(skinsJson, null, 2)));
  zip.addFile('texts/en_US.lang', Buffer.from(lang));
  zip.addFile('texts/languages.json', Buffer.from('["en_US"]'));
  for (const { s, file } of entries) zip.addFile(file, s.png);
  return zip.toBuffer();
}
