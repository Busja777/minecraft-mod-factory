import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';

// ChatGPT image generation (OpenAI Images API). Logos and covers are fully AI-generated; the
// description carries the AI disclaimer (CurseForge allows "on the image or in the description").
export const DEFAULT_MODEL = 'gpt-image-2.5-flare';

let client;
const getClient = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// references: PNG buffers (e.g. real skin renders) the image must stay faithful to.
export async function generateImage({ prompt, size = '1024x1024', references = [], model = DEFAULT_MODEL, openai = getClient() }) {
  if (!process.env.OPENAI_API_KEY && openai === client) throw new Error('OPENAI_API_KEY is missing');
  const common = { model, prompt, size, quality: 'high', n: 1 };
  const res = references.length
    ? await openai.images.edit({ ...common, image: await Promise.all(references.map((b, i) => toFile(b, `reference-${i + 1}.png`, { type: 'image/png' }))) })
    : await openai.images.generate(common);
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');
  return Buffer.from(b64, 'base64');
}

// CurseForge rejects logos that are a solid colour or a plain gradient.
export async function assertNotFlat(buf, minStdev = 18) {
  const { channels } = await sharp(buf).stats();
  const stdev = Math.max(...channels.slice(0, 3).map(c => c.stdev));
  if (stdev < minStdev) throw new Error(`Logo looks like a flat colour or gradient (stdev ${stdev.toFixed(1)})`);
  return stdev;
}

export async function toLogo(buf, size = 400) {
  const out = await sharp(buf).resize(size, size, { fit: 'cover' }).png().toBuffer();
  await assertNotFlat(out);
  return out;
}

export async function toCover(buf, [width, height] = [720, 340]) {
  return sharp(buf).resize(width, height, { fit: 'cover', position: 'attention' }).png().toBuffer();
}
