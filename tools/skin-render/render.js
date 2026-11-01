import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

// Headless skin renders with three.js in Chromium.
//   renderSkins([{ png: Buffer, slim }]) → [Buffer] single renders (transparent, 578x967)
//   composeRow(renders, { cellHeight, background }) → Buffer row image on a dark background
const here = path.dirname(fileURLToPath(import.meta.url));
const threeDir = path.join(here, '..', '..', 'node_modules', 'three', 'build');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url === '/' ? path.join(here, 'page.html')
      : url.startsWith('/three/') ? path.join(threeDir, path.basename(url))
      : path.join(here, path.basename(url));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function launch() {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args });
  try { return await chromium.launch({ args }); }
  catch (e) {
    try { return await chromium.launch({ channel: 'chrome', args }); }
    catch { throw new Error(`No Chromium for skin renders. Run: node node_modules/playwright-core/cli.js install chromium\n${e.message}`); }
  }
}

export async function renderSkins(skins, { width = 578, height = 967, yaw, background = null } = {}) {
  const server = await serve();
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.rendererReady === true, null, { timeout: 15000 })
      .catch(() => { throw new Error(`Renderer page failed: ${errors.join('; ') || 'timeout'}`); });
    const out = [];
    for (const s of skins) {
      const meta = await sharp(s.png).metadata();
      if (meta.width !== 64 || meta.height !== 64) throw new Error(`Skin is ${meta.width}x${meta.height}, expected 64x64`);
      const dataUrl = `data:image/png;base64,${s.png.toString('base64')}`;
      const result = await page.evaluate(([u, o]) => window.renderSkin(u, o), [dataUrl, { width, height, slim: !!s.slim, yaw, background }]);
      out.push(Buffer.from(result.split(',')[1], 'base64'));
    }
    return out;
  } finally {
    await browser.close();
    server.close();
  }
}

// Row of renders like the user's description images: dark background, skins side by side.
export async function composeRow(renders, { cellHeight = 340, gap = 56, pad = 26, background = "#111111" } = {}) {
  const cells = await Promise.all(renders.map(async r => {
    const trimmed = await sharp(r).trim({ threshold: 1 }).toBuffer();
    return sharp(trimmed).resize({ height: cellHeight - 2 * pad }).toBuffer({ resolveWithObject: true });
  }));
  const width = cells.reduce((w, c) => w + c.info.width, 0) + gap * (cells.length - 1) + 2 * pad * 2;
  let x = pad * 2;
  const composites = cells.map(c => { const top = pad; const left = x; x += c.info.width + gap; return { input: c.data, top, left }; });
  return sharp({ create: { width, height: cellHeight, channels: 4, background } }).composite(composites).png().toBuffer();
}
