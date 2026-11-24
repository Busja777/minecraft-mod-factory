// Gallery image from real in-game screenshots: one caption line and one or more crops of the
// operator's own screenshots, unchanged apart from scaling. Nothing is drawn into the game image;
// the card only frames it, so the gallery shows what really ran in the game.
// → tools/<reihe>/projects/<slug>/shots/*.png, which `serie seite` copies to shot-N.png.
import fs from 'fs';
import { chromium } from 'playwright-core';
import { THEMES } from './cover.js';

export const SHOT_SIZE = [1280, 720];
const AREA = [1160, 540]; // room for the crops below the caption
const GAP = 28;
const MAX_SCALE = 2; // small chat lines get bigger, but not blurry

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One scale for all crops, so text keeps the same size across them. sizes: [[w, h], …]
export function fitScale(sizes, stack = false) {
  if (!sizes.length) throw new Error('A shot card needs at least one image');
  const gaps = GAP * (sizes.length - 1);
  const along = stack ? sizes.reduce((s, [, h]) => s + h, 0) : sizes.reduce((s, [w]) => s + w, 0);
  const across = stack ? Math.max(...sizes.map(([w]) => w)) : Math.max(...sizes.map(([, h]) => h));
  const [roomAlong, roomAcross] = stack ? [AREA[1], AREA[0]] : AREA;
  return Math.min(MAX_SCALE, (roomAlong - gaps) / along, roomAcross / across);
}

// images: [{ uri, width, height }] at their final pixel size
export function shotCardHtml({ reihe, caption, kicker, images, stack = false }) {
  const t = THEMES[reihe];
  if (!t) throw new Error(`No theme for "${reihe}"`);
  if (!caption || !String(caption).trim()) throw new Error('A shot card needs a caption');
  if (!images?.length) throw new Error('A shot card needs at least one image');
  const [w, h] = SHOT_SIZE;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; }
  body { background: ${t.bg}; color: ${t.ink}; font-family: ${t.body}; overflow: hidden; position: relative; display: flex; flex-direction: column; align-items: center; padding: 40px 60px 0; }
  body::before { content: ''; position: absolute; inset: 14px; border: 2px solid ${t.frame}; border-radius: 24px; opacity: .5; }
  .kicker { font-size: 17px; letter-spacing: .16em; text-transform: uppercase; color: ${t.accent}; font-weight: 700; margin-bottom: 8px; position: relative; }
  h1 { font-family: ${t.font}; font-weight: ${t.weight}; font-size: 38px; line-height: 1.15; text-align: center; position: relative; max-width: 1120px; }
  .shots { flex: 1; display: flex; flex-direction: ${stack ? 'column' : 'row'}; align-items: center; justify-content: center; gap: ${GAP}px; position: relative; padding-bottom: 24px; }
  img { display: block; border-radius: 6px; box-shadow: 0 18px 44px rgba(0,0,0,.55), 0 0 0 2px ${t.frame}; }
</style></head><body>
  <div class="kicker">${esc(kicker || 'In-game screenshot')}</div>
  <h1>${esc(caption)}</h1>
  <div class="shots">${images.map(i => `<img src="${i.uri}" width="${i.width}" height="${i.height}">`).join('')}</div>
</body></html>`;
}

// shots: [{ file, crop: [left, top, width, height] (optional) }] → PNG buffer, exactly 1280×720
export async function renderShotCard({ reihe, caption, kicker, shots, stack = false }) {
  const { default: sharp } = await import('sharp');
  const cropped = [];
  for (const s of shots) {
    let img = sharp(fs.readFileSync(s.file));
    if (s.crop) {
      const [left, top, width, height] = s.crop;
      img = img.extract({ left, top, width, height });
    }
    const buf = await img.png().toBuffer();
    const { width, height } = await sharp(buf).metadata();
    cropped.push({ buf, width, height });
  }
  const scale = fitScale(cropped.map(c => [c.width, c.height]), stack);
  const images = [];
  for (const c of cropped) {
    const width = Math.round(c.width * scale), height = Math.round(c.height * scale);
    const buf = await sharp(c.buf).resize(width, height, { kernel: 'lanczos3' }).png().toBuffer();
    images.push({ uri: `data:image/png;base64,${buf.toString('base64')}`, width, height });
  }
  let browser;
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  try {
    const page = await browser.newPage({ viewport: { width: SHOT_SIZE[0], height: SHOT_SIZE[1] }, deviceScaleFactor: 1 });
    await page.setContent(shotCardHtml({ reihe, caption, kicker, images, stack }));
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}
