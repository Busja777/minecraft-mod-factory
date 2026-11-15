import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright-core';
import { makeStudioRepo } from './helpers/studio-fixture.js';
import { createStudioServer, safeFilePath } from '../scripts/lib/studio-server.js';
import { runChecks } from '../scripts/lib/checks.js';
import { skinpackKitFields } from '../scripts/lib/kit.js';

// Studio end to end in a temp repo (cwd switched there): checks, API, security, notes CLI and the UI.

const REPO = process.cwd();
const UI = path.join(REPO, 'tools', 'studio');
let repo, studio, base, browser;
const NOW = new Date('2026-11-14T10:00:00Z');

before(async () => {
  repo = await makeStudioRepo();
  process.chdir(repo.root);
  studio = createStudioServer({ config: repo.config, now: () => NOW, uiDir: UI, openTerminal: cmd => { studio.lastCommand = cmd; } });
  base = await studio.listen(0);
  try { browser = await chromium.launch(); } catch { try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = null; } }
});
after(async () => { await browser?.close(); await studio.close(); process.chdir(REPO); });

const post = (p, body = {}, origin = base) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
const review = () => JSON.parse(fs.readFileSync(path.join(repo.dir, 'review.json'), 'utf-8'));
const notes = (...args) => spawnSync(process.execPath, [path.join(REPO, 'scripts', 'notes.js'), ...args], { cwd: repo.root, encoding: 'utf-8' });

test('checks: the fixture pack passes, a wrong logo size is red', async () => {
  const pack = JSON.parse(fs.readFileSync(path.join(repo.dir, 'pack.json'), 'utf-8'));
  const f = skinpackKitFields(pack, repo.config, { mode: 'new' });
  const files = { logo: `${f.dir}/${f.logo}`, cover: `${f.dir}/${f.cover}`, mcpack: `${f.dir}/mcpack/${f.firstFile}` };
  const good = await runChecks(f, files);
  assert.deepEqual(good.filter(c => c.level !== 'ok'), []);
  const bad = await makeStudioRepo({ logoSize: 512 });
  const logo = await runChecks(f, { ...files, logo: path.join(bad.dir, 'Neon Ninja.png') });
  assert.match(logo.find(c => c.id === 'logo').detail, /512×512 statt 400×400/);
  const named = await runChecks({ ...f, name: 'Neon Ninja Skin Pack 1.2', summary: 'Zwei Ninjas für die Nacht' }, files);
  assert.equal(named.find(c => c.id === 'name').level, 'warn');
  assert.equal(named.find(c => c.id === 'summary').level, 'warn');
});

test('security: files only from data/ and previews/, actions only from the Studio itself', async () => {
  fs.writeFileSync(path.join(repo.root, 'secrets.env'), 'X=1');
  assert.equal(safeFilePath('/files/secrets.env'), null);
  assert.equal(safeFilePath('/files/data/../secrets.env'), null);
  assert.equal(safeFilePath('/files/%2e%2e/secrets.env'), null);
  assert.equal((await fetch(`${base}/files/..%2Fsecrets.env`)).status, 403);
  assert.equal((await fetch(`${base}/files/data/skins/neon-ninja/Neon%20Ninja.png`)).status, 200);
  assert.equal((await post('/api/item/skinpack/neon-ninja/go', {}, null)).status, 403, 'no Origin');
  assert.equal((await post('/api/item/skinpack/neon-ninja/go', {}, 'https://evil.example')).status, 403, 'foreign Origin');
  assert.equal((await post('/api/item/skinpack/neon-ninja/publish')).status, 400, 'publish needs Go');
});

