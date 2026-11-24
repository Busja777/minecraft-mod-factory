import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { seoSlug, folderName, loadShotMeta, planUploadFolder, writeUploadFolder } from '../scripts/lib/upload-folder.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'upload-folder-'));
const png = (dir, name) => fs.writeFileSync(path.join(dir, name), 'png');

const reihe = { reihe: 'wow', title: 'World of Warcraft', banner: false };
const project = { nr: 1, slug: 'gold-diary' };
const page = { name: 'Gold Diary', summary: 'See where your gold goes.', category: 'Auction & Economy', description: '**Bold.**\n\n## Features\n- a' };
const release = { root: '/stock/gold-diary', versions: [
  { version: '1.0', file: 'GoldDiary-1.0.zip', changelog: '## Gold Diary 1.0\n\nFirst release.', gameVersions: ['12.1.5'] },
  { version: '1.2', file: 'GoldDiary-1.2.zip', changelog: 'x' }
] };

test('seoSlug: lowercase words joined by hyphens, no umlauts or symbols', () => {
  assert.equal(seoSlug('Auction & Economy'), 'auction-and-economy');
  assert.equal(seoSlug('  Größe: 1.2! '), 'grosse-1-2');
});

test('folderName: plan number first, so the folders sort in upload order', () => {
  assert.equal(folderName({ nr: 3 }, { name: 'Quest Autopilot' }), '03 Quest Autopilot');
  assert.equal(folderName({ nr: 12 }, { name: 'A/B: C' }), '12 A-B- C');
});

test('loadShotMeta: every image needs exactly one entry with a clean name', () => {
  const dir = tmp();
  png(dir, '01.png');
  assert.deepEqual(loadShotMeta(dir).map(m => m.name), ['01'], 'without shots.json the plain list');
  fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify([{ file: '01.png', name: 'gold-per-hour' }, { file: '02.png', name: 'x' }]));
  assert.throws(() => loadShotMeta(dir), /02\.png gibt es nicht/);
  fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify([{ file: '01.png', name: 'Gold per hour' }]));
  assert.throws(() => loadShotMeta(dir), /Kleinbuchstaben/);
  png(dir, '02.png');
  fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify([{ file: '01.png', name: 'a' }]));
  assert.throws(() => loadShotMeta(dir), /02\.png fehlt/);
});

test('planUploadFolder: first file, descriptive image names, later-version shots marked', () => {
  const shotDir = tmp();
  png(shotDir, '01.png'); png(shotDir, '02.png');
  fs.writeFileSync(path.join(shotDir, 'shots.json'), JSON.stringify([
    { file: '02.png', name: 'history-view', title: 'History', since: '1.2' },
    { file: '01.png', name: 'session-view', title: 'Session', since: '1.0' }
  ]));
  const plan = planUploadFolder({ reihe, project, page, pageDir: '/page', shotDir, release, gameVersionType: 'WoW Retail' });
  assert.equal(plan.folder, '01 Gold Diary');
  assert.deepEqual(plan.files.map(f => f.to), [
    'gold-diary-wow-addon-logo.png', 'gold-diary-wow-addon-cover.png',
    'gold-diary-session-view.png', 'gold-diary-history-view.png', 'GoldDiary-1.0.zip'
  ]);
  assert.equal(plan.files.find(f => f.to === 'GoldDiary-1.0.zip').from, path.join('/stock/gold-diary', 'files', 'GoldDiary-1.0.zip'));
  assert.equal(plan.files.find(f => f.to.includes('session')).since, null, 'the first file has it already');
  assert.equal(plan.files.find(f => f.to.includes('history')).since, '1.2');
  assert.match(plan.text, /Spielversion: 12\.1\.5 \(WoW Retail\)/);
  assert.match(plan.text, /First release\./);
  assert.match(plan.text, /Auction & Economy/);
  assert.match(plan.text, /ab Version 1\.2/);
  assert.match(plan.text, /npm run serie -- id gold-diary/);
  assert.doesNotMatch(plan.text, /banner/i, 'WoW has no banner');
});

