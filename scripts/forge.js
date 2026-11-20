import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import { loadPack, savePack, packDir } from './lib/skinpacks.js';
import { slugify } from './lib/naming.js';
import { Skin } from '../tools/skin-forge/skin.js';
import { glow } from '../tools/skin-forge/glow.js';
import { human, PATTERNS, palette } from '../tools/skin-forge/human.js';
import * as color from '../tools/skin-forge/color.js';
import { validate, structure, distinct } from '../tools/skin-forge/validate.js';
import { arg, flag } from './lib/github-output.js';

// Builds new skins for a pack from its design file tools/skin-forge/packs/<slug>.js, checks them
// against the operator's skin rules and records them as due versions (V1.x after the last real one).
//   npm run forge -- --pack <slug> [--no-render] [--force]
// A design file exports { style, minDistinct?, updates: [{ title, note, skins: [{ name, story, slim?, build }] }] }
// build(kit) returns a Skin; kit = { Skin, glow, human, color, PATTERNS, palette, existing(name) }.
// Re-running replaces the versions this script made before (marked forged: true); real versions stay.
const argv = process.argv.slice(2);
const slug = arg(argv, '--pack');
if (!slug) throw new Error('Usage: npm run forge -- --pack <slug> [--no-render] [--force]');
const designFile = path.resolve('tools/skin-forge/packs', `${slug}.js`);
if (!fs.existsSync(designFile)) throw new Error(`No design file ${path.relative(process.cwd(), designFile)}`);
const design = (await import(pathToFileURL(designFile).href + `?t=${Date.now()}`)).default;

const pack = loadPack(slug);
const dir = packDir(slug);
const minor = v => Number(String(v).split('.')[1]);

// Drop earlier forged versions (files included), keep the real ones.
for (const v of pack.versions.filter(v => v.forged)) {
  for (const sub of ['skins', 'media']) fs.rmSync(path.join(dir, sub, sub === 'skins' ? v.version : `v${v.version}`), { recursive: true, force: true });
  fs.rmSync(path.join(dir, 'media', `v${v.version}-skins.png`), { force: true });
}
pack.versions = pack.versions.filter(v => !v.forged);
let next = Math.max(...pack.versions.map(v => minor(v.version))) + 1;

// Existing skins: for the distinctness check and as material (kit.existing).
const existing = [];
for (const v of pack.versions) for (const s of v.skins) {
  const file = path.join(dir, 'skins', v.version, s.file);
  if (fs.existsSync(file)) existing.push({ name: s.name, skin: await Skin.fromPng(fs.readFileSync(file), { slim: s.slim }) });
}
const kit = {
  Skin, glow, human, color, PATTERNS, palette,
  existing: name => { const e = existing.find(x => x.name.toLowerCase() === String(name).toLowerCase()); if (!e) throw new Error(`No existing skin "${name}" in ${slug}`); return e.skin.clone(); }
};

const minDistinct = design.minDistinct ?? 3;
const compared = existing.map(e => ({ name: e.name, sig: structure(e.skin) }));
const report = { pack: slug, style: design.style, at: new Date().toISOString(), versions: [] };
let failures = 0;

for (const u of design.updates) {
  const version = `1.${next++}`;
  const vdir = path.join(dir, 'skins', version);
  fs.mkdirSync(vdir, { recursive: true });
  const skins = [], rep = { version, title: u.title, skins: [] };
  for (const d of u.skins) {
    const skin = await d.build(kit);
    if (!(skin instanceof Skin)) throw new Error(`${d.name}: build() must return a Skin`);
    const style = d.style || design.style;
    const v = validate(skin, { style });
    const sig = structure(skin);
    const closest = compared.map(c => ({ name: c.name, ...distinct(sig, c.sig) })).sort((a, b) => a.differs - b.differs)[0];
    const errors = [...v.errors];
    if (closest && closest.differs < minDistinct) errors.push(`too close to "${closest.name}" (differs in ${closest.differs} of 6: ${JSON.stringify(closest.details)})`);
    if (errors.length) failures++;
    compared.push({ name: d.name, sig });
    const file = `${slugify(d.name).replace(/-/g, '_') || 'skin'}.png`;
    fs.writeFileSync(path.join(vdir, file), await skin.png());
    skins.push({ file, name: d.name, slim: !!(d.slim ?? skin.slim), story: d.story });
    rep.skins.push({ name: d.name, ok: errors.length === 0, errors, warnings: v.warnings, closest: closest ? `${closest.name} (${closest.differs}/6)` : null,
      black: +v.stats.black.toFixed(2), neon: +v.stats.neon.toFixed(3), overlayTransparent: +v.stats.overlayTransparent.toFixed(2) });
    console.log(`${errors.length ? '✗' : '✓'} V${version} ${d.name}${errors.length ? ` — ${errors.join('; ')}` : ''}${v.warnings.length ? ` (${v.warnings.join('; ')})` : ''}`);
  }
  pack.versions.push({ stage: `F${pack.versions.filter(x => x.forged).length + 1}`, version, title: u.title || '', skins, mcpack: null, status: 'due', note: u.note || '', media: [], fileId: null, publishedAt: null, forged: true });
  report.versions.push(rep);
}

savePack(pack);
fs.writeFileSync(path.join(dir, 'forge-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${slug}: ${design.updates.length} versions, ${report.versions.reduce((n, v) => n + v.skins.length, 0)} skins, ${failures} with problems`);

if (!flag(argv, '--no-render')) {
  for (const v of pack.versions.filter(v => v.forged)) {
    const r = spawnSync(process.execPath, ['scripts/render-skins.js', '--pack', slug, '--version', v.version, '--force'], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`render failed for V${v.version}`);
  }
}
if (failures && !flag(argv, '--force')) { console.error(`✗ ${failures} skin(s) break the rules — fix the design or pass --force`); process.exit(1); }
