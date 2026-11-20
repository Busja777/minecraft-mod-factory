// Loads data packs in the game itself, without a window and without playing: newer server jars
// ship a headless test entry point (net.minecraft.gametest.Main) that builds a test world with
// the given packs and reports every file the game cannot read. It is not the dedicated server
// (no eula.txt, no network port). Versions before 1.21.5 do not have it.
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { versionDir, versionInfo, javaFor } from './vanilla.js';

const MAIN = 'net/minecraft/gametest/Main.class';

export function supportsLoadTest(version) {
  const marker = path.join(versionDir(version), 'loadtest.json');
  if (fs.existsSync(marker)) return JSON.parse(fs.readFileSync(marker, 'utf-8')).supported;
  const bundle = new AdmZip(path.join(versionDir(version), 'server.jar'));
  const inner = bundle.getEntries().find(e => /^META-INF\/versions\/.+\.jar$/.test(e.entryName));
  const supported = !!inner && new AdmZip(inner.getData()).getEntry(MAIN) !== null;
  fs.writeFileSync(marker, JSON.stringify({ supported }) + '\n');
  return supported;
}

// The game's own report: "> Errors in registry <r>:" / ">> Errors in element <id>:" … "Caused by: <why>",
// plus single ERROR/WARN lines that name a file of a pack (tags, functions, pack metadata).
export function parseLoadLog(log) {
  const errors = [];
  let registry = null;
  let current = null;
  for (const line of log.split('\n')) {
    let m;
    if ((m = /^> Errors in registry (\S+):/.exec(line))) { registry = m[1]; continue; }
    if ((m = /^>> Errors in element (\S+):/.exec(line))) { current = { registry, element: m[1], message: '' }; errors.push(current); continue; }
    if (current && !current.message && (m = /^Caused by: (?:[\w.$]+: )?(.*)$/.exec(line))) { current.message = m[1].slice(0, 300); continue; }
    if (/^\[[\d:]+\] \[[^\]]*\/(ERROR|WARN)\]: /.test(line) && !/Registry loading errors/.test(line)) {
      const text = line.replace(/^\[[\d:]+\] \[[^\]]*\]: /, '');
      if (/Unsafe|deprecated|joml|Failed to load registries|Ambiguity between arguments/.test(text)) continue;
      errors.push({ registry: null, element: null, message: text.slice(0, 300) });
      current = null;
    }
  }
  return errors;
}

// zips: pack zip files. → { ok, included: [file names the game accepted], errors: [{ registry, element, message }], log }
export function loadTest(version, zips) {
  if (!supportsLoadTest(version)) throw new Error(`Minecraft ${version} has no headless load test (needs 1.21.5 or newer)`);
  const java = javaFor(versionInfo(version).java);
  if (!java) throw new Error(`Java ${versionInfo(version).java} is missing for Minecraft ${version}`);
  // Its own folder per run, so two checks at the same time do not see each other's packs.
  const work = fs.mkdtempSync(path.join(versionDir(version), 'gametest-'));
  const packs = path.join(work, 'packs');
  fs.mkdirSync(packs);
  for (const zip of zips) fs.copyFileSync(zip, path.join(packs, path.basename(zip)));
  const r = spawnSync(java, ['-DbundlerMainClass=net.minecraft.gametest.Main', '-jar', path.join(versionDir(version), 'server.jar'), '--packs', 'packs', '--universe', 'world'],
    { cwd: work, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  const log = `${r.stdout || ''}${r.stderr || ''}`.split('\n').filter(l => !l.startsWith('Unpacking ')).join('\n');
  const included = [...log.matchAll(/Included zip pack (\S+)/g)].map(m => m[1]);
  const errors = parseLoadLog(log);
  const missing = zips.map(z => path.basename(z)).filter(n => !included.includes(n));
  for (const n of missing) errors.push({ registry: null, element: null, message: `the game did not accept ${n} as a pack` });
  fs.rmSync(work, { recursive: true, force: true });
  return { ok: errors.length === 0, included, errors, exit: r.status, log };
}
