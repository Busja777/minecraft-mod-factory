import fs from 'fs';
import path from 'path';
import { loadMod, modDir } from './lib/mods.js';
import { loadPack, packDir } from './lib/skinpacks.js';
import { modKit, skinpackKit } from './lib/kit.js';
import { arg, flag } from './lib/github-output.js';

// Writes the project kit (kit.md) and ./kit-issue.json, which the workflow turns into a GitHub issue.
// node scripts/kit.js --mod <modId>
// node scripts/kit.js --skinpack <slug> [--refresh]   (refresh = existing project: new logo/cover/description)
const argv = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const modId = arg(argv, '--mod');
const slug = arg(argv, '--skinpack');
let kit, file, issue;

if (modId) {
  const { meta } = loadMod(modId);
  kit = modKit(meta, config, { modId });
  file = path.join(modDir(modId), 'kit.md');
  issue = { title: `CurseForge-Projekt anlegen: ${meta.name} (${modId})`, labels: ['cf-project-needed'] };
} else if (slug) {
  const pack = loadPack(slug);
  const mode = flag(argv, '--refresh') ? 'refresh' : 'new';
  kit = skinpackKit(pack, config, { mode });
  file = path.join(packDir(slug), mode === 'new' ? 'kit.md' : 'refresh-kit.md');
  issue = mode === 'new'
    ? { title: `CurseForge-Projekt anlegen: ${pack.name} (${slug})`, labels: ['cf-project-needed'] }
    : { title: `Projektseite auffrischen: ${pack.name} (${slug})`, labels: ['cf-page-refresh'] };
} else {
  throw new Error('Usage: node scripts/kit.js --mod <modId> | --skinpack <slug> [--refresh]');
}

fs.writeFileSync(file, kit);
fs.writeFileSync('./kit-issue.json', JSON.stringify({ ...issue, body: `${kit}\n\n---\nKit-Datei: \`${file}\`` }, null, 2));
console.log(`Kit written: ${file} and ./kit-issue.json`);
