// Builds the WoW addon Gold Diary into an upload-ready zip (GoldDiary/GoldDiary.toc + Lua files).
//
//   npm run gold-diary -- --version 1.0        → Output/gold-diary/GoldDiary-1.0.zip
//   options: --out <folder>
//
// Before zipping it checks the files for things the game does not know and runs the Lua tests
// against a stand-in client (needs LuaJIT: brew install luajit). Nothing here needs the game.
import path from 'path';
import { HERE, staticProblems, hasLuajit, runLuaTests, buildZip } from './lib.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const version = opt('version');
if (!version) { console.error('✗ Aufruf: npm run gold-diary -- --version 1.0'); process.exit(1); }

const problems = staticProblems();
if (problems.length) { console.error(`✗ ${problems.join('\n✗ ')}`); process.exit(1); }
if (!hasLuajit()) { console.error('✗ LuaJIT fehlt (brew install luajit), ohne Tests wird nicht gebaut.'); process.exit(1); }
const tests = runLuaTests();
console.log(tests.output);
if (!tests.ok) process.exit(1);

const out = opt('out', path.resolve(HERE, '../../..', 'Output', 'gold-diary'));
console.log(`✓ ${buildZip(version, out)}`);
