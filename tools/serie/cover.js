// Renders the title image of a series project: logo, name, one line of benefit, three bullets.
// A designed graphic, not a game screenshot. HTML → PNG (1280×720) with the Chromium that the
// guide and the skin renderer already use.
import fs from 'fs';
import { chromium } from 'playwright-core';

export const SIZE = [1280, 720];

// One look per row, so a row's pages belong together.
export const THEMES = {
  wow: {
    kicker: 'World of Warcraft addon',
    font: `'Cochin', 'Palatino', 'Georgia', serif`, body: `'Avenir Next', 'Helvetica Neue', sans-serif`,
    bg: 'radial-gradient(120% 90% at 18% 40%, #3b2a14 0%, #1a1410 46%, #0c0a09 100%)',
    ink: '#f6e7c1', soft: '#c9b48a', accent: '#f2b632', frame: '#8a6a2a', weight: 700
  },
  java: {
    kicker: 'For Minecraft: Java Edition',
    font: `'Avenir Next', 'Helvetica Neue', sans-serif`, body: `'Avenir Next', 'Helvetica Neue', sans-serif`,
    bg: 'linear-gradient(135deg, #0f2a1f 0%, #10231c 45%, #0a1512 100%)',
    ink: '#eafff2', soft: '#9fc7b0', accent: '#5fe08a', frame: '#2f7a4f', weight: 800
  },
  stardew: {
    kicker: 'For Stardew Valley',
    font: `'Georgia', 'Palatino', serif`, body: `'Avenir Next', 'Helvetica Neue', sans-serif`,
    bg: 'linear-gradient(160deg, #fbe9c2 0%, #f3d596 55%, #e9bd72 100%)',
    ink: '#4a2a12', soft: '#7a5230', accent: '#3f8f3f', frame: '#b98545', weight: 700
  },
  bedrock: {
    kicker: 'For Minecraft: Bedrock Edition',
    font: `'Avenir Next', 'Helvetica Neue', sans-serif`, body: `'Avenir Next', 'Helvetica Neue', sans-serif`,
    bg: 'linear-gradient(135deg, #0d2433 0%, #0f1d2a 45%, #08121a 100%)',
    ink: '#e8f6ff', soft: '#9cc3d8', accent: '#4fc3f7', frame: '#2a6f8f', weight: 800
  },
  sims4: {
    kicker: 'For The Sims 4 · base game compatible',
    font: `'Avenir Next', 'Helvetica Neue', sans-serif`, body: `'Avenir Next', 'Helvetica Neue', sans-serif`,
    bg: 'linear-gradient(140deg, #f4fbff 0%, #d9f3ee 55%, #c3ead9 100%)',
    ink: '#12333a', soft: '#3d6a70', accent: '#16a47a', frame: '#8fd3c0', weight: 700
  }
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function coverHtml({ reihe, name, tagline, bullets, kicker, logo }) {
  const t = THEMES[reihe];
  if (!t) throw new Error(`No cover theme for "${reihe}"`);
  if (!tagline || !Array.isArray(bullets) || bullets.length !== 3) throw new Error(`Cover of ${name} needs a tagline and exactly three bullets`);
  const nameSize = name.length <= 12 ? 104 : name.length <= 18 ? 86 : name.length <= 24 ? 70 : 60;
  const logoUri = `data:image/png;base64,${logo.toString('base64')}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${SIZE[0]}px; height: ${SIZE[1]}px; }
  body { background: ${t.bg}; color: ${t.ink}; font-family: ${t.body}; display: flex; align-items: center; gap: 64px; padding: 0 76px; overflow: hidden; position: relative; }
  body::before { content: ''; position: absolute; inset: 22px; border: 2px solid ${t.frame}; border-radius: 30px; opacity: .55; }
  body::after { content: ''; position: absolute; right: -260px; top: -260px; width: 820px; height: 820px; border-radius: 50%; background: radial-gradient(closest-side, ${t.accent} 0%, transparent 100%); opacity: .16; }
  .logo { flex: none; width: 400px; height: 400px; border-radius: 56px; background: center/cover url('${logoUri}'); box-shadow: 0 30px 70px rgba(0,0,0,.38), 0 0 0 6px ${t.frame}; position: relative; z-index: 1; }
  .text { flex: 1; min-width: 0; position: relative; z-index: 1; }
  .kicker { font-size: 24px; letter-spacing: .14em; text-transform: uppercase; color: ${t.accent}; font-weight: 700; margin-bottom: 16px; }
  h1 { font-family: ${t.font}; font-weight: ${t.weight}; font-size: ${nameSize}px; line-height: 1.02; letter-spacing: -.01em; margin-bottom: 20px; }
  .tagline { font-size: 34px; line-height: 1.25; color: ${t.soft}; margin-bottom: 34px; font-weight: 500; }
  ul { list-style: none; display: grid; gap: 16px; }
  li { font-size: 30px; line-height: 1.2; display: flex; align-items: center; gap: 18px; font-weight: 600; }
  li::before { content: ''; flex: none; width: 16px; height: 16px; border-radius: 4px; background: ${t.accent}; transform: rotate(45deg); }
</style></head><body>
  <div class="logo"></div>
  <div class="text">
    <div class="kicker">${esc(kicker || t.kicker)}</div>
    <h1>${esc(name)}</h1>
    <div class="tagline">${esc(tagline)}</div>
    <ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
  </div>
</body></html>`;
}

async function launch() {
  try { return await chromium.launch(); } catch { return chromium.launch({ channel: 'chrome' }); }
}

// → PNG buffer, exactly 1280×720
export async function renderCover(options) {
  const html = coverHtml(options);
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] }, deviceScaleFactor: 1 });
    await page.setContent(html);
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

