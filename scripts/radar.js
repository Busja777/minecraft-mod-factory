// The day-one machine. No AI, no upload: it only reads public sources and writes data/radar/.
//
//   npm run radar                 read the sources, check every Java pack against the newest
//                                 Minecraft release and test version, write data/radar/*.json
//   npm run radar -- --dry-run    the same, without writing
//   npm run radar -- --no-build   only compare the versions (no downloads of Minecraft)
//
// Sources: Mojang's version manifest (releases and test versions), the releases of
// Mojang/bedrock-samples and of SMAPI on GitHub. data/radar/versions.json is the baseline; a
// difference is what the nightly build session reacts to (tools/serie/NACHT.md).
//
// For each Java pack the generator (pack.js) is run for the new version, the result is checked
// against that version's data and, for data packs, loaded by the game's own headless test server
// (tools/java/loadtest.js). data/radar/java.json says which packs are ready for the version and
// what the version adds (new items, blocks, mobs, biomes), which is the material for day-one
// updates and for projects prepared ahead of a release.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { latestJava, latestBedrockSamples, changes, merged, nextContent, compatLine, waitingFor } from './lib/radar.js';
import { listPacks, packOf, generate, checkPack, buildZip, isMod, sidesOf } from '../tools/java/lib.js';
import { ensureVanilla, registry, javaFor } from '../tools/java/vanilla.js';
import { supportsLoadTest, loadTest } from '../tools/java/loadtest.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noBuild = args.includes('--no-build');
const DIR = path.resolve('data', 'radar');
const VERSIONS = path.join(DIR, 'versions.json');
const JAVA = path.join(DIR, 'java.json');
const today = new Date().toISOString().slice(0, 10);

async function getJson(url) {
  const headers = { 'User-Agent': 'radar', Accept: 'application/json' };
  if (process.env.GITHUB_TOKEN && url.startsWith('https://api.github.com/')) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// A source that cannot be read today is skipped and named; the others still count.
async function source(name, read) {
  try { return await read(); } catch (e) { console.log(`! ${name}: not readable today (${e.message})`); return null; }
}

const REGISTRIES = ['item', 'block', 'entity_type', 'mob_effect'];
const biomes = vanilla => {
  const dir = path.join(vanilla.data, 'minecraft', 'worldgen', 'biome');
  return new Set(fs.existsSync(dir) ? fs.readdirSync(dir).map(f => f.replace(/\.json$/, '')) : []);
};
const contentOf = vanilla => ({ ...Object.fromEntries(REGISTRIES.map(r => [r, registry(vanilla, r)])), biome: biomes(vanilla) });

// Would this pack, generated for `version`, be read by that version? → { ok, loaded, files, problems }
async function tryPack(pack, version, vanilla) {
  let files;
  try { files = await generate(pack, vanilla, version); } catch (e) { return { ok: false, loaded: false, files: 0, problems: [`the generator fails: ${e.message}`] }; }
  const problems = checkPack(pack, files, vanilla);
  let loaded = false;
  if (!problems.length && sidesOf(pack).includes('data') && supportsLoadTest(version)) {
    const zip = await buildZip({ ...pack, mc: version, also: undefined, alsoLoads: undefined }, files, '0.0', fs.mkdtempSync(path.join(os.tmpdir(), 'radar-')));
    const r = loadTest(version, [zip]);
    loaded = true;
    for (const e of r.errors) problems.push([e.registry, e.element, e.message].filter(Boolean).join(' · '));
  }
  return { ok: problems.length === 0, loaded, files: Object.keys(files).length, problems: problems.slice(0, 8), more: Math.max(0, problems.length - 8) };
}

const baseline = JSON.parse(fs.readFileSync(VERSIONS, 'utf-8'));
const now = {};
const manifest = await source('Minecraft Java', () => getJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'));
if (manifest) now.minecraftJava = latestJava(manifest);
const samples = await source('bedrock-samples', () => getJson('https://api.github.com/repos/Mojang/bedrock-samples/releases?per_page=20'));
if (samples) now.minecraftBedrockSamples = latestBedrockSamples(samples);
const smapi = await source('SMAPI', () => getJson('https://api.github.com/repos/Pathoschild/SMAPI/releases/latest'));
if (smapi?.tag_name) now.smapi = { newest: smapi.tag_name.replace(/^v/, '') };

const diff = changes(baseline, now);
console.log(diff.length ? diff.map(c => `NEW ${c.source}.${c.key}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join('\n') : 'No new versions at the sources.');

let java = fs.existsSync(JAVA) ? JSON.parse(fs.readFileSync(JAVA, 'utf-8')) : null;
const targets = now.minecraftJava ? [now.minecraftJava.release, now.minecraftJava.snapshot].filter(Boolean) : [];
if (!noBuild && targets.length) {
  const packs = listPacks().map(slug => packOf(slug));
  const report = { release: now.minecraftJava.release, snapshot: now.minecraftJava.snapshot, packs: {}, mods: {}, next: null };
  const vanillas = {};
  for (const version of targets) {
    try { vanillas[version] = await ensureVanilla(version); } catch (e) { console.log(`! Minecraft ${version}: ${e.message}`); }
  }
  for (const pack of packs) {
    if (isMod(pack)) { report.mods[pack.slug] = { mc: pack.mc, note: 'a mod is compiled per Minecraft version; it needs its own build for a new one' }; continue; }
    report.packs[pack.slug] = { kind: pack.kind, serves: [pack.mc, ...(pack.also || [])] };
    for (const version of targets) {
      if (!vanillas[version]) continue;
      const waits = waitingFor(pack, version);
      const result = waits ? { ok: null, waiting: waits } : await tryPack(pack, version, vanillas[version]);
      report.packs[pack.slug][version] = result;
      console.log(compatLine(pack.slug, version, result));
    }
  }
  const [from, to] = [now.minecraftJava.release, now.minecraftJava.snapshot];
  if (to && vanillas[from] && vanillas[to]) {
    report.next = { from, to, adds: nextContent(contentOf(vanillas[from]), contentOf(vanillas[to])) };
    console.log(`Minecraft ${to} adds: ${Object.entries(report.next.adds).map(([k, v]) => `${v.length} ${k}`).join(', ') || 'nothing in the watched registries'}`);
  }
  // The file only changes when a result changes, so a quiet night leaves no commit.
  const same = java && JSON.stringify({ ...java, checked: undefined }) === JSON.stringify({ checked: undefined, ...report });
  if (!same) java = { checked: today, ...report };
  if (!dryRun && !same) fs.writeFileSync(JAVA, JSON.stringify(java, null, 2) + '\n');
  if (!javaFor(25) && targets.some(v => /^2\d\./.test(v))) console.log('! Java 25 is missing: Minecraft 26.x could not be checked (brew install openjdk@25 or newer)');
}

if (!dryRun && diff.length) fs.writeFileSync(VERSIONS, JSON.stringify(merged(baseline, now, today), null, 2) + '\n');
console.log(dryRun ? 'Dry run: nothing written.' : `Written: ${[diff.length && 'data/radar/versions.json', !noBuild && 'data/radar/java.json'].filter(Boolean).join(', ') || 'nothing (no change)'}`);
