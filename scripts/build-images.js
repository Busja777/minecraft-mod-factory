import { fal } from '@fal-ai/client';
import fs from 'fs';
import sharp from 'sharp';

// Generates the 400x400 project icon (always) and, only when Modrinth is enabled,
// two showcase screenshots. CurseForge's upload API cannot take images, so the icon
// is stored in the kit for the manual project creation step.
fal.config({ credentials: process.env.FAL_API_KEY });
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const platforms = (process.env.PLATFORMS || (config.platforms || ['curseforge']).join(',')).split(',').map(s => s.trim());
const mod = JSON.parse(fs.readFileSync('./generated-mod.json', 'utf-8'));
fs.mkdirSync('./images', { recursive: true });

async function generate(prompt, size) {
  const result = await fal.subscribe('fal-ai/flux/dev', {
    input: { prompt, image_size: size, num_images: 1, num_inference_steps: 28, guidance_scale: 3.5 }
  });
  const res = await fetch(result.data.images[0].url);
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

const iconRaw = await generate(
  `${mod.imagePrompt}, minecraft mod icon, pixel art style, vibrant colors, dark background, no text, no letters, centered subject, square`,
  'square_hd'
);
await sharp(iconRaw).resize(400, 400, { fit: 'cover' }).png().toFile('./images/icon.png');
console.log('Generated: icon.png (400x400)');

if (platforms.includes('modrinth')) {
  fs.writeFileSync('./images/screenshot1.png', await generate(`minecraft gameplay screenshot, ${mod.description}, fantasy environment, high quality, detailed, 16:9 aspect ratio`, 'landscape_16_9'));
  fs.writeFileSync('./images/screenshot2.png', await generate(`minecraft user interface, ${mod.name} mod feature in action, clean HUD, game UI, 16:9`, 'landscape_16_9'));
  console.log('Generated: screenshot1.png, screenshot2.png');
} else {
  console.log('Screenshots skipped (Modrinth disabled)');
}
