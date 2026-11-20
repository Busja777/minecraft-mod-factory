// Builds a Content Patcher pack of the Stardew Valley series into an upload-ready zip.
//
//   npm run stardew -- bau <slug> --version 1.0   → Output/serie/stardew/<slug>/<Name>-1.0.zip
//   npm run stardew -- test [<slug>]              → generate and check only
//   npm run stardew -- daten                      → download the wiki data again (tools/stardew/data/)
//   options: --out <folder>
//
// The game is not owned; packs are checked against the official SMAPI/Content Patcher schemas
// (cached from smapi.io) and the vanilla data extracted from the wiki (tools/stardew/wiki.js).
import path from 'path';
import { HERE, listPacks, packOf, generate, checkPack, buildZip, loadRef, latestVersion } from './lib.js';
import { ensureSchemas, refreshData } from './wiki.js';

const args = process.argv.slice(2);
const [cmd, slugArg] = args;
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };

async function check(slug, version) {
  let pack;
  try { pack = packOf(slug); } catch (e) { fail(e.message); }
  const schemas = await ensureSchemas();
  const ref = loadRef();
  const files = await generate(pack, ref, version || latestVersion(pack));
  const problems = checkPack(pack, files, ref, schemas);
  if (problems.length) fail(`${slug}: ${problems.slice(0, 25).join(`\n✗ ${slug}: `)}${problems.length > 25 ? `\n✗ … and ${problems.length - 25} more` : ''}`);
  console.log(`${slug}: ${Object.keys(files).length} files, checked against the Content Patcher ${pack.contentPatcher} and SMAPI manifest schemas and the 1.6 data lists`);
  return { pack, files };
}

if (cmd === 'test') {
  for (const slug of slugArg && !slugArg.startsWith('--') ? [slugArg] : listPacks()) await check(slug);
} else if (cmd === 'bau') {
  const version = opt('version');
  if (!slugArg || !version) fail('Aufruf: npm run stardew -- bau <slug> --version 1.0');
  const { pack, files } = await check(slugArg, version);
  const out = opt('out', path.resolve(HERE, '../..', 'Output', 'serie', 'stardew', slugArg));
  console.log(`✓ ${buildZip(pack, files, version, out)}`);
  console.log(`  Game versions for the stock: ${pack.gameVersions.join(',')}`);
} else if (cmd === 'daten') {
  await ensureSchemas({ force: true });
  const n = await refreshData({ force: true });
  console.log(`✓ ${n.items} items, ${n.npcs} villagers → tools/stardew/data/ (check the git diff before using it)`);
} else {
  fail('Aufruf: npm run stardew -- bau <slug> --version 1.0 | test [<slug>] | daten');
}
