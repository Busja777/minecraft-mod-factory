// Builds Fullbright Plus from tools/fullbright-plus/src plus Mojang's vanilla client biome and
// lighting files (github.com/Mojang/bedrock-samples), so it can be rebuilt after game updates.
//
//   node tools/fullbright-plus/build.js                      → Output/Fullbright_Plus_v2.0.0.mcpack
//   node tools/fullbright-plus/build.js --biome-mode minimal → client biomes carry only fog + light
//   node tools/fullbright-plus/build.js --test               → ~/Downloads/FBP_TestA.mcpack, FBP_TestB.mcpack
//   options: --samples v1.26.60.5  --version 2.0.0

import AdmZip from 'adm-zip';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { packFiles, lightingVariant, clientBiomeVariant, missingLighting, LEVELS, FOG_ID, AMBIENT_MAX } from './lib.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const samples = opt('samples', 'v1.26.60.5');
const version = opt('version', '2.0.0').split('.').map(Number);
const biomeMode = opt('biome-mode', 'full');
if (!['full', 'minimal'].includes(biomeMode)) throw new Error(`--biome-mode must be full or minimal`);

const RAW = `https://raw.githubusercontent.com/Mojang/bedrock-samples/${samples}/resource_pack`;
const API = `https://api.github.com/repos/Mojang/bedrock-samples/contents/resource_pack`;

async function get(url, as = 'json') {
  const res = await fetch(url, { headers: { 'User-Agent': 'fullbright-plus-build' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === 'json' ? JSON.parse((await res.text()).replace(/^﻿/, '')) : res.text();
}

async function folder(name, suffix) {
  const list = await get(`${API}/${name}?ref=${samples}`);
  const names = list.filter(e => e.type === 'file' && e.name.endsWith(suffix)).map(e => e.name);
  const out = {};
  for (const n of names) out[n] = await get(`${RAW}/${name}/${n}`);
  return out;
}

async function loadVanilla() {
  const biomeFiles = await folder('biomes', '.client_biome.json');
  const biomes = Object.fromEntries(Object.entries(biomeFiles).map(([n, j]) => [n.replace('.client_biome.json', ''), j]));
  const lighting = await folder('lighting', '.json');
  console.log(`bedrock-samples ${samples}: ${Object.keys(biomes).length} biomes, ${Object.keys(lighting).length} lighting files`);
  return { biomes, lighting };
}

function writeZip(files, folderName, outFile) {
  const zip = new AdmZip();
  for (const [p, c] of Object.entries(files)) zip.addFile(`${folderName}/${p}`, Buffer.isBuffer(c) ? c : Buffer.from(c, 'utf8'));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  zip.writeZip(outFile);
  console.log(`wrote ${outFile} (${Object.keys(files).length} files)`);
}

const src = p => path.join(here, 'src', p);
const base = JSON.parse(fs.readFileSync(src('manifest.json'), 'utf8'));
const icon = fs.readFileSync(src('pack_icon.png'));
const fog = JSON.parse(fs.readFileSync(src('fogs/fullbright.json'), 'utf8'));
const json = o => JSON.stringify(o, null, 2) + '\n';

const testManifest = (name, description, pbr) => json({
  format_version: 2,
  header: { name, description, uuid: crypto.randomUUID(), version: [1, 0, 0], min_engine_version: [1, 21, 120] },
  modules: [{ type: 'resources', uuid: crypto.randomUUID(), version: [1, 0, 0] }],
  ...(pbr ? { capabilities: ['pbr'] } : {})
});

if (args.includes('--test')) {
  const vanilla = await loadVanilla();
  const dl = path.join(os.homedir(), 'Downloads');
  // A: does a per-biome biomes_client.json entry beat the vanilla client_biome fog?
  writeZip({
    'manifest.json': testManifest('FBP Test A', 'Nether: is the red fog gone?', false),
    'pack_icon.png': icon,
    'fogs/fullbright.json': json(fog),
    'biomes_client.json': json({ biomes: { hell: { fog_identifier: FOG_ID } } })
  }, 'FBP_TestA', path.join(dl, 'FBP_TestA.mcpack'));
  // B: does a client_biome with one component merge with vanilla or replace it?
  writeZip({
    'manifest.json': testManifest('FBP Test B', 'Vibrant Visuals, Nether: brighter AND red fog + music still there?', true),
    'pack_icon.png': icon,
    'lighting/fbp_nether_lighting.json': json(lightingVariant(vanilla.lighting['nether_lighting.json'], AMBIENT_MAX)),
    'biomes/hell.client_biome.json': json(clientBiomeVariant(vanilla.biomes.hell, { mode: 'minimal', fog: false }))
  }, 'FBP_TestB', path.join(dl, 'FBP_TestB.mcpack'));
} else {
  const vanilla = await loadVanilla();
  const files = packFiles({ base, icon, fog, vanilla, version, biomeMode });
  for (const l of LEVELS.filter(l => l.ambient != null)) {
    const missing = missingLighting(files, `subpacks/${l.folder}`);
    if (missing.length) throw new Error(`subpack ${l.folder} references missing lighting: ${[...new Set(missing)].join(', ')}`);
  }
  writeZip(files, 'Fullbright_Plus', path.join(root, 'Output', `Fullbright_Plus_v${version.join('.')}.mcpack`));
}