export async function writeCover(options, file) {
  fs.writeFileSync(file, await renderCover(options));
  return file;
}

// ── Banner: 720×340, the wide image of the gallery ────────────────────────────────────────────
// Same look as the title image, cut down to what reads at this size: logo, row, name, one line.
export const BANNER_SIZE = [720, 340];

export function bannerHtml({ reihe, name, tagline, kicker, logo }) {
  const t = THEMES[reihe];
  if (!t) throw new Error(`No banner theme for "${reihe}"`);
  if (!tagline) throw new Error(`Banner of ${name} needs a tagline`);
  const [w, h] = BANNER_SIZE;
  const nameSize = name.length <= 12 ? 56 : name.length <= 18 ? 46 : name.length <= 24 ? 38 : 33;
  const logoUri = `data:image/png;base64,${logo.toString('base64')}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; }
  body { background: ${t.bg}; color: ${t.ink}; font-family: ${t.body}; display: flex; align-items: center; gap: 34px; padding: 0 40px; overflow: hidden; position: relative; }
  body::before { content: ''; position: absolute; inset: 12px; border: 1.5px solid ${t.frame}; border-radius: 18px; opacity: .55; }
  body::after { content: ''; position: absolute; right: -150px; top: -170px; width: 460px; height: 460px; border-radius: 50%; background: radial-gradient(closest-side, ${t.accent} 0%, transparent 100%); opacity: .18; }
  .logo { flex: none; width: 240px; height: 240px; border-radius: 34px; background: center/cover url('${logoUri}'); box-shadow: 0 16px 36px rgba(0,0,0,.36), 0 0 0 4px ${t.frame}; position: relative; z-index: 1; }
  .text { flex: 1; min-width: 0; position: relative; z-index: 1; }
  .kicker { font-size: 13px; letter-spacing: .16em; text-transform: uppercase; color: ${t.accent}; font-weight: 700; margin-bottom: 10px; }
  h1 { font-family: ${t.font}; font-weight: ${t.weight}; font-size: ${nameSize}px; line-height: 1.02; letter-spacing: -.01em; margin-bottom: 14px; text-wrap: balance; }
  .tagline { font-size: 19px; line-height: 1.3; color: ${t.soft}; font-weight: 500; }
</style></head><body>
  <div class="logo"></div>
  <div class="text">
    <div class="kicker">${esc(kicker || t.kicker)}</div>
    <h1>${esc(name)}</h1>
    <div class="tagline">${esc(tagline)}</div>
  </div>
</body></html>`;
}

// → PNG buffer, exactly 720×340. Rendered at twice the size and scaled down, so the type stays sharp.
export async function renderBanner(options) {
  const { default: sharp } = await import('sharp');
  const [w, h] = BANNER_SIZE;
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await page.setContent(bannerHtml(options));
    const big = await page.screenshot({ type: 'png' });
    return await sharp(big).resize(w, h).png().toBuffer();
  } finally {
    await browser.close();
  }
}

export async function writeBanner(options, file) {
  fs.writeFileSync(file, await renderBanner(options));
  return file;
}
