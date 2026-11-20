// Builds a World of Warcraft addon of the series into an upload-ready zip.
//
//   npm run wow -- bau <slug> --version 1.0     → Output/serie/wow/<slug>/<AddonName>-1.0.zip
//   npm run wow -- test [<slug>]                → checks and Lua tests only
//   options: --out <folder>
//
// Before zipping it checks the files for things the game does not know and runs the Lua tests
// against a stand-in client (needs LuaJIT: brew install luajit). Nothing here needs the game.
import path from 'path';
import { HERE, listAddons, addonOf, staticProblems, translationProblems, hasLuajit, runLuaTests, buildZip } from './lib.js';

const args = process.argv.slice(2);
const [cmd, slugArg] = args;
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };

function check(slug) {
  const a = addonOf(slug);
  const problems = [...staticProblems(a), ...translationProblems(a)];
  if (problems.length) fail(`${slug}: ${problems.join(`\n✗ ${slug}: `)}`);
  if (!hasLuajit()) fail('LuaJIT fehlt (brew install luajit), ohne Tests wird nicht gebaut.');
  const tests = runLuaTests(a);
  console.log(`${slug}: ${tests.output}`);
  if (!tests.ok) process.exit(1);
  return a;
}

if (cmd === 'test') {
  for (const slug of slugArg && !slugArg.startsWith('--') ? [slugArg] : listAddons()) check(slug);
} else if (cmd === 'bau') {
  const version = opt('version');
  if (!slugArg || !version) fail('Aufruf: npm run wow -- bau <slug> --version 1.0');
  const a = check(slugArg);
  const out = opt('out', path.resolve(HERE, '../..', 'Output', 'serie', 'wow', slugArg));
  console.log(`✓ ${buildZip(a, version, out)}`);
} else {
  fail('Aufruf: npm run wow -- bau <slug> --version 1.0 | test [<slug>]');
}
