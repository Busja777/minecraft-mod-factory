import fs from 'fs';
import path from 'path';
import { generateImage, toLogo, toCover } from './lib/images.js';
import { logoFileName, coverFileName } from './lib/naming.js';
import { loadMod, saveMod, modDir } from './lib/mods.js';
import { loadPack, savePack, packDir } from './lib/skinpacks.js';
import { arg, flag } from './lib/github-output.js';

// Logo "<Name>.png" (400x400) and cover "<Name> Cover.png" (720x340) via ChatGPT.
// node scripts/build-images.js --mod <modId> | --skinpack <slug> [--force]
// Skin packs pass their real skin renders as references so the cover shows the actual characters.
const argv = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const img = config.images || {};
const model = img.model;
const coverSize = img.coverSize || [720, 340];
const force = flag(argv, '--force');

async function build({ dir, name, logoPrompt, coverPrompt, references = [] }) {
  const logoPath = path.join(dir, logoFileName(name));
  const coverPath = path.join(dir, coverFileName(name));
  if (!force && fs.existsSync(logoPath) && fs.existsSync(coverPath)) {
    console.log(`Images exist for ${name} (use --force to regenerate)`);
    return { logoFile: path.basename(logoPath), coverFile: path.basename(coverPath) };
  }
  const style = 'Minecraft-inspired blocky voxel art, high detail, vibrant glow, dark moody background';
  const logo = await generateImage({ model, size: '1024x1024', references,
    prompt: `${logoPrompt}. ${style}. Square game logo, one centred subject, absolutely no text or letters.` });
  fs.writeFileSync(logoPath, await toLogo(logo, img.logoSize || 400));
  console.log(`Generated: ${path.basename(logoPath)}`);

  const cover = await generateImage({ model, size: '1536x1024', references,
    prompt: `${coverPrompt}. ${style}. Wide banner composition, keep all important content inside the central horizontal band (it is cropped to ${coverSize[0]}x${coverSize[1]}). Title text exactly: "${name}".` });
  fs.writeFileSync(coverPath, await toCover(cover, coverSize));
  console.log(`Generated: ${path.basename(coverPath)}`);
  return { logoFile: path.basename(logoPath), coverFile: path.basename(coverPath) };
}

const modId = arg(argv, '--mod');
const slug = arg(argv, '--skinpack');
if (modId) {
  const { meta } = loadMod(modId);
  const files = await build({
    dir: modDir(modId), name: meta.name,
    logoPrompt: meta.imagePrompt || `Icon for the Minecraft mod ${meta.name}: ${meta.description}`,
    coverPrompt: meta.coverPrompt || `Key art for the Minecraft mod ${meta.name}: ${meta.description}`
  });
  saveMod(modId, { meta: { ...meta, ...files } });
} else if (slug) {
  const pack = loadPack(slug);
  if (!pack.logoPrompt || !pack.coverPrompt) throw new Error(`Run skin-meta.js --pack ${slug} first (prompts missing)`);
  const dir = packDir(slug);
  const base = pack.versions[0];
  const references = base.skins.slice(0, 3)
    .map(s => path.join(dir, 'media', `v${base.version}`, s.file)).filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f));
  if (!references.length) console.log('::warning::No skin renders found — cover is generated without references (run render-skins.js first)');
  Object.assign(pack, await build({ dir, name: pack.name, logoPrompt: pack.logoPrompt, coverPrompt: pack.coverPrompt, references }));
  savePack(pack);
} else {
  throw new Error('Usage: node scripts/build-images.js --mod <modId> | --skinpack <slug> [--force]');
}
