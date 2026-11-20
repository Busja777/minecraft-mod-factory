// Builds an add-on of the Bedrock series into an upload-ready .mcpack / .mcaddon.
//
//   npm run bedrock -- bau <slug> --version 1.0   → Output/serie/bedrock/<slug>/<Name>-1.0.mcpack
//   npm run bedrock -- test [<slug>]              → generate and check only
//   options: --out <folder>
//
// Every pack is generated from and checked against Mojang's bedrock-samples of its release
// (tools/bedrock/samples.js downloads them once). Nothing is loaded in the game: Bedrock cannot
// be started headless without the EULA, so the series stays blind like Stardew.
import path from 'path';
import { HERE, listPacks, packOf, generate, checkPack, buildPack } from './lib.js';
import { ensureSamples } from './samples.js';

const args = process.argv.slice(2);
const [cmd, slugArg] = args;
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };

async function check(slug) {
  const pack = packOf(slug);
  const samples = await ensureSamples(pack.samples);
  const files = await generate(pack, samples);
  const problems = checkPack(pack, files, samples);
  if (problems.length) fail(`${slug}: ${problems.slice(0, 25).join(`\n✗ ${slug}: `)}${problems.length > 25 ? `\n✗ … and ${problems.length - 25} more` : ''}`);
  console.log(`${slug}: ${Object.keys(files).length} files, checked against bedrock-samples ${samples.version}`);
  return { pack, files };
}

if (cmd === 'test') {
  for (const slug of slugArg && !slugArg.startsWith('--') ? [slugArg] : listPacks()) await check(slug);
} else if (cmd === 'bau') {
  const version = opt('version');
  if (!slugArg || !version) fail('Aufruf: npm run bedrock -- bau <slug> --version 1.0');
  const { pack, files } = await check(slugArg);
  console.log(`✓ ${await buildPack(pack, files, version, opt('out', path.resolve(HERE, '../..', 'Output', 'serie', 'bedrock', slugArg)))}`);
  console.log(`  Game versions for the stock: ${pack.gameVersions.join(',')}`);
} else {
  fail('Aufruf: npm run bedrock -- bau <slug> --version 1.0 | test [<slug>]');
}
