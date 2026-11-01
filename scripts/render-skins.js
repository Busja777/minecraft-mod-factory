import fs from 'fs';
import path from 'path';
import { openRenderer, flatten, composeRow } from '../tools/skin-render/render.js';
import { resolveView, viewFor } from '../tools/skin-render/views.js';
import { loadPack, savePack, packDir } from './lib/skinpacks.js';
import { arg, flag } from './lib/github-output.js';

// Renders the skins of a pack version in the skin-editor view into data/skins/<slug>/media/:
//   v<version>-skins.png (row for the description) and v<version>/<skin>.png (single renders).
// node scripts/render-skins.js --pack <slug> [--version 1.2 | --all] [--view <name>] [--force]
// --view is saved in pack.json (with --version only for that version); see tools/skin-render/views.json.
const argv = process.argv.slice(2);
const slug = arg(argv, '--pack');
if (!slug) throw new Error('Usage: node scripts/render-skins.js --pack <slug> [--version <v> | --all] [--view <name>] [--force]');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const defaultView = config.skinRender?.defaultView || 'editor';
const background = config.skinRender?.background;
const pack = loadPack(slug);
const dir = packDir(slug);
const wanted = arg(argv, '--version');
const chosen = arg(argv, '--view');
if (chosen) resolveView(chosen); // fails early with the list of valid views

const targets = flag(argv, '--all') ? pack.versions
  : wanted ? pack.versions.filter(v => v.version === wanted)
  : pack.versions.filter(v => v.status === 'due').slice(0, 1);
if (!targets.length) throw new Error(`Nothing to render for ${slug}${wanted ? ` version ${wanted}` : ''}`);

if (chosen) {
  if (wanted) targets[0].view = chosen;
  else { pack.view = chosen; for (const v of targets) delete v.view; }
}

const renderer = await openRenderer();
try {
  for (const v of targets) {
    const rowRel = `media/v${v.version}-skins.png`;
    if (!chosen && !flag(argv, '--force') && fs.existsSync(path.join(dir, rowRel))) { console.log(`skip ${rowRel} (exists)`); continue; }
    const view = viewFor(pack, v, defaultView);
    const skins = v.skins.map(s => ({ ...s, png: fs.readFileSync(path.join(dir, 'skins', v.version, s.file)) }));
    const renders = [];
    for (const s of skins) renders.push(await renderer.render(s, view));
    fs.mkdirSync(path.join(dir, 'media', `v${v.version}`), { recursive: true });
    for (let i = 0; i < renders.length; i++) fs.writeFileSync(path.join(dir, 'media', `v${v.version}`, skins[i].file), await flatten(renders[i], background));
    fs.writeFileSync(path.join(dir, rowRel), await composeRow(renders, { background }));
    v.media = [rowRel];
    console.log(`Rendered V${v.version}: ${skins.length} skins, view "${view}" → ${rowRel}`);
  }
} finally {
  await renderer.close();
}
savePack(pack);
