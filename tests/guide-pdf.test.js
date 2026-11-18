import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { REPO, SOURCE, references } from '../tools/guide-pdf/build.js';
import { buildMacroBundle } from '../scripts/lib/macro-bundle.js';

const html = fs.readFileSync(SOURCE, 'utf-8');
const refs = references(html);

test('every repo path the guide points at exists', () => {
  assert.ok(refs.paths.length >= 5);
  for (const p of refs.paths) assert.ok(fs.existsSync(path.join(REPO, p)), `guide mentions missing path ${p}`);
});

test('every npm script the guide tells the reader to run exists', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')).scripts;
  assert.ok(refs.scripts.includes('cf') && refs.scripts.includes('macro') && refs.scripts.includes('studio'));
  for (const s of refs.scripts) assert.ok(scripts[s], `guide mentions unknown script "npm run ${s}"`);
});

test('the hand-over files named in the guide are the ones npm run macro writes', () => {
  const config = JSON.parse(fs.readFileSync(path.join(REPO, 'config.json'), 'utf-8'));
  const pack = {
    slug: 'p', name: 'P', packName: 'P', summary: 's', legend: 'l', altNames: [], logoFile: 'P.png', coverFile: 'P Cover.png',
    versions: [
      { version: '1.0', status: 'published', mcpack: 'A.mcpack', skins: [{ name: 'A' }], media: ['media/v1.0-skins.png'], note: 'n' },
      { version: '1.1', status: 'due', mcpack: 'B.mcpack', skins: [{ name: 'B' }], media: ['media/v1.1-skins.png'], note: 'n', changelog: '## V1.1' }
    ]
  };
  const written = new Set();
  for (const mode of ['new', 'update']) {
    const opts = mode === 'update' ? { version: '1.1' } : {};
    for (const f of buildMacroBundle({ kind: 'skinpack', mode, pack, config, outDir: '/x/Macros/aktuell', ...opts }).entries) written.add(f.name);
  }
  const named = [...html.matchAll(/<code>([a-z-]+\.(?:txt|md))<\/code>/g)].map(m => m[1]);
  assert.ok(named.includes('datei-pfad.txt') && named.includes('beschreibungs-abschnitt.md'));
  for (const n of new Set(named)) assert.ok(written.has(n) || n === 'CHECKLISTE.md', `guide names ${n}, but npm run macro does not write it`);
});

test('the guide keeps the three safety rules', () => {
  for (const s of ['Den letzten Klick machst du', 'Login, Captcha und 2FA löst immer du', 'Ein Projekt pro Lauf']) assert.ok(html.includes(s), s);
});
