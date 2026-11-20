// Vanilla Minecraft: Java Edition reference data for building and checking packs, straight from
// Mojang's public download servers (the same files the launcher uses). Nothing of it is shipped in
// a pack; it is only read to check ids and to copy formats.
//
//   cache: ~/.cache/mod-factory/minecraft/<version>/
//     server.jar, client.jar            the official jars (sha1 checked)
//     data/                             vanilla data pack (recipes, loot tables, advancements, tags …)
//     reports/registries.json           every registry id (items, blocks, triggers, sounds …)
//     assets/                           client assets from client.jar (textures, models, splashes)
//     sounds.json                       from the asset index (not inside client.jar)
//
// The data generator (--reports) runs without starting a server, so no EULA is involved.
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

export const CACHE = process.env.MC_CACHE || path.join(os.homedir(), '.cache', 'mod-factory', 'minecraft');
export const JAVA = process.env.JAVA_21 || '/opt/homebrew/opt/openjdk@21/bin/java';

// A java binary that can run a Minecraft version needing Java `major` (1.21.x: 21, 26.x: 25).
// The oldest one that is new enough wins, so 1.21.1 keeps running on Java 21.
export function javaFor(major = 21) {
  const found = [];
  const add = bin => {
    if (!bin || !fs.existsSync(bin)) return;
    const r = spawnSync(bin, ['-version'], { encoding: 'utf-8' });
    const m = /version "(\d+)/.exec(`${r.stderr}${r.stdout}`);
    if (r.status === 0 && m) found.push({ bin, major: Number(m[1]) });
  };
  for (const [k, v] of Object.entries(process.env)) if (/^JAVA_\d+$/.test(k)) add(v);
  for (const [k, v] of Object.entries(process.env)) if (/^JAVA_HOME(_\d+_\w+)?$/.test(k)) add(path.join(v, 'bin', 'java'));
  for (const name of ['openjdk@21', 'openjdk@25', 'openjdk@26', 'openjdk']) for (const root of ['/opt/homebrew/opt', '/usr/local/opt']) add(path.join(root, name, 'bin', 'java'));
  return found.filter(j => j.major >= major).sort((a, b) => a.major - b.major)[0]?.bin || null;
}
const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function download(url, file, sha1) {
  if (fs.existsSync(file) && (!sha1 || hash(fs.readFileSync(file)) === sha1)) return file;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha1 && hash(buf) !== sha1) throw new Error(`sha1 mismatch for ${url}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return file;
}

const hash = buf => crypto.createHash('sha1').update(buf).digest('hex');

export const versionDir = version => path.join(CACHE, version);

export function hasJava() {
  return fs.existsSync(JAVA) && spawnSync(JAVA, ['-version']).status === 0;
}

// Downloads and unpacks everything once; later calls return at once. → { dir, data, reports, assets, sounds }
export async function ensureVanilla(version = '1.21.1') {
  const dir = versionDir(version);
  const out = {
    dir,
    data: path.join(dir, 'data'),
    reports: path.join(dir, 'reports'),
    assets: path.join(dir, 'assets'),
    sounds: path.join(dir, 'sounds.json')
  };
  if (fs.existsSync(path.join(dir, '.complete'))) return out;
  fs.mkdirSync(dir, { recursive: true });
  const manifest = await json(MANIFEST);
  const entry = manifest.versions.find(v => v.id === version);
  if (!entry) throw new Error(`Mojang has no version ${version}`);
  const meta = await json(entry.url);
  const server = await download(meta.downloads.server.url, path.join(dir, 'server.jar'), meta.downloads.server.sha1);
  const client = await download(meta.downloads.client.url, path.join(dir, 'client.jar'), meta.downloads.client.sha1);

  // The server jar is a bundler: the real server sits inside under META-INF/versions/.
  const bundle = new AdmZip(server);
  const inner = bundle.getEntries().find(e => /^META-INF\/versions\/.+\.jar$/.test(e.entryName));
  if (!inner) throw new Error('No inner server jar in the bundler');
  const serverZip = new AdmZip(inner.getData());
  for (const e of serverZip.getEntries()) {
    if (e.isDirectory || !e.entryName.startsWith('data/')) continue;
    const target = path.join(dir, e.entryName);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, e.getData());
  }

  for (const e of new AdmZip(client).getEntries()) {
    if (e.isDirectory || !e.entryName.startsWith('assets/')) continue;
    const target = path.join(dir, e.entryName);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, e.getData());
  }

  const index = await json(meta.assetIndex.url);
  const sounds = index.objects['minecraft/sounds.json'];
  if (sounds) await download(`https://resources.download.minecraft.net/${sounds.hash.slice(0, 2)}/${sounds.hash}`, out.sounds, sounds.hash);
  fs.writeFileSync(path.join(dir, 'asset-index.json'), JSON.stringify(index));

  const needs = meta.javaVersion?.majorVersion || 21;
  const java = javaFor(needs);
  if (!java) throw new Error(`Java ${needs} is missing for Minecraft ${version}; brew install openjdk@${needs}`);
  // What the jar says about itself: pack formats and the Java it needs.
  const info = JSON.parse(bundle.readAsText('version.json'));
  fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ id: info.id, java: needs, pack: info.pack_version, stable: info.stable }, null, 2) + '\n');
  const gen = spawnSync(java, ['-DbundlerMainClass=net.minecraft.data.Main', '-jar', server, '--reports', '--output', path.join(dir, 'generated')], { cwd: dir, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  if (gen.status !== 0) throw new Error(`Data generator failed: ${(gen.stderr || gen.stdout).slice(-2000)}`);
  fs.renameSync(path.join(dir, 'generated', 'reports'), out.reports);
  fs.rmSync(path.join(dir, 'generated'), { recursive: true, force: true });
  fs.writeFileSync(path.join(dir, '.complete'), new Date().toISOString());
  return out;
}

// registry name ("item", "block", "trigger_type", "sound_event" …) → Set of ids without "minecraft:"
export function registry(vanilla, name) {
  const all = JSON.parse(fs.readFileSync(path.join(vanilla.reports, 'registries.json'), 'utf-8'));
  const reg = all[`minecraft:${name}`];
  if (!reg) throw new Error(`No registry minecraft:${name}`);
  return new Set(Object.keys(reg.entries).map(id => id.replace(/^minecraft:/, '')));
}

// Vanilla item tags ("#minecraft:planks" → true)
export function itemTagExists(vanilla, tag) {
  const [ns, name] = tag.replace(/^#/, '').split(':');
  return ns === 'minecraft' && fs.existsSync(path.join(vanilla.data, 'minecraft', 'tags', 'item', `${name}.json`));
}

// { id, java, pack: { data, resource } | { data_major, data_minor, resource_major, resource_minor }, stable }
// Read from the note ensureVanilla leaves in the cache, or straight from the downloaded jar.
export function versionInfo(version) {
  const file = path.join(versionDir(version), 'version.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  const jar = path.join(versionDir(version), 'server.jar');
  if (!fs.existsSync(jar)) throw new Error(`Minecraft ${version} is not downloaded yet (ensureVanilla)`);
  const info = JSON.parse(new AdmZip(jar).readAsText('version.json'));
  const out = { id: info.id, java: info.java_version || 21, pack: info.pack_version, stable: info.stable };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  return out;
}

// Data and resource pack format of a version as [major, minor]; versions before 1.21.9 have no minor.
export function packFormat(version, kind) {
  const p = versionInfo(version).pack;
  if (p[`${kind}_major`] !== undefined) return [p[`${kind}_major`], p[`${kind}_minor`] || 0];
  return [p[kind], 0];
}
