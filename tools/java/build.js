// Builds a Minecraft Java pack of the series (data pack or resource pack) into an upload-ready zip.
//
//   npm run java -- bau <slug> --version 1.0     → Output/serie/java/<slug>/<Name>-1.0.zip
//   npm run java -- test [<slug>]                → generate and check only
//   options: --out <folder>
//
// The pack is checked against the vanilla registries of its Minecraft version (items, blocks,
// advancement triggers, recipe types, sound events, sound files), taken from Mojang's official
// jars (tools/java/vanilla.js, needs Java 21: brew install openjdk@21).
import path from 'path';
import { HERE, listPacks, packOf, generate, checkPack, buildZip } from './lib.js';
import { ensureVanilla } from './vanilla.js';

const args = process.argv.slice(2);
const [cmd, slugArg] = args;
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };

async function check(slug) {
  const pack = packOf(slug);
  const vanilla = await ensureVanilla(pack.mc);
  const files = await generate(pack, vanilla);
  const problems = checkPack(pack, files, vanilla);
  if (problems.length) fail(`${slug}: ${problems.slice(0, 25).join(`\n✗ ${slug}: `)}${problems.length > 25 ? `\n✗ … and ${problems.length - 25} more` : ''}`);
  console.log(`${slug}: ${Object.keys(files).length} files, checked against Minecraft ${pack.mc}`);
  return { pack, files };
}

if (cmd === 'test') {
  for (const slug of slugArg && !slugArg.startsWith('--') ? [slugArg] : listPacks()) await check(slug);
} else if (cmd === 'bau') {
  const version = opt('version');
  if (!slugArg || !version) fail('Aufruf: npm run java -- bau <slug> --version 1.0');
  const { pack, files } = await check(slugArg);
  const out = opt('out', path.resolve(HERE, '../..', 'Output', 'serie', 'java', slugArg));
  console.log(`✓ ${await buildZip(pack, files, version, out)}`);
  console.log(`  Game versions for the stock: ${pack.gameVersions.join(',')}`);
} else {
  fail('Aufruf: npm run java -- bau <slug> --version 1.0 | test [<slug>]');
}
