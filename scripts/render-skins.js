import fs from 'fs';
import path from 'path';
import { renderSkins, composeRow } from '../tools/skin-render/render.js';
import { loadPack, savePack, packDir } from './lib/skinpacks.js';
import { arg, flag } from './lib/github-output.js';

// Renders the skins of a pack version into data/skins/<slug>/media/:
//   v<version>-skins.png (row for the description) and v<version>/<skin>.png (single renders).
// node scripts/render-skins.js --pack <slug> [--version 1.2 | --all] [--force]
const argv = process.argv.slice(2);
const slug = arg(argv, '--pack');
if (!slug) throw new Error('Usage: node scripts/render-skins.js --pack <slug> [--version <v> | --all] [--force]');
const pack = loadPack(slug);
const dir = packDir(slug);
const wanted = arg(argv, '--version');
const targets = flag(argv, '--all') ? pack.versions : pack.versions.filter(v => wanted ? v.version === wanted : v.status === 'due').slice(0, wanted ? 1 : 1);
if (!targets.length) throw new Error(`Nothing to render for ${slug}${wanted ? ` version ${wanted}` : ''}`);

for (const v of targets) {
  const rowRel = `media/v${v.version}-skins.png`;
  if (!flag(argv, '--force') && fs.existsSync(path.join(dir, rowRel))) { console.log(`skip ${rowRel} (exists)`); continue; }
  const skins = v.skins.map(s => ({ ...s, png: fs.readFileSync(path.join(dir, 'skins', v.version, s.file)) }));
  const renders = await renderSkins(skins);
  fs.mkdirSync(path.join(dir, 'media', `v${v.version}`), { recursive: true });
  renders.forEach((r, i) => fs.writeFileSync(path.join(dir, 'media', `v${v.version}`, skins[i].file), r));
  fs.writeFileSync(path.join(dir, rowRel), await composeRow(renders));
  v.media = [rowRel];
  console.log(`Rendered ${skins.length} skins → ${rowRel}`);
}
savePack(pack);
