import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { buildMcpack } from '../../scripts/lib/mcpack.js';

// Baut ein Test-Repo in einem Temp-Ordner: config.json, leere cf-projects.json und ein neues
// Skinpack „Neon Ninja“ (ohne Projekt-ID) mit Logo, Cover, Skins, Renders und .mcpack.
// opts.logoSize: falsche Größe für Prüf-Tests.
const noise = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#335' } })
  .composite([{ input: Buffer.from(Array.from({ length: 16 * 16 * 3 }, (_, i) => (i * 97) % 256)), raw: { width: 16, height: 16, channels: 3 }, tile: true }])
  .png().toBuffer();

export async function makeStudioRepo({ logoSize = 400 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-'));
  const repoConfig = JSON.parse(fs.readFileSync(new URL('../../config.json', import.meta.url), 'utf-8'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify(repoConfig, null, 2));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'cf-projects.json'), '[]\n');
  const dir = path.join(root, 'data', 'skins', 'neon-ninja');
  for (const d of ['skins/1.0', 'media/v1.0', 'mcpack']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const skin = await noise(64, 64);
  fs.writeFileSync(path.join(dir, 'skins/1.0/aka.png'), skin);
  fs.writeFileSync(path.join(dir, 'skins/1.0/ao.png'), skin);
  fs.writeFileSync(path.join(dir, 'media/v1.0/aka.png'), await noise(270, 300));
  fs.writeFileSync(path.join(dir, 'media/v1.0/ao.png'), await noise(270, 300));
  fs.writeFileSync(path.join(dir, 'media/v1.0-skins.png'), await noise(540, 300));
  fs.writeFileSync(path.join(dir, 'Neon Ninja.png'), await noise(logoSize, logoSize));
  fs.writeFileSync(path.join(dir, 'Neon Ninja Cover.png'), await noise(720, 340));
  fs.writeFileSync(path.join(dir, 'mcpack/Neon_Ninja.mcpack'), buildMcpack({ packName: 'Neon Ninja', description: 'Glowing ninjas.', skins: [{ name: 'AKA — Red', png: skin }, { name: 'AO — Blue', png: skin }] }));
  const pack = {
    slug: 'neon-ninja', name: 'Neon Ninja', packName: 'Neon Ninja', summary: 'Two glowing ninjas for the night.', legend: 'In the dark, two blades glow.',
    logoFile: 'Neon Ninja.png', coverFile: 'Neon Ninja Cover.png',
    versions: [{ stage: 'V1', version: '1.0', title: 'First Light', status: 'due', mcpack: 'Neon_Ninja.mcpack', note: 'Two ninjas.',
      skins: [{ file: 'aka.png', name: 'AKA — Red', slim: false }, { file: 'ao.png', name: 'AO — Blue', slim: false }], media: ['media/v1.0-skins.png'] }]
  };
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(pack, null, 2));
  return { root, dir, config: repoConfig };
}
