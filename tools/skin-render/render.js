import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
import { resolveView, BACKGROUND } from './views.js';

// Headless skin renders with three.js in Chromium, matching the skin editor's 3D preview.
//   renderSkins([{ png: Buffer, slim }], { view }) → [Buffer] transparent renders (1080x1200)
//   flatten(render) → render on the editor background #252538
//   composeRow(renders) → all skins side by side at the same scale on #252538
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

// One browser session for many renders: const r = await openRenderer(); await r.render(skin, view); await r.close();
export async function openRenderer({ width = 540, height = 600, pixelRatio = 2 } = {}) {
  const server = await serve();
  const browser = await launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const close = async () => { await browser.close(); server.close(); };
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.rendererReady === true, null, { timeout: 15000 });
  } catch {
    await close();
    throw new Error(`Renderer page failed: ${errors.join('; ') || 'timeout'}`);
  }
  async function render(skin, view = 'editor') {
    const v = typeof view === 'string' ? resolveView(view) : view;
    const meta = await sharp(skin.png).metadata();
    if (meta.width !== 64 || meta.height !== 64) throw new Error(`Skin is ${meta.width}x${meta.height}, expected 64x64`);
    const dataUrl = `data:image/png;base64,${skin.png.toString('base64')}`;
    const opts = { width, height, pixelRatio, slim: !!skin.slim, pose: v.pose, azimuth: v.azimuth, elevation: v.elevation, distance: v.distance || 40 };
    const result = await page.evaluate(([u, o]) => window.renderSkin(u, o), [dataUrl, opts]);
    return Buffer.from(result.split(',')[1], 'base64');
  }
  return { render, close };
}

export async function renderSkins(skins, { view = 'editor', ...opts } = {}) {
  const r = await openRenderer(opts);
  try {
    const out = [];
    for (const s of skins) out.push(await r.render(s, view));
    return out;
  } finally {
    await r.close();
  }
}

export async function flatten(render, background = BACKGROUND) {
  return sharp(render).flatten({ background }).png().toBuffer();
}

// Union of the non-transparent areas, so every figure in a row keeps the same scale and baseline.
async function commonBox(renders) {
  let box = null;
  for (const r of renders) {
    const { info } = await sharp(r).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const left = -info.trimOffsetLeft, top = -info.trimOffsetTop;
    const b = { left, top, right: left + info.width, bottom: top + info.height };
    box = box ? { left: Math.min(box.left, b.left), top: Math.min(box.top, b.top), right: Math.max(box.right, b.right), bottom: Math.max(box.bottom, b.bottom) } : b;
  }
  return { left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top };
}

// Row like the user's description images: every skin in the same view, side by side.
export async function composeRow(renders, { cellHeight = 400, gap = 40, pad = 28, background = BACKGROUND } = {}) {
  const box = await commonBox(renders);
  const cells = await Promise.all(renders.map(r =>
    sharp(r).extract(box).resize({ height: cellHeight - 2 * pad }).toBuffer({ resolveWithObject: true })));
  const width = cells.reduce((w, c) => w + c.info.width, 0) + gap * (cells.length - 1) + 4 * pad;
  let x = 2 * pad;
  const composites = cells.map(c => { const left = x; x += c.info.width + gap; return { input: c.data, top: pad, left }; });
  return sharp({ create: { width, height: cellHeight, channels: 4, background } }).composite(composites).png().toBuffer();
}
