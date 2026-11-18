// Prints tools/guide-pdf/guide.html to Macros/ANLEITUNG.pdf (A4) with the Chromium that the
// skin renderer already uses.   npm run guide   [-- --out <file.pdf>]
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '../..');
export const SOURCE = path.join(here, 'guide.html');

// Repo paths the guide points at (data-path attributes) and npm scripts it tells the reader to run.
export function references(html) {
  return {
    paths: [...new Set([...html.matchAll(/data-path="([^"]+)"/g)].map(m => m[1]))],
    scripts: [...new Set([...html.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)].map(m => m[1]))]
  };
}

async function launch() {
  try { return await chromium.launch(); } catch { return chromium.launch({ channel: 'chrome' }); }
}

export async function build(out = path.join(REPO, 'Macros', 'ANLEITUNG.pdf')) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(SOURCE).href);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const out = await build(i > 0 ? path.resolve(process.argv[i + 1]) : undefined);
  console.log(`✓ ${path.relative(process.cwd(), out)}`);
}
