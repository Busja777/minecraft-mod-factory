import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadMod } from './lib/mods.js';
import { loadPack } from './lib/skinpacks.js';
import { buildMacroBundle, missingSources, MARKER } from './lib/macro-bundle.js';
import { arg, flag } from './lib/github-output.js';

// Fills the hand-over folder for the Keyboard Maestro macros (see ~/Desktop/Macros/ANLEITUNG.md).
// npm run macro -- --mod <modId>
// npm run macro -- --skinpack <slug> [--refresh]            new project / refresh project page
// npm run macro -- --skinpack <slug> --update [--version x]  file waiting for a manual upload
// Optional: --out <folder> (default ~/Desktop/Macros/aktuell)
const argv = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const outDir = path.resolve(arg(argv, '--out', path.join(os.homedir(), 'Desktop', 'Macros', 'aktuell')));
const modId = arg(argv, '--mod');
const slug = arg(argv, '--skinpack');

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

let bundle;
try {
  if (modId) {
    bundle = buildMacroBundle({ kind: 'mod', meta: loadMod(modId).meta, modId, config, outDir });
  } else if (slug) {
    const mode = flag(argv, '--update') ? 'update' : flag(argv, '--refresh') ? 'refresh' : 'new';
    bundle = buildMacroBundle({ kind: 'skinpack', mode, pack: loadPack(slug), version: arg(argv, '--version'), config, outDir });
  } else {
    fail('Aufruf: npm run macro -- --mod <modId> | --skinpack <slug> [--refresh | --update [--version x]] [--out <ordner>]');
  }
} catch (e) {
  const hint = /No stored mod|No skin pack/.test(e.message) ? '\n  Tipp: erst "git pull", damit die Daten aus GitHub Actions lokal da sind.' : '';
  fail(`${e.message}${hint}`);
}

const missing = missingSources(bundle, p => fs.existsSync(p));
if (missing.length) fail(`Diese Dateien fehlen:\n  ${missing.join('\n  ')}\n  Tipp: erst "git pull".`);

// Only ever wipe a folder this script created itself (or an empty one).
if (fs.existsSync(outDir)) {
  const contents = fs.readdirSync(outDir).filter(n => n !== '.DS_Store');
  if (contents.length && !contents.includes(MARKER)) fail(`${outDir} enthält fremde Dateien. Ich lösche nichts, nimm einen anderen Ordner mit --out.`);
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, MARKER), 'Wird von npm run macro bei jedem Lauf komplett neu geschrieben.\n');

for (const e of bundle.entries) {
  const target = path.join(outDir, e.name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (e.from) fs.copyFileSync(e.from, target);
  else fs.writeFileSync(target, e.text);
}

console.log(`\n✓ ${bundle.title}\n  Ordner: ${outDir}\n`);
for (const e of bundle.entries) console.log(`  ${e.name}`);
console.log('\nJetzt Chrome öffnen und das passende Keyboard-Maestro-Makro starten.');