test('API round trip + notes CLI: mark → Claude → notes --erledigt → Go plans a morning slot', async () => {
  const o = await (await fetch(`${base}/api/overview`)).json();
  assert.deepEqual(o.go.map(c => c.key), ['neon-ninja']);
  const item = await (await fetch(`${base}/api/item/skinpack/neon-ninja`)).json();
  assert.deepEqual(item.parts.map(p => p.id), ['name', 'summary', 'logo', 'cover', 'skin:aka.png', 'skin:ao.png', 'beschreibung', 'changelog', 'datei']);

  assert.equal((await post('/api/item/skinpack/neon-ninja/part', { part: 'logo', note: 'Hintergrund dunkler' })).status, 200);
  assert.equal((await post('/api/item/skinpack/neon-ninja/go')).status, 400, 'open note blocks Go');
  assert.equal((await post('/api/item/skinpack/neon-ninja/return')).status, 200);
  assert.equal(review().status, 'ueberarbeiten');

  const list = notes();
  assert.match(list.stdout, /Neon Ninja[\s\S]*logo: „Hintergrund dunkler“[\s\S]*build-images\.js --skinpack neon-ninja --force[\s\S]*--erledigt neon-ninja:logo/);
  const done = notes('--erledigt', 'neon-ninja:logo');
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /liegt wieder im Studio zur Prüfung \(Runde 2\)/);

  const after = await (await fetch(`${base}/api/item/skinpack/neon-ninja`)).json();
  assert.equal(after.parts.find(p => p.id === 'logo').changed, true);
  const go = await (await post('/api/item/skinpack/neon-ninja/go')).json();
  assert.equal(go.item.status, 'geplant');
  assert.ok(new Date(go.item.slot) > NOW);
  assert.equal((await post('/api/item/skinpack/neon-ninja/publish')).status, 200);
  assert.equal(studio.lastCommand, 'npm run cf -- publish --skinpack neon-ninja');
  assert.equal((await post('/api/item/skinpack/neon-ninja/withdraw')).status, 200);
  assert.equal(review().status, 'zur-pruefung');
});

test('tick marks a reached slot as due and notifies', () => {
  const r = review();
  Object.assign(r, { status: 'geplant', slot: '2026-11-16T08:26:00.000Z' });
  fs.writeFileSync(path.join(repo.dir, 'review.json'), JSON.stringify(r));
  const run = at => spawnSync(process.execPath, [path.join(REPO, 'scripts', 'studio.js'), 'tick'], { cwd: repo.root, encoding: 'utf-8', env: { ...process.env, NOW: at, STUDIO_NOTIFY: 'log' } });
  assert.match(run('2026-11-16T08:00:00Z').stdout, /0 neu fällig/);
  const due = run('2026-11-16T08:30:00Z');
  assert.match(due.stdout, /\[Mitteilung\] Minecraft Studio: Jetzt veröffentlichen: Neon Ninja/);
  assert.equal(review().status, 'faellig');
  r.status = 'zur-pruefung'; delete r.slot;
  fs.writeFileSync(path.join(repo.dir, 'review.json'), JSON.stringify(r));
});

test('UI: review mode – „Ändern“ on a skin, back to Claude, then Go after rework', async t => {
  if (!browser) return t.skip('no browser');
  const page = await browser.newPage();
  await page.goto(base);
  await page.getByRole('link', { name: /Packs nacheinander prüfen \(1\)/ }).click();
  await page.getByRole('heading', { name: 'Neon Ninja', level: 1 }).waitFor();
  assert.equal(await page.locator('.pruefungen .error').count(), 0);
  assert.ok(await page.getByRole('button', { name: 'Go – fertig' }).isEnabled());

  const skin = page.locator('[data-part="skin:aka.png"]');
  await skin.getByRole('button', { name: 'Ändern' }).click();
  await skin.getByLabel('Was soll Claude ändern?').fill('Augen rot statt blau');
  await skin.getByRole('button', { name: 'Notiz speichern' }).click();
  await page.locator('[data-part="skin:aka.png"] .notiz').waitFor();
  assert.ok(await page.getByRole('button', { name: 'Go – fertig' }).isDisabled());
  assert.match(await page.locator('.grund').innerText(), /1 Notiz offen/);
  await page.getByRole('button', { name: 'An Claude zurückgeben (1)' }).click();
  await page.getByRole('heading', { name: 'Überblick' }).waitFor();
  assert.match(await page.locator('main').innerText(), /Wartet auf Claude\s+1/);

  assert.equal(notes('--erledigt', 'neon-ninja:skin:aka.png').status, 0);
  await page.reload();
  await page.getByRole('link', { name: /Packs nacheinander prüfen/ }).click();
  await page.locator('[data-part="skin:aka.png"] .abzeichen').waitFor();
  assert.match(await page.locator('[data-part="skin:aka.png"]').innerText(), /neu seit Runde 3[\s\S]*Augen rot statt blau/);
  await page.getByRole('button', { name: 'Go – fertig' }).click();
  await page.getByRole('heading', { name: 'Überblick' }).waitFor();
  assert.match(await page.locator('main').innerText(), /Eingeplant\s+1[\s\S]*Neon Ninja[\s\S]*eingeplant/);
  assert.equal(review().status, 'geplant');
});
