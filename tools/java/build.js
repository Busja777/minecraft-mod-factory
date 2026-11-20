// Builds a Minecraft Java pack of the series (data pack or resource pack) into an upload-ready zip,
// or a Fabric mod (kind "mod") into an upload-ready jar.
//
//   npm run java -- bau <slug> --version 1.0     → Output/serie/java/<slug>/<Name>-1.0.zip (mod: .jar)
//   npm run java -- test [<slug>]                → generate and check only (mod: JUnit tests and game tests)
//   options: --out <folder>
//
// Mods are built by the shared Gradle build in tools/java/fabric/ (Gradle 8.8, Loom, Java 21).
//
// The pack is checked against the vanilla registries of its Minecraft version (items, blocks,
// advancement triggers, recipe types, sound events, sound files), taken from Mojang's official
// jars (tools/java/vanilla.js, needs Java 21: brew install openjdk@21).
// A pack can serve more Minecraft versions in the same zip ("also" in pack.json). It is generated
// and checked once per version; where the game ships its headless test entry point (1.21.5 and
// newer, tools/java/loadtest.js) the finished data pack is also loaded by the game itself.
// Minecraft 26.x needs Java 25 (brew install openjdk@25 or newer).
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { HERE, listPacks, packOf, generate, checkPack, buildZip, isMod, jarName, versionsOf } from './lib.js';
import { ensureVanilla } from './vanilla.js';
import { supportsLoadTest, loadTest } from './loadtest.js';
import { FABRIC, gradle, builtJar, hasGameTests } from './fabric/gradle.js';

const args = process.argv.slice(2);
const [cmd, slugArg] = args;
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };

const list = (slug, problems) => `${slug}: ${problems.slice(0, 25).join(`\n✗ ${slug}: `)}${problems.length > 25 ? `\n✗ … and ${problems.length - 25} more` : ''}`;

// Generates and checks the pack for every Minecraft version it serves. → { pack, files, more }
async function check(slug) {
  const pack = packOf(slug);
  const built = [];
  for (const mc of versionsOf(pack)) {
    const vanilla = await ensureVanilla(mc);
    const files = await generate(pack, vanilla, mc);
    const problems = checkPack(pack, files, vanilla);
    if (problems.length) fail(list(`${slug} (Minecraft ${mc})`, problems));
    built.push({ mc, files });
  }
  console.log(`${slug}: ${Object.keys(built[0].files).length} files, checked against Minecraft ${versionsOf(pack).join(', ')}`);
  return { pack, files: built[0].files, more: built.slice(1) };
}

// The finished zip, loaded by the game for every version that can do it without a window.
function loadInGame(pack, zip) {
  if (pack.kind !== 'data') return;
  for (const mc of versionsOf(pack)) {
    if (!supportsLoadTest(mc)) continue;
    const r = loadTest(mc, [zip]);
    if (!r.ok) fail(list(`${pack.slug} (loaded by Minecraft ${mc})`, r.errors.map(e => [e.registry, e.element, e.message].filter(Boolean).join(' · '))));
    console.log(`${pack.slug}: loaded by Minecraft ${mc} without errors`);
  }
}

// Gradle's output is only shown when it fails (the game test server logs a lot).
function runGradle(mod, args) {
  if (!fs.existsSync(path.join(FABRIC, '.gradle'))) console.log('First Gradle run: downloads Gradle, Minecraft and Fabric into ~/.gradle (takes a while) …');
  let r;
  try { r = gradle(args, { quiet: true }); } catch (e) { fail(`${mod.slug}: ${e.message}`); }
  if (r.status !== 0) fail(`${mod.slug}: gradle ${args.join(' ')} failed\n${r.output.split('\n').slice(-80).join('\n')}`);
  return r.output;
}

// A mod: JUnit tests of the pure logic, then the in-world game tests if the mod has any.
function testMod(mod) {
  runGradle(mod, [`:${mod.slug}:test`]);
  let games = '';
  if (hasGameTests(mod)) {
    const out = runGradle(mod, [`:${mod.slug}:runGametest`]);
    games = `, ${(/All (\d+) required tests passed/.exec(out) || [, '?'])[1]} game tests`;
  }
  console.log(`${mod.slug}: JUnit tests${games} passed (Fabric, Minecraft ${mod.mc})`);
}

// A mod: gradle build (compiles, tests, remaps) with the version, then the jar goes to the output folder.
function buildMod(mod, version, outDir) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) fail(`Invalid version "${version}"`);
  if (hasGameTests(mod)) runGradle(mod, [`:${mod.slug}:runGametest`]);
  runGradle(mod, [`:${mod.slug}:clean`, `:${mod.slug}:build`, `-PmodVersion=${version}`]);
  const jar = builtJar(mod, version);
  if (!fs.existsSync(jar)) fail(`${mod.slug}: ${jar} was not built`);
  const meta = JSON.parse(new AdmZip(jar).readAsText('fabric.mod.json'));
  if (meta.id !== mod.modId || meta.version !== version) fail(`${mod.slug}: the jar says ${meta.id} ${meta.version}, expected ${mod.modId} ${version}`);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, jarName(mod, version));
  fs.copyFileSync(jar, file);
  return file;
}

if (cmd === 'test') {
  for (const slug of slugArg && !slugArg.startsWith('--') ? [slugArg] : listPacks()) {
    const pack = packOf(slug);
    if (isMod(pack)) testMod(pack);
    else {
      const { files, more } = await check(slug);
      if (pack.kind === 'data' && versionsOf(pack).some(supportsLoadTest)) loadInGame(pack, await buildZip(pack, files, '0.0', fs.mkdtempSync(path.join(os.tmpdir(), 'java-test-')), more));
    }
  }
} else if (cmd === 'bau') {
  const version = opt('version');
  if (!slugArg || !version) fail('Aufruf: npm run java -- bau <slug> --version 1.0');
  const out = opt('out', path.resolve(HERE, '../..', 'Output', 'serie', 'java', slugArg));
  const pack = packOf(slugArg);
  if (isMod(pack)) console.log(`✓ ${buildMod(pack, version, out)}`);
  else {
    const { files, more } = await check(slugArg);
    const zip = await buildZip(pack, files, version, out, more);
    loadInGame(pack, zip);
    console.log(`✓ ${zip}`);
  }
  console.log(`  Game versions for the stock: ${pack.gameVersions.join(',')}`);
} else {
  fail('Aufruf: npm run java -- bau <slug> --version 1.0 | test [<slug>]');
}
