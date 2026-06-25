import { fal } from '@fal-ai/client';
import fs from 'fs';
import https from 'https';
import http from 'http';

fal.config({ credentials: process.env.FAL_API_KEY });

const mod = JSON.parse(fs.readFileSync('./generated-mod.json', 'utf-8'));
fs.mkdirSync('./images', { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function generate(prompt, size, filename) {
  const result = await fal.subscribe('fal-ai/flux/dev', {
    input: { prompt, image_size: size, num_images: 1, num_inference_steps: 28, guidance_scale: 3.5 }
  });
  const url = result.data.images[0].url;
  await download(url, `./images/${filename}`);
  console.log(`Generated: ${filename}`);
}

await generate(
  `${mod.imagePrompt}, minecraft mod icon, pixel art style, vibrant colors, dark background, no text, square`,
  'square_hd',
  'icon.png'
);
await generate(
  `minecraft gameplay screenshot, ${mod.description}, fantasy environment, high quality, detailed, 16:9 aspect ratio`,
  'landscape_16_9',
  'screenshot1.png'
);
await generate(
  `minecraft user interface, ${mod.name} mod feature in action, clean HUD, inventory screen, game UI, 16:9`,
  'landscape_16_9',
  'screenshot2.png'
);

console.log('All images generated in ./images/');