test('planUploadFolder: with a banner it is the main image; without stock no file', () => {
  const plan = planUploadFolder({ reihe: { reihe: 'java', title: 'Minecraft Java' }, project: { nr: 2, slug: 'hush' }, page: { ...page, name: 'Hush' }, pageDir: '/p', shotDir: '/none', release: null });
  assert.deepEqual(plan.files.map(f => f.to), ['hush-minecraft-logo.png', 'hush-minecraft-banner.png', 'hush-minecraft-cover.png']);
  assert.match(plan.text, /hush-minecraft-banner\.png hochladen und als Hauptbild/);
  assert.match(plan.text, /Noch keine Datei im Vorrat/);
});

test('writeUploadFolder: fresh folder with all files and the text', () => {
  const src = tmp(), root = tmp();
  png(src, 'a.png');
  const plan = { folder: '01 Gold Diary', files: [{ from: path.join(src, 'a.png'), to: 'gold-diary-logo.png' }], text: 'Text' };
  fs.mkdirSync(path.join(root, plan.folder));
  fs.writeFileSync(path.join(root, plan.folder, 'old.png'), 'x');
  const dir = writeUploadFolder(plan, root);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['Gold Diary - Anleitung und Texte.txt', 'gold-diary-logo.png']);
  assert.throws(() => writeUploadFolder({ ...plan, files: [{ from: path.join(src, 'missing.png'), to: 'x.png' }] }, root), /fehlt/);
});

test('every shots.json in the repo matches its images', () => {
  for (const reiheDir of fs.readdirSync('./tools')) {
    const projects = path.join('./tools', reiheDir, 'projects');
    if (!fs.existsSync(projects)) continue;
    for (const slug of fs.readdirSync(projects)) loadShotMeta(path.join(projects, slug, 'shots'));
  }
});

test('categoryCheck: additional categories are real, few and not the main one', async () => {
  const { categoryCheck } = await import('../scripts/lib/page-check.js');
  const names = ['Mail', 'Audio & Video', 'PvP', 'Miscellaneous', 'Guild'];
  const base = { category: 'Mail' };
  assert.equal(categoryCheck({ ...base, additionalCategories: ['Audio & Video'] }, names).level, 'ok');
  assert.equal(categoryCheck(base, names).detail, 'Mail', 'additional categories are optional');
  assert.match(categoryCheck({ ...base, additionalCategories: ['Mail'] }, names).detail, /schon die Hauptkategorie/);
  assert.match(categoryCheck({ ...base, additionalCategories: ['Sounds'] }, names).detail, /gibt es auf CurseForge nicht/);
  assert.match(categoryCheck({ ...base, additionalCategories: ['PvP', 'PvP'] }, names).detail, /doppelte/);
  assert.match(categoryCheck({ ...base, additionalCategories: ['PvP', 'Guild', 'Miscellaneous', 'Audio & Video'] }, names).detail, /höchstens 3/);
  assert.match(categoryCheck({ category: 'Sounds' }, names).detail, /gibt es auf CurseForge nicht/);
  assert.equal(categoryCheck({ category: 'Anything' }).level, 'ok', 'without a list only the shape is checked');
});

test('the WoW pages use only real CurseForge categories', async () => {
  const { categoryCheck } = await import('../scripts/lib/page-check.js');
  const names = JSON.parse(fs.readFileSync('./tools/wow/categories.json', 'utf-8')).names;
  for (const slug of fs.readdirSync('./tools/wow/projects')) {
    const file = path.join('./tools/wow/projects', slug, 'page.json');
    if (!fs.existsSync(file)) continue;
    const r = categoryCheck(JSON.parse(fs.readFileSync(file, 'utf-8')), names);
    assert.equal(r.level, 'ok', `${slug}: ${r.detail}`);
  }
});
